// const admin = require('firebase-admin');
// const dotenv = require('dotenv');

// dotenv.config();

// const serviceAccount = {
//     projectId: process.env.FIREBASE_PROJECT_ID,
//     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//     privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
// };

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount)
// });

// const db = admin.firestore();

// async function calculateAndPayInterest(userId, cycle, lowest, avg) {
//     const combinedAvg = (lowest + avg) / 2;
//     const interest = combinedAvg * 0.05;
    
//     if (interest <= 0) return 0;
    
//     await db.collection('interestPayments').add({
//         userId,
//         cycle,
//         lowestBalance: lowest,
//         avgDailyBalance: avg,
//         interestAmount: interest,
//         paidDate: new Date()
//     });
    
//     await db.collection('users').doc(userId).update({
//         currentBalance: admin.firestore.FieldValue.increment(interest),
//         totalInterestEarned: admin.firestore.FieldValue.increment(interest)
//     });
    
//     const adminRef = db.collection('adminSettings').doc('settings');
//     const adminDoc = await adminRef.get();
//     const cumulative = (adminDoc.exists ? adminDoc.data().cumulativeInterestPaid : 0) + interest;
//     await adminRef.set({ cumulativeInterestPaid: cumulative }, { merge: true });
    
//     return interest;
// }

// async function dailyBalanceUpdate() {
//     console.log(`[${new Date().toISOString()}] Starting daily balance update...`);
    
//     const usersSnapshot = await db.collection('users')
//         .where('isActive', '==', true)
//         .get();
    
//     let updatedCount = 0;
//     let interestPaidTotal = 0;
    
//     for (const userDoc of usersSnapshot.docs) {
//         const user = userDoc.data();
//         const userId = userDoc.id;
        
//         await db.collection('dailyBalances').add({
//             userId,
//             date: new Date(),
//             balance: user.currentBalance,
//             cycle: user.currentCycle,
//             day: user.currentDay,
//             createdAt: new Date()
//         });
        
//         let lowest = user.lowestBalanceThisCycle;
//         if (user.currentBalance < lowest || lowest === 0) {
//             lowest = user.currentBalance;
//         }
        
//         const currentDay = user.currentDay;
//         let oldAvg = user.avgDailyBalanceThisCycle || user.currentBalance;
//         let newAvg = ((oldAvg * (currentDay - 1)) + user.currentBalance) / currentDay;
        
//         if (currentDay >= 21) {
//             const interest = await calculateAndPayInterest(userId, user.currentCycle, lowest, newAvg);
//             interestPaidTotal += interest;
            
//             const nextCycle = user.currentCycle + 1;
//             const isGraduated = nextCycle > 8;
//             const newBalance = user.currentBalance + interest;
            
//             const updateData = {
//                 currentCycle: nextCycle,
//                 currentDay: 1,
//                 cycleStartDate: new Date(),
//                 lowestBalanceThisCycle: newBalance,
//                 avgDailyBalanceThisCycle: newBalance
//             };
            
//             if (isGraduated) {
//                 updateData.graduationDate = new Date();
//             }
            
//             await db.collection('users').doc(userId).update(updateData);
//             updatedCount++;
//         } else {
//             await db.collection('users').doc(userId).update({
//                 currentDay: currentDay + 1,
//                 lowestBalanceThisCycle: lowest,
//                 avgDailyBalanceThisCycle: newAvg
//             });
//             updatedCount++;
//         }
//     }
    
//     const allUsersSnapshot = await db.collection('users')
//         .where('isActive', '==', true)
//         .get();
    
//     let totalPool = 0;
//     allUsersSnapshot.forEach(doc => {
//         totalPool += doc.data().currentBalance;
//     });
    
//     const adminRef = db.collection('adminSettings').doc('settings');
//     const adminDoc = await adminRef.get();
    
//     await adminRef.set({
//         currentTotalSavingsPool: totalPool,
//         updatedAt: new Date()
//     }, { merge: true });
    
//     const settings = adminDoc.exists ? adminDoc.data() : {};
//     let stopTriggered = false;
    
//     if (totalPool >= (settings.totalSavingsPoolLimit || 1200000)) {
//         stopTriggered = true;
//         console.log('STOP CONDITION: Total savings pool limit reached');
//     }
    
//     if ((settings.cumulativeInterestPaid || 0) >= (settings.budgetLimit || 500000)) {
//         stopTriggered = true;
//         console.log('STOP CONDITION: Budget limit reached');
//     }
    
//     if (stopTriggered && !settings.stopTriggered) {
//         await adminRef.set({ stopTriggered: true }, { merge: true });
//     }
    
//     console.log(`[${new Date().toISOString()}] Daily balance update complete. Updated: ${updatedCount} users. Interest paid: ₦${interestPaidTotal.toFixed(2)}. Total pool: ₦${totalPool.toFixed(2)}`);
// }

// dailyBalanceUpdate()
//     .then(() => process.exit(0))
//     .catch((error) => {
//         console.error('Error:', error);
//         process.exit(1);
//     });


const admin = require('firebase-admin');
const dotenv = require('dotenv');

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

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function calculateAndPayInterest(userId, cycle, avgDays1to16, totalSavedDays1to16) {
    // Option B: 5% on average of Days 1-16 only
    // Days 17-21 earn NO interest
    const interest = avgDays1to16 * 0.05;
    
    if (interest <= 0) return 0;
    
    // 1. Record interest payment
    await db.collection('interestPayments').add({
        userId,
        cycle,
        avgDailyBalanceDays1to16: avgDays1to16,
        totalSavedDays1to16: totalSavedDays1to16,
        interestAmount: interest,
        interestRate: 0.05,
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
        description: `5% interest on average balance of Days 1-16 (₦${avgDays1to16.toLocaleString()})`,
        balanceAfter: (user.currentBalance || 0) + interest,
        createdAt: new Date()
    });
    
    // 4. Update admin cumulative interest
    const adminRef = db.collection('adminSettings').doc('settings');
    const adminDoc = await adminRef.get();
    const cumulative = (adminDoc.exists ? adminDoc.data().cumulativeInterestPaid : 0) + interest;
    await adminRef.set({ cumulativeInterestPaid: cumulative }, { merge: true });
    
    return interest;
}

async function dailyBalanceUpdate() {
    console.log(`[${new Date().toISOString()}] Starting daily balance update (Option B - Days 1-16 only)...`);
    
    const usersSnapshot = await db.collection('users')
        .where('isActive', '==', true)
        .get();
    
    let updatedCount = 0;
    let interestPaidTotal = 0;
    
    for (const userDoc of usersSnapshot.docs) {
        const user = userDoc.data();
        const userId = userDoc.id;
        const currentDay = user.currentDay;
        
        // Record daily balance for history
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
            
            const interest = await calculateAndPayInterest(userId, user.currentCycle, avgDays1to16, totalSavedDays1to16);
            interestPaidTotal += interest;
            
            // Move to next cycle
            const nextCycle = user.currentCycle + 1;
            const isGraduated = nextCycle > 8;
            const newBalance = user.currentBalance + interest;
            
            const updateData = {
                currentCycle: nextCycle,
                currentDay: 1,
                cycleStartDate: new Date(),
                hasStartedCycle: true,  // ← ✅ ADD THIS LINE
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
            
            console.log(`User ${userId}: Cycle ${user.currentCycle} complete. Days 1-16 avg: ₦${avgDays1to16.toFixed(2)}, Interest: ₦${interest.toFixed(2)}`);
        } else {
            // Just increment day and reset todaysDeposit
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
    
    // Update admin settings
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
    console.log(`   Interest paid: ₦${interestPaidTotal.toFixed(2)}`);
    console.log(`   Total savings pool: ₦${totalPool.toFixed(2)}`);
    console.log(`   Cumulative interest: ₦${(settings.cumulativeInterestPaid || 0).toFixed(2)}`);
}

// Run the function
dailyBalanceUpdate()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });