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
const REFERRAL_CONSTANTS = require('../utils/referralConstants.cjs');
const { sendWelcomeEmail } = require('../services/emailService');

const router = express.Router();

// ============ REFERRAL PROCESSING ENDPOINT ============
router.post('/process-referral', authenticate, async (req, res) => {
    const { referralCode } = req.body;
    const userId = req.user.uid;
    
    console.log('🔍 Processing referral:', { userId, referralCode });
    
    if (!referralCode) {
        return res.json({ success: true, message: 'No referral code provided' });
    }
    
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userData = userDoc.data();
        
        if (userData.referredBy) {
            return res.json({ 
                success: true, 
                message: 'User already has a referrer',
                alreadyReferred: true 
            });
        }
        
        // ✅ Admin SDK way: .where().get()
        const usersRef = db.collection('users');
        const querySnapshot = await usersRef.where('referralCode', '==', referralCode).get();
        
        if (querySnapshot.empty) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid referral code' 
            });
        }
        
        const referrerDoc = querySnapshot.docs[0];
        const referrerId = referrerDoc.id;
        
        if (referrerId === userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'You cannot refer yourself' 
            });
        }
        
        const existingRefQuery = await db.collection('referrals')
            .where('referredId', '==', userId)
            .get();
        
        if (!existingRefQuery.empty) {
            return res.json({ 
                success: true, 
                message: 'Referral already processed',
                alreadyReferred: true 
            });
        }
        
        await db.runTransaction(async (transaction) => {
            const freshUserDoc = await transaction.get(userRef);
            const freshUserData = freshUserDoc.data();
            
            if (freshUserData.referredBy) {
                return;
            }
            
            transaction.update(userRef, {
                referredBy: referrerId,
                currentBalance: admin.firestore.FieldValue.increment(REFERRAL_CONSTANTS.NEW_USER_BONUS),
                totalPrincipalSaved: admin.firestore.FieldValue.increment(REFERRAL_CONSTANTS.NEW_USER_BONUS)
            });
            
            const referralRef = db.collection('referrals').doc();
            transaction.set(referralRef, {
                referrerId: referrerId,
                referredId: userId,
                newUserBonus: REFERRAL_CONSTANTS.NEW_USER_BONUS,
                referrerBonus: REFERRAL_CONSTANTS.REFERRER_BONUS,
                newUserPaid: true,
                referrerPaid: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            const txRef = db.collection('transactions').doc();
            transaction.set(txRef, {
                userId: userId,
                type: REFERRAL_CONSTANTS.TRANSACTION_TYPES.NEW_USER,
                amount: REFERRAL_CONSTANTS.NEW_USER_BONUS,
                description: `${REFERRAL_CONSTANTS.DESCRIPTIONS.NEW_USER} from ${referrerDoc.data().fullName}`,
                balanceAfter: (freshUserData.currentBalance || 0) + REFERRAL_CONSTANTS.NEW_USER_BONUS,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        
        console.log('✅ Referral processed successfully for user:', userId);
        res.json({ 
            success: true, 
            message: 'Referral processed successfully',
            bonus: REFERRAL_CONSTANTS.NEW_USER_BONUS
        });
        
    } catch (error) {
        console.error('Error processing referral:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process referral' 
        });
    }
});

// ============ RETRY REFERRAL ============
router.post('/retry-referral', authenticate, async (req, res) => {
    const { referralCode } = req.body;
    const userId = req.user.uid;
    
    console.log('🔄 Retrying referral for user:', { userId, referralCode });
    
    if (!referralCode) {
        return res.status(400).json({ error: 'Referral code required' });
    }
    
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userData = userDoc.data();
        
        if (userData.referredBy) {
            return res.json({ 
                success: true, 
                message: 'User already has a referrer',
                alreadyReferred: true 
            });
        }
        
        // ✅ Admin SDK way: .where().get()
        const usersRef = db.collection('users');
        const querySnapshot = await usersRef.where('referralCode', '==', referralCode).get();
        
        if (querySnapshot.empty) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid referral code' 
            });
        }
        
        const referrerDoc = querySnapshot.docs[0];
        const referrerId = referrerDoc.id;
        
        if (referrerId === userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'You cannot refer yourself' 
            });
        }
        
        await db.runTransaction(async (transaction) => {
            const freshUserDoc = await transaction.get(userRef);
            const freshUserData = freshUserDoc.data();
            
            if (freshUserData.referredBy) {
                return;
            }
            
            transaction.update(userRef, {
                referredBy: referrerId,
                currentBalance: admin.firestore.FieldValue.increment(REFERRAL_CONSTANTS.NEW_USER_BONUS),
                totalPrincipalSaved: admin.firestore.FieldValue.increment(REFERRAL_CONSTANTS.NEW_USER_BONUS)
            });
            
            const referralRef = db.collection('referrals').doc();
            transaction.set(referralRef, {
                referrerId: referrerId,
                referredId: userId,
                newUserBonus: REFERRAL_CONSTANTS.NEW_USER_BONUS,
                referrerBonus: REFERRAL_CONSTANTS.REFERRER_BONUS,
                newUserPaid: true,
                referrerPaid: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            const txRef = db.collection('transactions').doc();
            transaction.set(txRef, {
                userId: userId,
                type: REFERRAL_CONSTANTS.TRANSACTION_TYPES.NEW_USER,
                amount: REFERRAL_CONSTANTS.NEW_USER_BONUS,
                description: `${REFERRAL_CONSTANTS.DESCRIPTIONS.NEW_USER} from ${referrerDoc.data().fullName}`,
                balanceAfter: (freshUserData.currentBalance || 0) + REFERRAL_CONSTANTS.NEW_USER_BONUS,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        
        console.log('✅ Referral retry successful for user:', userId);
        res.json({ 
            success: true, 
            message: 'Referral processed successfully',
            bonus: REFERRAL_CONSTANTS.NEW_USER_BONUS
        });
        
    } catch (error) {
        console.error('Error retrying referral:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process referral' 
        });
    }
});

// ============ SEND WELCOME EMAIL ============
router.post('/send-welcome-email', authenticate, async (req, res) => {
    const { email, fullName } = req.body;
    const userId = req.user.uid;
    
    console.log('📧 Welcome email request received:', { email, fullName, userId });
    
    if (!email) {
        console.error('❌ No email provided');
        return res.status(400).json({ 
            success: false, 
            error: 'Email is required' 
        });
    }
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            console.error('❌ User not found:', userId);
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        console.log('✅ User found, sending welcome email...');
        
        const result = await sendWelcomeEmail(
            email, 
            fullName || userDoc.data().fullName || 'Saver',
            userId
        );
        
        await db.collection('users').doc(userId).update({
            welcomeEmailSent: result.success,
            welcomeEmailSentAt: result.success ? new Date().toISOString() : null,
            welcomeEmailAttempts: result.attempts || 0,
            welcomeEmailError: result.success ? null : (result.error || null),
            welcomeEmailMessageId: result.messageId || null,
            updatedAt: new Date().toISOString()
        });
        
        await db.collection('emailLogs').add({
            userId: userId,
            email: email,
            type: 'welcome',
            success: result.success,
            messageId: result.messageId || null,
            attempts: result.attempts || 0,
            error: result.error || null,
            sentAt: new Date().toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        if (result.success) {
            console.log('✅ Welcome email sent successfully to:', email);
            res.json({ 
                success: true, 
                message: 'Welcome email sent',
                data: {
                    messageId: result.messageId,
                    sentAt: result.sentAt
                }
            });
        } else {
            console.error('❌ Failed to send welcome email to:', email, result.error);
            res.status(500).json({ 
                success: false, 
                error: result.error || 'Failed to send welcome email' 
            });
        }
    } catch (error) {
        console.error('❌ Error sending welcome email:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send welcome email' 
        });
    }
});

// ============ RETRY WELCOME EMAIL ============
router.post('/retry-welcome-email', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    console.log('📧 Retry welcome email request for userId:', userId);
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userDoc.data();
        
        if (!user.email) {
            return res.status(400).json({ error: 'User has no email address' });
        }
        
        console.log('📧 Retrying welcome email for:', user.email);
        
        const result = await sendWelcomeEmail(
            user.email,
            user.fullName || 'Saver',
            userId,
            3
        );
        
        await db.collection('users').doc(userId).update({
            welcomeEmailSent: result.success,
            welcomeEmailSentAt: result.success ? new Date().toISOString() : null,
            welcomeEmailAttempts: (user.welcomeEmailAttempts || 0) + 1,
            welcomeEmailError: result.success ? null : (result.error || null),
            welcomeEmailMessageId: result.messageId || null,
            welcomeEmailRetried: true,
            welcomeEmailRetriedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        
        await db.collection('emailLogs').add({
            userId: userId,
            email: user.email,
            type: 'welcome_retry',
            success: result.success,
            messageId: result.messageId || null,
            attempts: result.attempts || 1,
            error: result.error || null,
            sentAt: new Date().toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        if (result.success) {
            console.log('✅ Welcome email retry successful for:', user.email);
            res.json({ 
                success: true, 
                message: 'Welcome email sent successfully' 
            });
        } else {
            console.error('❌ Welcome email retry failed for:', user.email, result.error);
            res.status(500).json({ 
                success: false, 
                error: result.error || 'Failed to send welcome email' 
            });
        }
    } catch (error) {
        console.error('Error retrying welcome email:', error);
        res.status(500).json({ error: 'Failed to send welcome email' });
    }
});

// ============ GET EMAIL LOGS (Admin only) ============
router.get('/email-logs', authenticate, async (req, res) => {
    try {
        const adminDoc = await db.collection('users').doc(req.user.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const snapshot = await db.collection('emailLogs')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        
        const logs = [];
        snapshot.forEach(doc => {
            logs.push({ 
                id: doc.id, 
                ...doc.data() 
            });
        });
        
        res.json(logs);
    } catch (error) {
        console.error('Error fetching email logs:', error);
        res.status(500).json({ error: 'Failed to fetch email logs' });
    }
});

// ============ GET USER EMAIL STATUS (Admin only) ============
router.get('/user-email-status/:userId', authenticate, async (req, res) => {
    const { userId } = req.params;
    
    try {
        const adminDoc = await db.collection('users').doc(req.user.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userDoc.data();
        
        res.json({
            userId: userId,
            email: user.email,
            fullName: user.fullName,
            welcomeEmailSent: user.welcomeEmailSent || false,
            welcomeEmailSentAt: user.welcomeEmailSentAt || null,
            welcomeEmailAttempts: user.welcomeEmailAttempts || 0,
            welcomeEmailError: user.welcomeEmailError || null,
            welcomeEmailMessageId: user.welcomeEmailMessageId || null
        });
    } catch (error) {
        console.error('Error fetching user email status:', error);
        res.status(500).json({ error: 'Failed to fetch email status' });
    }
});

// ============ RESEND WELCOME EMAIL (Admin only) ============
router.post('/resend-welcome-email', authenticate, async (req, res) => {
    const { userId } = req.body;
    
    console.log('📧 Resend welcome email request for userId:', userId);
    
    try {
        const adminDoc = await db.collection('users').doc(req.user.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userDoc.data();
        
        if (!user.email) {
            return res.status(400).json({ error: 'User has no email address' });
        }
        
        console.log('📧 Sending welcome email to:', user.email);
        
        const result = await sendWelcomeEmail(
            user.email,
            user.fullName || 'Saver',
            userId,
            3
        );
        
        await db.collection('users').doc(userId).update({
            welcomeEmailSent: result.success,
            welcomeEmailSentAt: result.success ? new Date().toISOString() : null,
            welcomeEmailAttempts: result.attempts || 0,
            welcomeEmailError: result.success ? null : (result.error || null),
            welcomeEmailMessageId: result.messageId || null,
            welcomeEmailResent: true,
            welcomeEmailResentAt: new Date().toISOString(),
            welcomeEmailResentBy: req.user.uid
        });
        
        await db.collection('emailLogs').add({
            userId: userId,
            email: user.email,
            type: 'welcome_resend',
            success: result.success,
            messageId: result.messageId || null,
            attempts: result.attempts || 0,
            error: result.error || null,
            resentBy: req.user.uid,
            sentAt: new Date().toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({
            success: result.success,
            message: result.success ? 'Welcome email resent successfully' : 'Failed to resend welcome email',
            data: {
                messageId: result.messageId,
                attempts: result.attempts,
                error: result.error || null
            }
        });
    } catch (error) {
        console.error('Error resending welcome email:', error);
        res.status(500).json({ error: 'Failed to resend welcome email' });
    }
});

// ============ SEND BULK WELCOME EMAILS (Admin only) ============
router.post('/send-bulk-welcome-emails', authenticate, async (req, res) => {
    try {
        const adminDoc = await db.collection('users').doc(req.user.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const usersSnapshot = await db.collection('users')
            .where('welcomeEmailSent', '==', false)
            .get();
        
        if (usersSnapshot.empty) {
            return res.json({ 
                success: true, 
                message: 'All users have already received welcome emails',
                sentCount: 0,
                failedCount: 0
            });
        }
        
        let sentCount = 0;
        let failedCount = 0;
        const failedUsers = [];
        
        for (const doc of usersSnapshot.docs) {
            const user = doc.data();
            const userId = doc.id;
            
            if (!user.email) {
                failedCount++;
                failedUsers.push({ userId, email: user.email || 'No email', reason: 'No email address' });
                continue;
            }
            
            try {
                const result = await sendWelcomeEmail(
                    user.email,
                    user.fullName || 'Saver',
                    userId
                );
                
                if (result.success) {
                    await db.collection('users').doc(userId).update({
                        welcomeEmailSent: true,
                        welcomeEmailSentAt: new Date().toISOString(),
                        welcomeEmailAttempts: result.attempts || 1,
                        welcomeEmailError: null,
                        welcomeEmailMessageId: result.messageId || null
                    });
                    
                    await db.collection('emailLogs').add({
                        userId: userId,
                        email: user.email,
                        type: 'welcome_bulk',
                        success: true,
                        messageId: result.messageId || null,
                        attempts: result.attempts || 1,
                        error: null,
                        sentAt: new Date().toISOString(),
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    sentCount++;
                    console.log(`✅ Welcome email sent to: ${user.email}`);
                } else {
                    failedCount++;
                    failedUsers.push({ userId, email: user.email, reason: result.error || 'Unknown error' });
                    console.error(`❌ Failed to send email to: ${user.email}`);
                    
                    await db.collection('emailLogs').add({
                        userId: userId,
                        email: user.email,
                        type: 'welcome_bulk',
                        success: false,
                        messageId: null,
                        attempts: result.attempts || 1,
                        error: result.error || 'Unknown error',
                        sentAt: new Date().toISOString(),
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (error) {
                failedCount++;
                failedUsers.push({ userId, email: user.email, reason: error.message });
                console.error(`❌ Error sending email to ${user.email}:`, error.message);
            }
        }
        
        res.json({
            success: true,
            message: `Sent ${sentCount} welcome emails, ${failedCount} failed`,
            sentCount: sentCount,
            failedCount: failedCount,
            failedUsers: failedUsers
        });
    } catch (error) {
        console.error('Error sending bulk welcome emails:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send bulk welcome emails' 
        });
    }
});

// ============ GET ALL USERS (Admin only) ============
router.get('/admin/users', authenticate, async (req, res) => {
    try {
        const adminDoc = await db.collection('users').doc(req.user.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const snapshot = await db.collection('users')
            .orderBy('createdAt', 'desc')
            .get();
        
        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            users.push({ 
                id: doc.id,
                userId: doc.id,
                fullName: data.fullName || 'N/A',
                email: data.email || 'N/A',
                phone: data.phone || 'N/A',
                joinDate: data.joinDate || data.createdAt || null,
                currentBalance: data.currentBalance || 0,
                welcomeEmailSent: data.welcomeEmailSent || false,
                welcomeEmailSentAt: data.welcomeEmailSentAt || null,
                welcomeEmailAttempts: data.welcomeEmailAttempts || 0,
                role: data.role || 'user',
                isActive: data.isActive !== undefined ? data.isActive : true,
                createdAt: data.createdAt || null
            });
        });
        
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ============ GET ALL USERS (Alternative) ============
router.get('/all', authenticate, async (req, res) => {
    try {
        const adminDoc = await db.collection('users').doc(req.user.uid).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const snapshot = await db.collection('users')
            .orderBy('createdAt', 'desc')
            .get();
        
        const users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            users.push({ 
                id: doc.id,
                userId: doc.id,
                fullName: data.fullName || 'N/A',
                email: data.email || 'N/A',
                phone: data.phone || 'N/A',
                joinDate: data.joinDate || data.createdAt || null,
                currentBalance: data.currentBalance || 0,
                welcomeEmailSent: data.welcomeEmailSent || false,
                welcomeEmailSentAt: data.welcomeEmailSentAt || null,
                welcomeEmailAttempts: data.welcomeEmailAttempts || 0,
                role: data.role || 'user',
                isActive: data.isActive !== undefined ? data.isActive : true,
                createdAt: data.createdAt || null
            });
        });
        
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ============ GET USER PROFILE ============
router.get('/me', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userDoc.data();
    
    const hasStarted = user.hasStartedCycle === true || user.currentDay > 0;
    
    let messageQuery;
    if (!hasStarted) {
        console.log(`📖 User ${userId} is on Day 0 - showing welcome message`);
        messageQuery = await db.collection('dailyMessages')
            .where('cycle', '==', 0)
            .where('day', '==', 0)
            .limit(1)
            .get();
    } else {
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



// ============ GET TRANSACTIONS ============
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

// ============ GET INTEREST HISTORY ============
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

// ============ GET REFERRALS ============
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

// ============ SAVE FCM TOKEN ============
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

// ============ BANK ACCOUNT ROUTES ============
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

// ============ BVN ROUTES ============
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

// ============================================================
// ✅ GET USER BY ID
// ============================================================
router.get('/:userId', authenticate, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const requesterDoc = await db.collection('users').doc(req.user.uid).get();
        if (!requesterDoc.exists) {
            return res.status(403).json({ error: 'Unauthorized - User not found' });
        }
        
        const requesterData = requesterDoc.data();
        const allowedRoles = ['admin', 'agent'];
        
        if (req.user.uid !== userId && !allowedRoles.includes(requesterData.role)) {
            return res.status(403).json({ error: 'Unauthorized - Insufficient permissions' });
        }
        
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userData = userDoc.data();
        
        res.json({
            id: userDoc.id,
            fullName: userData.fullName || userData.name || 'User',
            email: userData.email || '',
            phone: userData.phone || '',
            role: userData.role || 'user',
            currentBalance: userData.currentBalance || 0,
            bvn: userData.bvn || null,
            createdAt: userData.createdAt || null,
            joinDate: userData.joinDate || userData.createdAt || null,
            isActive: userData.isActive !== undefined ? userData.isActive : true,
            referralCode: userData.referralCode || null,
            referredBy: userData.referredBy || null
        });
        
    } catch (error) {
        console.error('❌ Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user: ' + error.message });
    }
});

module.exports = router;