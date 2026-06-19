// const express = require('express');
// const { db } = require('../services/firebase');
// const { authenticate } = require('../middleware/auth');
// const admin = require('firebase-admin');

// const router = express.Router();

// router.post('/request', authenticate, async (req, res) => {
//     const { amount } = req.body;
//     const userId = req.user.uid;
    
//     const userDoc = await db.collection('users').doc(userId).get();
    
//     if (!userDoc.exists) {
//         return res.status(404).json({ error: 'User not found' });
//     }
    
//     const user = userDoc.data();
    
//     if (amount <= 0 || amount > user.currentBalance) {
//         return res.status(400).json({ error: 'Invalid amount' });
//     }
    
//     if (amount < 10) {
//         return res.status(400).json({ error: 'Minimum withdrawal amount is ₦10' });
//     }
    
//     const isDays17to21 = user.currentDay > 16;
    
//     let warning = null;
//     if (isDays17to21) {
//         warning = '⚠️ Withdrawal in Days 17-21: You are withdrawing money that earned NO interest this cycle.';
//     } else {
//         warning = '⚠️ Withdrawal will reduce your average balance for interest calculation this cycle.';
//     }
    
//     const requestRef = await db.collection('withdrawalRequests').add({
//         userId,
//         amount,
//         requestDay: user.currentDay,
//         cycle: user.currentCycle,
//         status: 'pending',
//         createdAt: admin.firestore.FieldValue.serverTimestamp()
//     });
    
//     res.json({
//         success: true,
//         requestId: requestRef.id,
//         message: 'Withdrawal request submitted for approval',
//         warning
//     });
// });

// router.get('/requests', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     const snapshot = await db.collection('withdrawalRequests')
//         .where('userId', '==', userId)
//         .get();
    
//     const requests = [];
//     snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
    
//     requests.sort((a, b) => {
//         const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
//         const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
//         return dateB - dateA;
//     });
    
//     res.json(requests.slice(0, 20));
// });

// // Admin approval endpoint
// router.post('/approve/:requestId', authenticate, async (req, res) => {
//     const { requestId } = req.params;
//     const adminId = req.user.uid;
    
//     const adminDoc = await db.collection('users').doc(adminId).get();
//     if (adminDoc.data().role !== 'admin') {
//         return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     const requestRef = db.collection('withdrawalRequests').doc(requestId);
//     const requestDoc = await requestRef.get();
    
//     if (!requestDoc.exists) {
//         return res.status(404).json({ error: 'Request not found' });
//     }
    
//     const request = requestDoc.data();
    
//     if (request.status !== 'pending') {
//         return res.status(400).json({ error: 'Request already processed' });
//     }
    
//     const userRef = db.collection('users').doc(request.userId);
//     const userDoc = await userRef.get();
//     const user = userDoc.data();
    
//     if (request.amount > user.currentBalance) {
//         await requestRef.update({
//             status: 'rejected',
//             reason: 'Insufficient balance',
//             processedAt: new Date(),
//             processedBy: adminId
//         });
//         return res.status(400).json({ error: 'Insufficient balance' });
//     }
    
//     await userRef.update({
//         currentBalance: admin.firestore.FieldValue.increment(-request.amount),
//         totalWithdrawn: admin.firestore.FieldValue.increment(request.amount)
//     });
    
//     await requestRef.update({
//         status: 'approved',
//         processedAt: new Date(),
//         processedBy: adminId
//     });
    
//     await db.collection('transactions').add({
//         userId: request.userId,
//         type: 'withdrawal',
//         amount: request.amount,
//         cycle: request.cycle,
//         day: request.requestDay,
//         balanceAfter: user.currentBalance - request.amount,
//         createdAt: admin.firestore.FieldValue.serverTimestamp()
//     });
    
//     res.json({ success: true, message: 'Withdrawal approved' });
// });

// router.post('/reject/:requestId', authenticate, async (req, res) => {
//     const { requestId } = req.params;
//     const adminId = req.user.uid;
//     const { reason } = req.body;
    
//     const adminDoc = await db.collection('users').doc(adminId).get();
//     if (adminDoc.data().role !== 'admin') {
//         return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     const requestRef = db.collection('withdrawalRequests').doc(requestId);
//     const requestDoc = await requestRef.get();
    
//     if (!requestDoc.exists) {
//         return res.status(404).json({ error: 'Request not found' });
//     }
    
//     if (requestDoc.data().status !== 'pending') {
//         return res.status(400).json({ error: 'Request already processed' });
//     }
    
//     await requestRef.update({
//         status: 'rejected',
//         reason: reason || 'Not specified',
//         processedAt: new Date(),
//         processedBy: adminId
//     });
    
//     res.json({ success: true, message: 'Withdrawal rejected' });
// });

// module.exports = router;

const express = require('express');
const { db } = require('../services/firebase');
const { authenticate } = require('../middleware/auth');
const admin = require('firebase-admin');
const { calculateWithdrawalFee } = require('../utils/feeUtils'); // ✅ IMPORT FROM SHARED UTILITY

const router = express.Router();

// ✅ GET withdrawal fee estimate
router.get('/fee', authenticate, async (req, res) => {
    const { amount } = req.query;
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    const feeDetails = calculateWithdrawalFee(parsedAmount);
    res.json({
        success: true,
        ...feeDetails,
        totalDeduction: parsedAmount + feeDetails.totalFee,
        receiveAmount: parsedAmount
    });
});

// ✅ UPDATED: Withdrawal request with fee
router.post('/request', authenticate, async (req, res) => {
    const { amount } = req.body;
    const userId = req.user.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userDoc.data();
    
    if (amount <= 0 || amount > user.currentBalance) {
        return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (amount < 10) {
        return res.status(400).json({ error: 'Minimum withdrawal amount is ₦10' });
    }
    
    // Calculate fee using imported function
    const feeDetails = calculateWithdrawalFee(amount);
    const totalDeduction = amount + feeDetails.totalFee;
    
    // Check if user has enough balance to cover amount + fee
    if (totalDeduction > user.currentBalance) {
        return res.status(400).json({ 
            error: `Insufficient balance. You need ₦${totalDeduction.toFixed(2)} to withdraw ₦${amount} (includes ₦${feeDetails.totalFee.toFixed(2)} fee)` 
        });
    }
    
    const isDays17to21 = user.currentDay > 16;
    
    let warning = null;
    if (isDays17to21) {
        warning = '⚠️ Withdrawal in Days 17-21: You are withdrawing money that earned NO interest this cycle.';
    } else {
        warning = '⚠️ Withdrawal will reduce your average balance for interest calculation this cycle.';
    }
    
    const requestRef = await db.collection('withdrawalRequests').add({
        userId,
        amount,
        totalDeduction,
        fee: feeDetails.fee,
        totalFee: feeDetails.totalFee,
        requestDay: user.currentDay,
        cycle: user.currentCycle,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
        success: true,
        requestId: requestRef.id,
        message: 'Withdrawal request submitted for approval',
        warning,
        feeDetails,
        totalDeduction
    });
});

router.get('/requests', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    const snapshot = await db.collection('withdrawalRequests')
        .where('userId', '==', userId)
        .get();
    
    const requests = [];
    snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
    
    requests.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
    });
    
    res.json(requests.slice(0, 20));
});

// ✅ UPDATED: Admin approval endpoint with fee
router.post('/approve/:requestId', authenticate, async (req, res) => {
    const { requestId } = req.params;
    const adminId = req.user.uid;
    
    const adminDoc = await db.collection('users').doc(adminId).get();
    if (adminDoc.data().role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const requestRef = db.collection('withdrawalRequests').doc(requestId);
    const requestDoc = await requestRef.get();
    
    if (!requestDoc.exists) {
        return res.status(404).json({ error: 'Request not found' });
    }
    
    const request = requestDoc.data();
    
    if (request.status !== 'pending') {
        return res.status(400).json({ error: 'Request already processed' });
    }
    
    const userRef = db.collection('users').doc(request.userId);
    const userDoc = await userRef.get();
    const user = userDoc.data();
    
    // Use totalDeduction (amount + fee)
    const totalDeduction = request.totalDeduction || request.amount;
    
    if (totalDeduction > user.currentBalance) {
        await requestRef.update({
            status: 'rejected',
            reason: 'Insufficient balance',
            processedAt: new Date(),
            processedBy: adminId
        });
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct total (amount + fee)
    await userRef.update({
        currentBalance: admin.firestore.FieldValue.increment(-totalDeduction),
        totalWithdrawn: admin.firestore.FieldValue.increment(request.amount)
    });
    
    await requestRef.update({
        status: 'approved',
        processedAt: new Date(),
        processedBy: adminId
    });
    
    await db.collection('transactions').add({
        userId: request.userId,
        type: 'withdrawal',
        amount: request.amount,
        fee: request.fee || 0,
        totalFee: request.totalFee || 0,
        totalDeduction: totalDeduction,
        cycle: request.cycle,
        day: request.requestDay,
        balanceAfter: user.currentBalance - totalDeduction,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Withdrawal approved' });
});

router.post('/reject/:requestId', authenticate, async (req, res) => {
    const { requestId } = req.params;
    const adminId = req.user.uid;
    const { reason } = req.body;
    
    const adminDoc = await db.collection('users').doc(adminId).get();
    if (adminDoc.data().role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    const requestRef = db.collection('withdrawalRequests').doc(requestId);
    const requestDoc = await requestRef.get();
    
    if (!requestDoc.exists) {
        return res.status(404).json({ error: 'Request not found' });
    }
    
    if (requestDoc.data().status !== 'pending') {
        return res.status(400).json({ error: 'Request already processed' });
    }
    
    await requestRef.update({
        status: 'rejected',
        reason: reason || 'Not specified',
        processedAt: new Date(),
        processedBy: adminId
    });
    
    res.json({ success: true, message: 'Withdrawal rejected' });
});

module.exports = router;