// const express = require('express');
// const { db } = require('../services/firebase');
// const { authenticate } = require('../middleware/auth');

// const router = express.Router();

// router.post('/', authenticate, async (req, res) => {
//     const { amount, cycle, day } = req.body;
//     const userId = req.user.uid;
    
//     if (amount < 100 || amount > 2000) {
//         return res.status(400).json({ error: 'Amount must be between ₦100 and ₦2,000' });
//     }
    
//     const userRef = db.collection('users').doc(userId);
//     const userDoc = await userRef.get();
    
//     if (!userDoc.exists) {
//         return res.status(404).json({ error: 'User not found' });
//     }
    
//     const user = userDoc.data();
    
//     if (day !== user.currentDay) {
//         return res.status(400).json({ error: 'Day mismatch' });
//     }
    
//     const isLast5Days = user.currentDay > 16;
//     const newBalance = user.currentBalance + amount;
    
//     await userRef.update({
//         currentBalance: newBalance,
//         totalPrincipalSaved: user.totalPrincipalSaved + amount
//     });
    
//     await db.collection('transactions').add({
//         userId,
//         type: 'deposit',
//         amount,
//         cycle,
//         day,
//         balanceAfter: newBalance,
//         isLast5Days,
//         createdAt: new Date()
//     });
    
//     const adminRef = db.collection('adminSettings').doc('settings');
//     const adminDoc = await adminRef.get();
//     if (adminDoc.exists) {
//         await adminRef.update({
//             currentTotalSavingsPool: admin.firestore.FieldValue.increment(amount)
//         });
//     }
    
//     res.json({
//         success: true,
//         newBalance,
//         warning: isLast5Days ? 'Deposits in last 5 days earn interest next cycle' : null
//     });
// });

// router.get('/history', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     const snapshot = await db.collection('transactions')
//         .where('userId', '==', userId)
//         .where('type', '==', 'deposit')
//         .orderBy('createdAt', 'desc')
//         .limit(50)
//         .get();
    
//     const deposits = [];
//     snapshot.forEach(doc => deposits.push({ id: doc.id, ...doc.data() }));
    
//     res.json(deposits);
// });

// module.exports = router;

// const express = require('express');
// const { db } = require('../services/firebase');
// const { authenticate } = require('../middleware/auth');

// // Import Firebase Admin for FieldValue
// const admin = require('firebase-admin');

// const router = express.Router();

// router.post('/', authenticate, async (req, res) => {
//     const { amount, cycle, day } = req.body;
//     const userId = req.user.uid;
    
//     if (amount < 100 || amount > 2000) {
//         return res.status(400).json({ error: 'Amount must be between ₦100 and ₦2,000' });
//     }
    
//     const userRef = db.collection('users').doc(userId);
//     const userDoc = await userRef.get();
    
//     if (!userDoc.exists) {
//         return res.status(404).json({ error: 'User not found' });
//     }
    
//     const user = userDoc.data();
    
//     if (day !== user.currentDay) {
//         return res.status(400).json({ error: 'Day mismatch' });
//     }
    
//     const isLast5Days = user.currentDay > 16;
//     const newBalance = user.currentBalance + amount;
    
//     await userRef.update({
//         currentBalance: newBalance,
//         totalPrincipalSaved: user.totalPrincipalSaved + amount
//     });
    
//     await db.collection('transactions').add({
//         userId,
//         type: 'deposit',
//         amount,
//         cycle,
//         day,
//         balanceAfter: newBalance,
//         isLast5Days,
//         createdAt: admin.firestore.FieldValue.serverTimestamp()
//     });
    
//     const adminRef = db.collection('adminSettings').doc('settings');
//     const adminDoc = await adminRef.get();
//     if (adminDoc.exists) {
//         await adminRef.update({
//             currentTotalSavingsPool: admin.firestore.FieldValue.increment(amount)
//         });
//     }
    
//     res.json({
//         success: true,
//         newBalance,
//         warning: isLast5Days ? 'Deposits in last 5 days earn interest next cycle' : null
//     });
// });

// router.get('/history', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     // Fetch without orderBy
//     const snapshot = await db.collection('transactions')
//         .where('userId', '==', userId)
//         .where('type', '==', 'deposit')
//         .get();
    
//     const deposits = [];
//     snapshot.forEach(doc => deposits.push({ id: doc.id, ...doc.data() }));
    
//     // Sort manually by createdAt (newest first)
//     deposits.sort((a, b) => {
//         const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
//         const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
//         return dateB - dateA;
//     });
    
//     res.json(deposits.slice(0, 50));
// });

// const express = require('express');
// const { db } = require('../services/firebase');
// const { authenticate } = require('../middleware/auth');
// const admin = require('firebase-admin');
// const { getPlanLimits } = require('../utils/planLimits');

// const router = express.Router();

// // Calculate total with 4.6% markup
// const calculateTotal = (amount) => {
//     return Math.ceil(amount * 1.046 / 10) * 10;
// };

// // ============ DEPOSIT ENDPOINT (Manual entry - for testing) ============
// router.post('/', authenticate, async (req, res) => {
//     const { amount, cycle, day } = req.body;
//     const userId = req.user.uid;
    
//     const userRef = db.collection('users').doc(userId);
//     const userDoc = await userRef.get();
    
//     if (!userDoc.exists) {
//         return res.status(404).json({ error: 'User not found' });
//     }
    
//     const user = userDoc.data();
//     const userPlan = user.premiumPlan || 'Basic';
//     const limits = getPlanLimits(userPlan);
    
//     if (amount < limits.min || amount > limits.max) {
//         return res.status(400).json({ 
//             error: `Amount must be between ₦${limits.min.toLocaleString()} and ₦${limits.max.toLocaleString()} for your ${userPlan} plan`,
//             minAmount: limits.min,
//             maxAmount: limits.max,
//             currentPlan: userPlan
//         });
//     }
    
//     if (day !== user.currentDay) {
//         return res.status(400).json({ error: 'Day mismatch' });
//     }
    
//     const isDays1to16 = user.currentDay <= 16;
//     const isDays17to21 = user.currentDay > 16;
//     const newBalance = user.currentBalance + amount;
    
//     const updateData = {
//         currentBalance: newBalance,
//         totalPrincipalSaved: user.totalPrincipalSaved + amount,
//         todaysDeposit: amount
//     };
    
//     if (isDays1to16) {
//         updateData.totalSavedDays1to16 = (user.totalSavedDays1to16 || 0) + amount;
//     }
    
//     await userRef.update(updateData);
    
//     await db.collection('transactions').add({
//         userId,
//         type: 'deposit',
//         amount,
//         cycle,
//         day,
//         balanceAfter: newBalance,
//         isDays1to16,
//         isDays17to21,
//         earnsInterest: isDays1to16,
//         createdAt: admin.firestore.FieldValue.serverTimestamp()
//     });
    
//     const adminRef = db.collection('adminSettings').doc('settings');
//     await adminRef.update({
//         currentTotalSavingsPool: admin.firestore.FieldValue.increment(amount)
//     });
    
//     let warning = null;
//     if (isDays17to21) {
//         warning = '❌ Days 17-21: Deposits earn NO interest at all. Save early in the cycle (Days 1-16) to earn interest!';
//     } else {
//         warning = '✅ Days 1-16: This deposit will earn interest!';
//     }
    
//     res.json({
//         success: true,
//         newBalance,
//         warning,
//         currentPlan: userPlan,
//         limits
//     });
// });

// // ============ DEPOSIT INTENT ENDPOINT ============
// // Called by DailySavingsLog when user clicks "Initiate Deposit"
// router.post('/intent', authenticate, async (req, res) => {
//     const userId = req.user.uid;
//     const { amount, cycle, day } = req.body;
    
//     const userDoc = await db.collection('users').doc(userId).get();
//     const user = userDoc.data();
//     const plan = user.premiumPlan || 'Basic';
//     const limits = getPlanLimits(plan);
    
//     if (amount < limits.min || amount > limits.max) {
//         return res.status(400).json({ 
//             error: `Amount must be between ₦${limits.min} and ₦${limits.max} for ${plan} plan` 
//         });
//     }
    
//     if (day !== user.currentDay) {
//         return res.status(400).json({ error: 'Day mismatch' });
//     }
    
//     // Calculate total with fee (4.6% markup)
//     const totalWithFee = calculateTotal(amount);
    
//     // Store deposit intent with status 'pending'
//     await db.collection('depositIntents').add({
//         userId: userId,
//         amount: amount,              // What user receives
//         totalWithFee: totalWithFee,  // What user should pay
//         cycle: cycle,
//         day: day,
//         plan: plan,
//         status: 'pending',
//         createdAt: admin.firestore.FieldValue.serverTimestamp(),
//         expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours expiry
//     });
    
//     res.json({ 
//         success: true, 
//         limits: { min: limits.min, max: limits.max },
//         totalWithFee: totalWithFee
//     });
// });

// // ============ CHECK INTENT ENDPOINT ============
// // Polled by frontend every 5 seconds to check if deposit was matched
// // ✅ Only returns unprocessed intents (processed !== true)
// // Frontend calls /confirm-intent after showing confirmation
// router.get('/check-intent', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     try {
//         const intentSnapshot = await db.collection('depositIntents')
//             .where('userId', '==', userId)
//             .get();
        
//         if (!intentSnapshot.empty) {
//             const matchedIntents = [];
            
//             intentSnapshot.forEach(doc => {
//                 const intent = doc.data();
//                 // Check for both "matched" and "matched " (with space)
//                 const isMatched = intent.status === 'matched' || intent.status === 'matched ';
                
//                 // ✅ STANDARD: Only return if NOT processed
//                 // The frontend will call /confirm-intent after showing confirmation
//                 if (isMatched && intent.processed !== true) {
//                     matchedIntents.push({ id: doc.id, ...intent });
//                 }
//             });
            
//             if (matchedIntents.length > 0) {
//                 // Sort by matchedAt (newest first)
//                 matchedIntents.sort((a, b) => {
//                     const dateA = a.matchedAt?.toDate ? a.matchedAt.toDate() : new Date(a.matchedAt || 0);
//                     const dateB = b.matchedAt?.toDate ? b.matchedAt.toDate() : new Date(b.matchedAt || 0);
//                     return dateB - dateA;
//                 });
                
//                 const latestIntent = matchedIntents[0];
//                 // Return intent ID and amount so frontend can show confirmation
//                 return res.json({ 
//                     matched: true, 
//                     amount: latestIntent.amount,
//                     intentId: latestIntent.id 
//                 });
//             }
//         }
        
//         res.json({ matched: false });
//     } catch (error) {
//         console.error('Error checking intent:', error);
//         res.json({ matched: false });
//     }
// });

// // ============ CONFIRM INTENT ENDPOINT ============
// // Called by frontend AFTER showing "Deposit confirmed" to mark as processed
// router.post('/confirm-intent', authenticate, async (req, res) => {
//     const { intentId } = req.body;
//     const userId = req.user.uid;
    
//     if (!intentId) {
//         return res.status(400).json({ error: 'Intent ID is required' });
//     }
    
//     try {
//         const intentDoc = await db.collection('depositIntents').doc(intentId).get();
        
//         if (!intentDoc.exists) {
//             return res.status(404).json({ error: 'Intent not found' });
//         }
        
//         const intent = intentDoc.data();
        
//         // Verify this intent belongs to the user
//         if (intent.userId !== userId) {
//             return res.status(403).json({ error: 'Unauthorized' });
//         }
        
//         // ✅ Mark as processed so it won't trigger again
//         await db.collection('depositIntents').doc(intentId).update({
//             processed: true,
//             confirmedAt: admin.firestore.FieldValue.serverTimestamp()
//         });
        
//         res.json({ success: true });
//     } catch (error) {
//         console.error('Error confirming intent:', error);
//         res.status(500).json({ error: 'Failed to confirm intent' });
//     }
// });

// // ============ DEPOSIT HISTORY ============
// router.get('/history', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     const snapshot = await db.collection('transactions')
//         .where('userId', '==', userId)
//         .where('type', '==', 'deposit')
//         .get();
    
//     const deposits = [];
//     snapshot.forEach(doc => deposits.push({ id: doc.id, ...doc.data() }));
    
//     deposits.sort((a, b) => {
//         const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
//         const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
//         return dateB - dateA;
//     });
    
//     res.json(deposits.slice(0, 50));
// });

// module.exports = router;

const express = require('express');
const { db } = require('../services/firebase');
const { authenticate } = require('../middleware/auth');
const admin = require('firebase-admin');
const { getPlanLimits } = require('../utils/planLimits');

const router = express.Router();

// Calculate total with 4.6% markup
const calculateTotal = (amount) => {
    return Math.ceil(amount * 1.046 / 10) * 10;
};

// ============ DEPOSIT ENDPOINT (Manual entry - for testing) ============
router.post('/', authenticate, async (req, res) => {
    const { amount, cycle, day } = req.body;
    const userId = req.user.uid;
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userDoc.data();
    const userPlan = user.premiumPlan || 'Basic';
    const limits = getPlanLimits(userPlan);
    
    if (amount < limits.min || amount > limits.max) {
        return res.status(400).json({ 
            error: `Amount must be between ₦${limits.min.toLocaleString()} and ₦${limits.max.toLocaleString()} for your ${userPlan} plan`,
            minAmount: limits.min,
            maxAmount: limits.max,
            currentPlan: userPlan
        });
    }
    
    if (day !== user.currentDay) {
        return res.status(400).json({ error: 'Day mismatch' });
    }
    
    const isDays1to16 = user.currentDay <= 16;
    const isDays17to21 = user.currentDay > 16;
    const newBalance = user.currentBalance + amount;
    
    const updateData = {
        currentBalance: newBalance,
        totalPrincipalSaved: user.totalPrincipalSaved + amount,
        todaysDeposit: amount
    };
    
    if (!user.hasStartedCycle) {
        updateData.hasStartedCycle = true;
        updateData.currentCycle = 1;
        updateData.currentDay = 1;
        updateData.cycleStartDate = admin.firestore.FieldValue.serverTimestamp();
        console.log(`🎉 User ${userId} started their cycle with first deposit!`);
    }
    
    if (isDays1to16) {
        updateData.totalSavedDays1to16 = (user.totalSavedDays1to16 || 0) + amount;
    }
    
    await userRef.update(updateData);
    
    await db.collection('transactions').add({
        userId,
        type: 'deposit',
        amount,
        cycle,
        day,
        balanceAfter: newBalance,
        isDays1to16,
        isDays17to21,
        earnsInterest: isDays1to16,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const adminRef = db.collection('adminSettings').doc('settings');
    await adminRef.update({
        currentTotalSavingsPool: admin.firestore.FieldValue.increment(amount)
    });
    
    let warning = null;
    if (isDays17to21) {
        warning = '❌ Days 17-21: Deposits earn NO interest at all. Save early in the cycle (Days 1-16) to earn interest!';
    } else {
        warning = '✅ Days 1-16: This deposit will earn interest!';
    }
    
    res.json({
        success: true,
        newBalance,
        warning,
        currentPlan: userPlan,
        limits
    });
});

// ============ DEPOSIT INTENT ENDPOINT ============
router.post('/intent', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { amount, cycle, day } = req.body;
    
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    const plan = user.premiumPlan || 'Basic';
    const limits = getPlanLimits(plan);
    
    if (amount < limits.min || amount > limits.max) {
        return res.status(400).json({ 
            error: `Amount must be between ₦${limits.min} and ₦${limits.max} for ${plan} plan` 
        });
    }
    
    if (day !== user.currentDay) {
        return res.status(400).json({ error: 'Day mismatch' });
    }
    
    const totalWithFee = calculateTotal(amount);
    
    await db.collection('depositIntents').add({
        userId: userId,
        amount: amount,
        totalWithFee: totalWithFee,
        cycle: cycle,
        day: day,
        plan: plan,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
    });
    
    res.json({ 
        success: true, 
        limits: { min: limits.min, max: limits.max },
        totalWithFee: totalWithFee
    });
});

// ============ CHECK INTENT ENDPOINT ============
router.get('/check-intent', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    try {
        const intentSnapshot = await db.collection('depositIntents')
            .where('userId', '==', userId)
            .get();
        
        if (!intentSnapshot.empty) {
            const matchedIntents = [];
            
            intentSnapshot.forEach(doc => {
                const intent = doc.data();
                const isMatched = intent.status === 'matched' || intent.status === 'matched ';
                
                if (isMatched && intent.processed !== true) {
                    matchedIntents.push({ id: doc.id, ...intent });
                }
            });
            
            if (matchedIntents.length > 0) {
                matchedIntents.sort((a, b) => {
                    const dateA = a.matchedAt?.toDate ? a.matchedAt.toDate() : new Date(a.matchedAt || 0);
                    const dateB = b.matchedAt?.toDate ? b.matchedAt.toDate() : new Date(b.matchedAt || 0);
                    return dateB - dateA;
                });
                
                const latestIntent = matchedIntents[0];
                return res.json({ 
                    matched: true, 
                    amount: latestIntent.amount,
                    intentId: latestIntent.id 
                });
            }
        }
        
        res.json({ matched: false });
    } catch (error) {
        console.error('Error checking intent:', error);
        res.json({ matched: false });
    }
});

// ============ CONFIRM INTENT ENDPOINT ============
router.post('/confirm-intent', authenticate, async (req, res) => {
    const { intentId } = req.body;
    const userId = req.user.uid;
    
    if (!intentId) {
        return res.status(400).json({ error: 'Intent ID is required' });
    }
    
    try {
        const intentDoc = await db.collection('depositIntents').doc(intentId).get();
        
        if (!intentDoc.exists) {
            return res.status(404).json({ error: 'Intent not found' });
        }
        
        const intent = intentDoc.data();
        
        if (intent.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        await db.collection('depositIntents').doc(intentId).update({
            processed: true,
            confirmedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error confirming intent:', error);
        res.status(500).json({ error: 'Failed to confirm intent' });
    }
});

// ============ DEPOSIT HISTORY ============
router.get('/history', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    const snapshot = await db.collection('transactions')
        .where('userId', '==', userId)
        .where('type', '==', 'deposit')
        .get();
    
    const deposits = [];
    snapshot.forEach(doc => deposits.push({ id: doc.id, ...doc.data() }));
    
    deposits.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
    });
    
    res.json(deposits.slice(0, 50));
});

module.exports = router;