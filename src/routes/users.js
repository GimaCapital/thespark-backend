// const express = require('express');
// const { db } = require('../services/firebase');
// const { authenticate } = require('../middleware/auth');

// const router = express.Router();

// router.get('/me', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     const userDoc = await db.collection('users').doc(userId).get();
    
//     if (!userDoc.exists) {
//         return res.status(404).json({ error: 'User not found' });
//     }
    
//     const user = userDoc.data();
    
//     const messageQuery = await db.collection('dailyMessages')
//         .where('cycle', '==', user.currentCycle)
//         .where('day', '==', user.currentDay)
//         .limit(1)
//         .get();
    
//     let todayMessage = null;
//     if (!messageQuery.empty) {
//         todayMessage = messageQuery.docs[0].data();
//     }
    
//     res.json({
//         ...user,
//         userId: userDoc.id,
//         todayMessage
//     });
// });

// router.get('/transactions', authenticate, async (req, res) => {
//     const userId = req.user.uid;
//     const { limit = 50 } = req.query;
    
//     const snapshot = await db.collection('transactions')
//         .where('userId', '==', userId)
//         .orderBy('createdAt', 'desc')
//         .limit(parseInt(limit))
//         .get();
    
//     const transactions = [];
//     snapshot.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));
    
//     res.json(transactions);
// });

// router.get('/interest-history', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     const snapshot = await db.collection('interestPayments')
//         .where('userId', '==', userId)
//         .orderBy('paidDate', 'desc')
//         .limit(20)
//         .get();
    
//     const payments = [];
//     snapshot.forEach(doc => payments.push({ id: doc.id, ...doc.data() }));
    
//     res.json(payments);
// });

// router.get('/referrals', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     const snapshot = await db.collection('referrals')
//         .where('referrerId', '==', userId)
//         .get();
    
//     const referrals = [];
//     let totalRewards = 0;
    
//     for (const doc of snapshot.docs) {
//         const referral = doc.data();
//         totalRewards += referral.rewardAmount;
        
//         const referredUser = await db.collection('users').doc(referral.referredId).get();
//         referrals.push({
//             ...referral,
//             referredName: referredUser.exists ? referredUser.data().fullName : 'Unknown',
//             referredPhone: referredUser.exists ? referredUser.data().phone : 'Unknown'
//         });
//     }
    
//     res.json({
//         totalReferrals: referrals.length,
//         totalRewards,
//         referrals
//     });
// });

// module.exports = router;



const express = require('express');
const { db } = require('../services/firebase');
const admin = require('firebase-admin');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userDoc.data();
    
    // ✅ FIX: For old users without hasStartedCycle, check if currentDay > 0
    const hasStarted = user.hasStartedCycle === true || user.currentDay > 0;
    
    let messageQuery;
    if (!hasStarted) {
        // User is on Day 0 - get welcome message
        console.log(`📖 User ${userId} is on Day 0 - showing welcome message`);
        messageQuery = await db.collection('dailyMessages')
            .where('cycle', '==', 0)
            .where('day', '==', 0)
            .limit(1)
            .get();
    } else {
        // User is on Day 1+ - get their current message
        console.log(`📖 User ${userId} is on Day ${user.currentDay}, Cycle ${user.currentCycle}`);
        messageQuery = await db.collection('dailyMessages')
            .where('cycle', '==', user.currentCycle)
            .where('day', '==', user.currentDay)
            .limit(1)
            .get();
    }
    
    let todayMessage = null;
    if (!messageQuery.empty) {
        todayMessage = messageQuery.docs[0].data();
    } else {
        console.log(`⚠️ No message found for Day ${user.currentDay}, Cycle ${user.currentCycle}`);
    }
    
    res.json({
        ...user,
        userId: userDoc.id,
        todayMessage
    });
});

router.get('/transactions', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { limit = 50 } = req.query;
    
    const snapshot = await db.collection('transactions')
        .where('userId', '==', userId)
        .get();
    
    const transactions = [];
    snapshot.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));
    
    transactions.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
    });
    
    res.json(transactions.slice(0, parseInt(limit)));
});

router.get('/interest-history', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    const snapshot = await db.collection('interestPayments')
        .where('userId', '==', userId)
        .get();
    
    const payments = [];
    snapshot.forEach(doc => payments.push({ id: doc.id, ...doc.data() }));
    
    payments.sort((a, b) => {
        const dateA = a.paidDate?.toDate ? a.paidDate.toDate() : new Date(a.paidDate || 0);
        const dateB = b.paidDate?.toDate ? b.paidDate.toDate() : new Date(b.paidDate || 0);
        return dateB - dateA;
    });
    
    res.json(payments.slice(0, 20));
});

router.get('/referrals', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    const snapshot = await db.collection('referrals')
        .where('referrerId', '==', userId)
        .get();
    
    const referrals = [];
    let totalRewards = 0;
    
    for (const doc of snapshot.docs) {
        const referral = doc.data();
        totalRewards += referral.rewardAmount;
        
        const referredUser = await db.collection('users').doc(referral.referredId).get();
        referrals.push({
            ...referral,
            referredName: referredUser.exists ? referredUser.data().fullName : 'Unknown',
            referredPhone: referredUser.exists ? referredUser.data().phone : 'Unknown'
        });
    }
    
    res.json({
        totalReferrals: referrals.length,
        totalRewards,
        referrals
    });
});

router.post('/save-fcm-token', authenticate, async (req, res) => {
    const { fcmToken } = req.body;
    const userId = req.user.uid;
    
    if (!fcmToken) {
        return res.status(400).json({ error: 'No token provided' });
    }
    
    try {
        await db.collection('users').doc(userId).update({
            fcmToken: fcmToken,
            fcmTokenUpdatedAt: new Date()
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving FCM token:', error);
        res.status(500).json({ error: 'Failed to save token' });
    }
});

router.get('/bank-account', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userDoc.data();
        
        if (user.bankCode && user.accountNumber) {
            return res.json({
                success: true,
                hasAccount: true,
                bankCode: user.bankCode,
                bankName: user.bankName,
                accountNumber: user.accountNumber,
                accountName: user.accountName,
                bankAccountUpdatedAt: user.bankAccountUpdatedAt || null
            });
        }
        
        res.json({ success: true, hasAccount: false });
    } catch (error) {
        console.error('Error getting bank account:', error);
        res.status(500).json({ error: 'Failed to get bank account' });
    }
});

router.post('/bank-account', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { bankCode, bankName, accountNumber, accountName } = req.body;
    
    if (!bankCode || !bankName || !accountNumber || !accountName) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (accountNumber.length !== 10) {
        return res.status(400).json({ error: 'Account number must be 10 digits' });
    }
    
    try {
        await db.collection('users').doc(userId).update({
            bankCode: bankCode,
            bankName: bankName,
            accountNumber: accountNumber,
            accountName: accountName.toUpperCase(),
            bankAccountUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ success: true, message: 'Bank account added successfully' });
    } catch (error) {
        console.error('Error saving bank account:', error);
        res.status(500).json({ error: 'Failed to save bank account' });
    }
});

router.delete('/bank-account', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    try {
        await db.collection('users').doc(userId).update({
            bankCode: null,
            bankName: null,
            accountNumber: null,
            accountName: null,
            bankAccountUpdatedAt: null
        });
        
        res.json({ success: true, message: 'Bank account removed successfully' });
    } catch (error) {
        console.error('Error removing bank account:', error);
        res.status(500).json({ error: 'Failed to remove bank account' });
    }
});

router.post('/update-bvn', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const { bvn } = req.body;
    
    try {
        if (!bvn || bvn.length !== 11 || !/^\d+$/.test(bvn)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid BVN format. Must be 11 digits.' 
            });
        }
        
        await db.collection('users').doc(userId).update({
            bvn: bvn,
            bvnUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        res.json({ 
            success: true, 
            message: 'BVN updated successfully',
            data: { bvn: userData.bvn }
        });
    } catch (error) {
        console.error('Error updating BVN:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update BVN' 
        });
    }
});

router.delete('/delete-bvn', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    try {
        await db.collection('users').doc(userId).update({
            bvn: null,
            bvnDeletedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ 
            success: true, 
            message: 'BVN deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting BVN:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete BVN' 
        });
    }
});

router.get('/bvn-status', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        res.json({
            success: true,
            data: {
                hasBvn: !!userData?.bvn,
                bvn: userData?.bvn || null,
                hasVirtualAccount: !!userData?.flwAccountNumber,
                flwAccountNumber: userData?.flwAccountNumber || null,
                flwBankName: userData?.flwBankName || null
            }
        });
    } catch (error) {
        console.error('Error getting BVN status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get BVN status' 
        });
    }
});

module.exports = router;