// thespark-backend/src/cron/dailyBalanceUpdate.js
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const REFERRAL_CONSTANTS = require('../utils/referralConstants.cjs');
const {
    getPlanInterestRate,
    getPlanMonthlyFee,
    getPlanLimits,
    getPlanDurationDays,      // ✅ NEW
} = require('../utils/planLimits');

dotenv.config();

// ✅ FIX: Properly handle the private key
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Remove quotes if present
if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
}

// Replace literal \n with actual newlines
if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
}

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey
};

// ✅ CHANGE 1: Guard initializeApp so importing this file doesn't crash
// if firebase-admin was already initialized elsewhere (e.g. server.js)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// ============================================================
// ✅ Determine the interest rate for a given user.
// Priority:
//   1. user.premiumInterestRate (explicit, set per user)
//   2. Plan-based fallback — read from planLimits.js
// ============================================================
function getUserInterestRate(user) {
    // 1. Explicit rate on the user document
    if (typeof user.premiumInterestRate === 'number' && user.premiumInterestRate > 0) {
        return user.premiumInterestRate;
    }

    // 2. Plan-based fallback — read from planLimits.js
    return getPlanInterestRate(user.premiumPlan);
}

async function calculateAndPayInterest(userId, cycle, avgDays1to16, totalSavedDays1to16, interestRatePercent) {
    // ✅ Use the caller-provided rate (per user), fall back to Basic plan rate
    const ratePercent =
        typeof interestRatePercent === 'number' && interestRatePercent > 0
            ? interestRatePercent
            : getPlanInterestRate('Basic');

    const rateDecimal = ratePercent / 100;
    const interest = avgDays1to16 * rateDecimal;

    if (interest <= 0) return 0;

    // 1. Record interest payment
    await db.collection('interestPayments').add({
        userId,
        cycle,
        avgDailyBalanceDays1to16: avgDays1to16,
        totalSavedDays1to16: totalSavedDays1to16,
        interestAmount: interest,
        interestRate: rateDecimal,
        interestRatePercent: ratePercent,
        calculationBasis: 'Days 1-16 only - Days 17-21 earn NO interest',
        paidDate: new Date()
    });

    // 2. Update user balance
    await db.collection('users').doc(userId).update({
        currentBalance: admin.firestore.FieldValue.increment(interest),
        totalInterestEarned: admin.firestore.FieldValue.increment(interest),
        totalPrincipalSaved: admin.firestore.FieldValue.increment(totalSavedDays1to16)
    });

    // 3. Record transaction
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();

    await db.collection('transactions').add({
        userId,
        type: 'interest',
        amount: interest,
        cycle,
        day: 22,
        description: `${ratePercent}% interest on average balance of Days 1-16 (₦${avgDays1to16.toLocaleString()})`,
        balanceAfter: (user.currentBalance || 0) + interest,
        createdAt: new Date()
    });

    // 4. Update admin cumulative interest
    const adminRef = db.collection('adminSettings').doc('settings');
    const adminDoc = await adminRef.get();
    const existingCumulative = adminDoc.exists ? adminDoc.data().cumulativeInterestPaid : 0;
    // ✅ FIX: guard against NaN propagation — if existing value is NaN, treat it as 0
    const cumulative = (Number.isFinite(existingCumulative) ? existingCumulative : 0) + interest;

    await adminRef.set({ cumulativeInterestPaid: cumulative }, { merge: true });

    return interest;
}

// ✅ Pay referral bonus when user completes first cycle (using constants)
async function payReferralBonus(userId) {
    try {
        // Check if this user was referred
        const referralsSnapshot = await db.collection('referrals')
            .where('referredId', '==', userId)
            .where('referrerPaid', '==', false)
            .get();

        for (const doc of referralsSnapshot.docs) {
            const referral = doc.data();
            const referrerId = referral.referrerId;

            // ✅ Use stored bonus amount or fallback to constant
            const bonusAmount = referral.referrerBonus || REFERRAL_CONSTANTS.REFERRER_BONUS;

            // ✅ Give referrer bonus
            await db.collection('users').doc(referrerId).update({
                currentBalance: admin.firestore.FieldValue.increment(bonusAmount),
                totalPrincipalSaved: admin.firestore.FieldValue.increment(bonusAmount)
            });

            // ✅ Mark referrer as paid
            await doc.ref.update({
                referrerPaid: true,
                referrerPaidAt: new Date()
            });

            // ✅ Record transaction for referrer
            const referrerDoc = await db.collection('users').doc(referrerId).get();
            await db.collection('transactions').add({
                userId: referrerId,
                type: REFERRAL_CONSTANTS.TRANSACTION_TYPES.REFERRER,
                amount: bonusAmount,
                description: `${REFERRAL_CONSTANTS.DESCRIPTIONS.REFERRER}: ${userId}`,
                balanceAfter: referrerDoc.data().currentBalance || 0,
                createdAt: new Date()
            });

            console.log(`✅ Referrer ${referrerId} got ₦${bonusAmount} for referring ${userId}`);
        }
    } catch (error) {
        console.error('Error paying referral bonus:', error);
    }
}

// ============================================================
// ✅ Charge premium plan renewals
// Runs daily. For any Premium/Investor user whose plan
// expired, deduct the fee from their balance and extend
// by 30 days (monthly) or 365 days (yearly).
// If balance is too low, downgrade to Basic.
// ============================================================
async function processPremiumRenewals() {
    console.log('💳 Processing premium plan renewals...');

    const now = new Date();
    const usersSnapshot = await db.collection('users')
        .where('premiumPlan', 'in', ['Premium', 'Investor'])
        .get();

    let renewed = 0;
    let downgraded = 0;
    let skipped = 0;

    for (const userDoc of usersSnapshot.docs) {
        const user = userDoc.data();
        const userId = userDoc.id;

        // Parse expiry (supports Firestore Timestamp, {seconds}, {_seconds}, ISO string)
        const rawExpires = user.premiumExpiresAt;
        let expiresAt = null;
        if (rawExpires) {
            if (typeof rawExpires.toDate === 'function') {
                expiresAt = rawExpires.toDate();
            } else if (rawExpires._seconds) {
                expiresAt = new Date(rawExpires._seconds * 1000);
            } else if (rawExpires.seconds) {
                expiresAt = new Date(rawExpires.seconds * 1000);
            } else {
                const parsed = new Date(rawExpires);
                if (!isNaN(parsed.getTime())) expiresAt = parsed;
            }
        }

        // If no expiry yet (existing users before this feature), set one and skip this cycle
        if (!expiresAt) {
            // ✅ NEW: use the user's interval (defaults to monthly)
            const fallbackDays = getPlanDurationDays(user.premiumBillingInterval || 'monthly');
            const fallbackExpiry = new Date(now.getTime() + fallbackDays * 24 * 60 * 60 * 1000);
            await userDoc.ref.update({
                premiumExpiresAt: fallbackExpiry,
                premiumMonthlyFee: user.premiumMonthlyFee || getPlanMonthlyFee(user.premiumPlan),
                premiumBillingInterval: user.premiumBillingInterval || 'monthly'   // ✅ NEW
            });
            console.log(`ℹ️  Set missing premiumExpiresAt for ${userId} → ${fallbackExpiry.toISOString()}`);
            skipped++;
            continue;
        }

        // Not expired yet
        if (expiresAt > now) {
            skipped++;
            continue;
        }

        const fee = user.premiumMonthlyFee || getPlanMonthlyFee(user.premiumPlan);
        const currentBalance = user.currentBalance || 0;

        if (currentBalance < fee) {
            // Not enough balance → downgrade to Basic
            await userDoc.ref.update({
                premiumPlan: 'Basic',
                premiumBillingInterval: 'monthly',    // ✅ NEW: reset interval
                premiumInterestRate: getPlanInterestRate('Basic'),
                premiumExpiresAt: null,
                premiumMonthlyFee: 0,
                premiumDowngradedAt: now,
                premiumDowngradeReason: 'insufficient_balance',
                dailySaveMax: getPlanLimits('Basic').max
            });

            await db.collection('notifications').add({
                userId,
                title: '⚠️ Premium Plan Expired',
                message: `Your ${user.premiumPlan} plan expired because your balance (₦${currentBalance.toLocaleString()}) was less than the renewal fee (₦${fee.toLocaleString()}). You've been moved to Basic. Top up your balance and re-subscribe anytime.`,
                type: 'premium_expired',
                read: false,
                createdAt: now
            });

            console.log(`⬇️  Downgraded ${userId} (balance ₦${currentBalance} < fee ₦${fee})`);
            downgraded++;
            continue;
        }

        // ✅ NEW: renew based on the user's billing interval
        const renewalDays = getPlanDurationDays(user.premiumBillingInterval || 'monthly');
        const newExpiresAt = new Date(now.getTime() + renewalDays * 24 * 60 * 60 * 1000);
        const billingLabel = user.premiumBillingInterval === 'yearly' ? 'yearly' : 'monthly';   // ✅ NEW

        await userDoc.ref.update({
            currentBalance: admin.firestore.FieldValue.increment(-fee),
            premiumExpiresAt: newExpiresAt,
            premiumRenewedAt: now
        });

        await db.collection('transactions').add({
            userId,
            type: 'premium_fee',
            amount: fee,
            description: `${user.premiumPlan} plan — ${billingLabel} renewal`,   // ✅ NEW
            billingInterval: billingLabel,                                       // ✅ NEW
            renewsAt: newExpiresAt,
            createdAt: now
        });

        await db.collection('notifications').add({
            userId,
            title: '✅ Premium Plan Renewed',
            message: `Your ${user.premiumPlan} plan has been renewed for another ${billingLabel === 'yearly' ? 'year' : '30 days'}. ₦${fee.toLocaleString()} was deducted from your balance. Next renewal: ${newExpiresAt.toLocaleDateString()}.`,   // ✅ NEW
            type: 'premium_renewed',
            read: false,
            createdAt: now
        });

        console.log(`✅ Renewed ${userId} for ₦${fee} (${billingLabel}, new expiry: ${newExpiresAt.toISOString()})`);
        renewed++;
    }

    console.log(`💳 Premium renewals complete. Renewed: ${renewed}, Downgraded: ${downgraded}, Skipped: ${skipped}`);
}

async function dailyBalanceUpdate() {
    console.log(`[${new Date().toISOString()}] Starting daily balance update (Option B - Days 1-16 only)...`);

    // ✅ Charge premium renewals before anything else
    await processPremiumRenewals();

    const usersSnapshot = await db.collection('users')
        .where('isActive', '==', true)
        .get();

    let updatedCount = 0;
    let interestPaidTotal = 0;
    let skippedUsers = 0;
    let fixedUsers = 0;

    for (const userDoc of usersSnapshot.docs) {
        const user = userDoc.data();
        const userId = userDoc.id;
        const currentDay = user.currentDay;

        // ✅ FIX: Only use hasStartedCycle as the definitive check
        // If hasStartedCycle is false, user should be on Day 0
        const hasStarted = user.hasStartedCycle === true;

        // ✅ FIX: If hasStartedCycle is false but currentDay > 0, reset it to 0
        if (!hasStarted && currentDay > 0) {
            console.log(`🔄 FIX: User ${userId} has hasStartedCycle: false but currentDay: ${currentDay} - Resetting to Day 0`);
            await db.collection('users').doc(userId).update({
                currentDay: 0,
                days1to16Count: 0,
                avgDays1to16: 0,
                days1to16TotalBalance: 0,
                totalSavedDays1to16: 0,
                todaysDeposit: 0
            });
            fixedUsers++;
            skippedUsers++;
            continue;
        }

        if (!hasStarted) {
            console.log(`⏳ User ${userId} hasn't started cycle yet - skipping tracking`);
            skippedUsers++;
            continue;
        }

        // ✅ ONLY run for users who have actually started
        await db.collection('dailyBalances').add({
            userId,
            date: new Date(),
            balance: user.currentBalance,
            cycle: user.currentCycle,
            day: currentDay,
            createdAt: new Date()
        });

        // ONLY track Days 1-16 for interest calculation
        if (currentDay >= 1 && currentDay <= 16) {
            let oldAvg = user.avgDays1to16 || 0;
            let oldCount = user.days1to16Count || 0;
            let newCount = oldCount + 1;
            let newAvg = ((oldAvg * oldCount) + user.currentBalance) / newCount;

            await db.collection('users').doc(userId).update({
                avgDays1to16: newAvg,
                days1to16Count: newCount,
                days1to16TotalBalance: (user.days1to16TotalBalance || 0) + user.currentBalance,
                totalSavedDays1to16: (user.totalSavedDays1to16 || 0) + (user.todaysDeposit || 0)
            });
        }

        // Days 17-21: No tracking, no interest calculation

        // Check if it's end of cycle (Day 22)
        if (currentDay >= 22) {
            const avgDays1to16 = user.avgDays1to16 || 0;
            const totalSavedDays1to16 = user.totalSavedDays1to16 || 0;

            // ✅ Determine this user's rate before paying
            const userRate = getUserInterestRate(user);

            console.log(
                `💰 User ${userId} (${user.premiumPlan || 'no plan'}) — rate: ${userRate}% | avg: ₦${avgDays1to16.toFixed(2)}`
            );

            const interest = await calculateAndPayInterest(
                userId,
                user.currentCycle,
                avgDays1to16,
                totalSavedDays1to16,
                userRate
            );
            interestPaidTotal += interest;

            // ✅ Pay referral bonus if this is first cycle completion
            if (user.currentCycle === 1) {
                await payReferralBonus(userId);
            }

            // Move to next cycle
            const nextCycle = user.currentCycle + 1;
            const isGraduated = nextCycle > 8;
            const newBalance = user.currentBalance + interest;

            const updateData = {
                currentCycle: nextCycle,
                currentDay: 1,
                cycleStartDate: new Date(),
                hasStartedCycle: true,
                // Reset Days 1-16 tracking
                avgDays1to16: 0,
                days1to16Count: 0,
                days1to16TotalBalance: 0,
                totalSavedDays1to16: 0,
                todaysDeposit: 0,
                // Reset regular tracking
                avgDailyBalanceThisCycle: newBalance,
                lowestBalanceThisCycle: newBalance
            };

            if (isGraduated) {
                updateData.graduationDate = new Date();
            }

            await db.collection('users').doc(userId).update(updateData);
            updatedCount++;

            console.log(`User ${userId}: Cycle ${user.currentCycle} complete. Days 1-16 avg: ₦${avgDays1to16.toFixed(2)}, Interest (${userRate}%): ₦${interest.toFixed(2)}`);
        } else {
            // ✅ Only runs for users who have started
            await db.collection('users').doc(userId).update({
                currentDay: currentDay + 1,
                todaysDeposit: 0
            });
            updatedCount++;
        }
    }

    // Calculate total savings pool
    const allUsersSnapshot = await db.collection('users')
        .where('isActive', '==', true)
        .get();

    let totalPool = 0;
    allUsersSnapshot.forEach(doc => {
        totalPool += doc.data().currentBalance;
    });

    const adminRef = db.collection('adminSettings').doc('settings');
    const adminDoc = await adminRef.get();
    const settings = adminDoc.exists ? adminDoc.data() : {};

    await adminRef.set({
        currentTotalSavingsPool: totalPool,
        updatedAt: new Date()
    }, { merge: true });

    // Stop conditions (informational only - admin dashboard handles actions)
    let stopTriggered = false;

    if (totalPool >= (settings.totalSavingsPoolLimit || 1200000)) {
        stopTriggered = true;
        console.log('⚠️ STOP CONDITION: Total savings pool limit reached');
    }

    if ((settings.cumulativeInterestPaid || 0) >= (settings.budgetLimit || 500000)) {
        stopTriggered = true;
        console.log('⚠️ STOP CONDITION: Budget limit reached');
    }

    if (stopTriggered && !settings.stopTriggered) {
        await adminRef.set({ stopTriggered: true }, { merge: true });
    }

    console.log(`[${new Date().toISOString()}] Daily balance update complete.`);
    console.log(`   Updated: ${updatedCount} users`);
    console.log(`   Fixed: ${fixedUsers} users (had incorrect currentDay)`);
    console.log(`   Skipped: ${skippedUsers} users (not started yet)`);
    console.log(`   Interest paid: ₦${interestPaidTotal.toFixed(2)}`);
    console.log(`   Total savings pool: ₦${totalPool.toFixed(2)}`);
    console.log(`   Cumulative interest: ₦${(settings.cumulativeInterestPaid || 0).toFixed(2)}`);
}

// ✅ CHANGE 2: Only auto-run when executed directly (`npm run cron` or `node file`).
// When imported from server.js, we skip this and expose the function instead.
if (require.main === module) {
    dailyBalanceUpdate()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}

// ✅ CHANGE 3: Export for HTTP-triggered cron endpoint (used by server.js)
module.exports = { runDailyBalanceUpdate: dailyBalanceUpdate };