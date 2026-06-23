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
const { calculateWithdrawalFee } = require('../utils/feeUtils');

const router = express.Router();

// ============ HELPER FUNCTION ============
const createNotification = async (userId, title, message, type) => {
    try {
        await db.collection('notifications').add({
            userId: userId,
            title: title,
            message: message,
            type: type,
            read: false,
            createdAt: new Date()
        });
        console.log(`📢 Notification sent to ${userId}: ${title}`);
    } catch (error) {
        console.error('Failed to send notification:', error);
    }
};

// ============ GET WITHDRAWAL FEE ESTIMATE ============
router.get('/fee', authenticate, async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Error calculating fee:', error);
        res.status(500).json({ error: 'Failed to calculate fee' });
    }
});

// ============ CREATE WITHDRAWAL REQUEST ============
router.post('/request', authenticate, async (req, res) => {
    try {
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
        
        // Calculate fee
        const feeDetails = calculateWithdrawalFee(amount);
        const totalDeduction = amount + feeDetails.totalFee;
        
        // Check if user has enough balance
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
        
        // ✅ Notify admins about new request
        try {
            const adminsSnapshot = await db.collection('users')
                .where('role', '==', 'admin')
                .get();
            
            for (const adminDoc of adminsSnapshot.docs) {
                const adminData = adminDoc.data();
                if (adminData.fcmToken) {
                    await createNotification(
                        adminDoc.id,
                        '💰 New Withdrawal Request',
                        `${user.fullName || 'User'} requested ₦${amount.toLocaleString()} withdrawal.`,
                        'admin_withdrawal_request'
                    );
                }
            }
        } catch (notifyError) {
            console.error('Failed to notify admins:', notifyError);
            // Don't fail the request if notification fails
        }
        
        res.json({
            success: true,
            requestId: requestRef.id,
            message: 'Withdrawal request submitted for approval',
            warning,
            feeDetails,
            totalDeduction
        });
    } catch (error) {
        console.error('Error creating withdrawal request:', error);
        res.status(500).json({ error: 'Failed to create withdrawal request' });
    }
});

// ============ GET USER WITHDRAWAL REQUESTS ============
router.get('/requests', authenticate, async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Error fetching withdrawal requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// ============ ADMIN: APPROVE WITHDRAWAL ============
router.post('/approve/:requestId', authenticate, async (req, res) => {
    const { requestId } = req.params;
    const adminId = req.user.uid;
    
    // ✅ Declare variables OUTSIDE try block for catch access
    let request = null;
    let requestRef = null;
    let user = null;
    let userRef = null;
    
    try {
        // Check admin
        const adminDoc = await db.collection('users').doc(adminId).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        // Get withdrawal request
        requestRef = db.collection('withdrawalRequests').doc(requestId);
        const requestDoc = await requestRef.get();
        
        if (!requestDoc.exists) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        request = requestDoc.data();
        
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request already processed' });
        }
        
        // Get user
        userRef = db.collection('users').doc(request.userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            await requestRef.update({
                status: 'rejected',
                reason: 'User account no longer exists',
                processedAt: new Date(),
                processedBy: adminId
            });
            return res.status(404).json({ error: 'User not found' });
        }
        
        user = userDoc.data();
        
        // Use totalDeduction (amount + fee)
        const totalDeduction = request.totalDeduction || request.amount;
        
        if (totalDeduction > user.currentBalance) {
            await requestRef.update({
                status: 'rejected',
                reason: 'Insufficient balance',
                processedAt: new Date(),
                processedBy: adminId
            });
            
            await createNotification(
                request.userId,
                '❌ Withdrawal Rejected',
                `Your withdrawal of ₦${request.amount.toLocaleString()} was rejected due to insufficient balance.`,
                'withdrawal_rejected'
            );
            
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
        
        // ✅ Send notification to user
        await createNotification(
            request.userId,
            '✅ Withdrawal Approved',
            `Your withdrawal of ₦${request.amount.toLocaleString()} has been approved.`,
            'withdrawal_approved'
        );
        
        res.json({ success: true, message: 'Withdrawal approved' });
    } catch (error) {
        console.error('Error approving withdrawal:', error);
        
        // ✅ Send failure notification to user
        try {
            if (request && request.userId) {
                await createNotification(
                    request.userId,
                    '❌ Withdrawal Failed',
                    `Your withdrawal of ₦${request.amount ? request.amount.toLocaleString() : 'unknown'} failed to process. Please contact support.`,
                    'withdrawal_failed'
                );
            }
        } catch (notifyError) {
            console.error('Failed to send notification:', notifyError);
        }
        
        // ✅ Update request status if possible
        try {
            if (requestRef) {
                await requestRef.update({
                    status: 'failed',
                    error: error.message,
                    processedAt: new Date(),
                    processedBy: adminId
                });
            }
        } catch (updateError) {
            console.error('Failed to update request:', updateError);
        }
        
        res.status(500).json({ error: 'Failed to approve withdrawal' });
    }
});

// ============ ADMIN: REJECT WITHDRAWAL ============
router.post('/reject/:requestId', authenticate, async (req, res) => {
    const { requestId } = req.params;
    const adminId = req.user.uid;
    const { reason } = req.body;
    
    // ✅ Declare variables OUTSIDE try block for catch access
    let request = null;
    let requestRef = null;
    
    try {
        // Check admin
        const adminDoc = await db.collection('users').doc(adminId).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        // Get withdrawal request
        requestRef = db.collection('withdrawalRequests').doc(requestId);
        const requestDoc = await requestRef.get();
        
        if (!requestDoc.exists) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        request = requestDoc.data();
        
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request already processed' });
        }
        
        const rejectionReason = reason || 'Not specified';
        
        await requestRef.update({
            status: 'rejected',
            reason: rejectionReason,
            processedAt: new Date(),
            processedBy: adminId
        });
        
        // ✅ Send notification to user
        await createNotification(
            request.userId,
            '❌ Withdrawal Rejected',
            `Your withdrawal of ₦${request.amount.toLocaleString()} was rejected. Reason: ${rejectionReason}`,
            'withdrawal_rejected'
        );
        
        res.json({ 
            success: true, 
            message: 'Withdrawal rejected',
            reason: rejectionReason
        });
    } catch (error) {
        console.error('Error rejecting withdrawal:', error);
        
        // ✅ Send failure notification to user
        try {
            if (request && request.userId) {
                await createNotification(
                    request.userId,
                    '❌ Withdrawal Failed',
                    `Your withdrawal of ₦${request.amount ? request.amount.toLocaleString() : 'unknown'} failed to process. Please contact support.`,
                    'withdrawal_failed'
                );
            }
        } catch (notifyError) {
            console.error('Failed to send notification:', notifyError);
        }
        
        // ✅ Update request status if possible
        try {
            if (requestRef) {
                await requestRef.update({
                    status: 'failed',
                    error: error.message,
                    processedAt: new Date(),
                    processedBy: adminId
                });
            }
        } catch (updateError) {
            console.error('Failed to update request:', updateError);
        }
        
        res.status(500).json({ error: 'Failed to reject withdrawal' });
    }
});

module.exports = router;