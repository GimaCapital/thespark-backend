// ////////////////////////////////////////////////////////////////////////////////////

// const express = require('express');
// const { db } = require('../services/firebase');
// const { authenticate, isAdmin } = require('../middleware/auth');
// const admin = require('firebase-admin');
// const { calculateWithdrawalFee } = require('../utils/feeUtils'); // ✅ IMPORT FEE UTILITY
// const router = express.Router();

// // ============ HELPER FUNCTION ============
// const createNotification = async (userId, title, message, type) => {
//     try {
//         await db.collection('notifications').add({
//             userId: userId,
//             title: title,
//             message: message,
//             type: type,
//             read: false,
//             createdAt: new Date()
//         });
//         console.log(`📢 Notification sent to ${userId}: ${title}`);
//     } catch (error) {
//         console.error('Failed to send notification:', error);
//     }
// };

// router.use(authenticate, isAdmin);

// router.get('/users', async (req, res) => {
//     const snapshot = await db.collection('users').get();
    
//     const users = [];
//     snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
    
//     // Sort manually by joinDate (newest first)
//     users.sort((a, b) => {
//         const dateA = a.joinDate?.toDate ? a.joinDate.toDate() : new Date(a.joinDate || 0);
//         const dateB = b.joinDate?.toDate ? b.joinDate.toDate() : new Date(b.joinDate || 0);
//         return dateB - dateA;
//     });
    
//     res.json(users);
// });

// router.get('/users/:userId', async (req, res) => {
//     const { userId } = req.params;
    
//     const userDoc = await db.collection('users').doc(userId).get();
    
//     if (!userDoc.exists) {
//         return res.status(404).json({ error: 'User not found' });
//     }
    
//     const txSnapshot = await db.collection('transactions')
//         .where('userId', '==', userId)
//         .get();
    
//     const transactions = [];
//     txSnapshot.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));
    
//     // Sort manually by createdAt (newest first)
//     transactions.sort((a, b) => {
//         const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
//         const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
//         return dateB - dateA;
//     });
    
//     res.json({
//         user: { id: userId, ...userDoc.data() },
//         transactions: transactions.slice(0, 50)
//     });
// });

// // ✅ UPDATED: Withdrawal approval with fee deduction
// router.post('/withdrawals/:requestId/approve', async (req, res) => {
//     const { requestId } = req.params;
//     const adminId = req.user.uid;
//     const axios = require('axios');
    
//     // 1. Check admin
//     const adminDoc = await db.collection('users').doc(adminId).get();
//     if (adminDoc.data().role !== 'admin') {
//         return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     // 2. Get withdrawal request
//     const requestRef = db.collection('withdrawalRequests').doc(requestId);
//     const requestDoc = await requestRef.get();
    
//     if (!requestDoc.exists) {
//         return res.status(404).json({ error: 'Request not found' });
//     }
    
//     const request = requestDoc.data();
    
//     if (request.status !== 'pending') {
//         return res.status(400).json({ error: 'Request already processed' });
//     }
    
//     // 3. Get user
//     const userRef = db.collection('users').doc(request.userId);
//     const userDoc = await userRef.get();
//     const user = userDoc.data();
    
//     // ✅ Calculate fee using imported function
//     const feeDetails = calculateWithdrawalFee(request.amount);
//     const totalDeduction = request.amount + feeDetails.totalFee;
    
//     if (totalDeduction > user.currentBalance) {
//         await requestRef.update({
//             status: 'rejected',
//             reason: 'Insufficient balance',
//             processedAt: new Date(),
//             processedBy: adminId
//         });
//         return res.status(400).json({ error: 'Insufficient balance' });
//     }
    
//     if (!user.bankCode || !user.accountNumber) {
//         await requestRef.update({
//             status: 'rejected',
//             reason: 'No bank account',
//             processedAt: new Date(),
//             processedBy: adminId
//         });
//         return res.status(400).json({ error: 'User has no bank account' });
//     }
    
//     try {
//         const secretKey = process.env.FLW_SECRET_KEY;
        
//         if (!secretKey) {
//             throw new Error('FLW_SECRET_KEY not configured in .env');
//         }
        
//         console.log('📡 Using FLW_SECRET_KEY for withdrawal');
//         console.log('   Bank Code:', user.bankCode);
//         console.log('   Bank Name:', user.bankName);
//         console.log('   Account:', user.accountNumber);
//         console.log('   Amount: ₦' + request.amount);
//         console.log('   Fee: ₦' + feeDetails.fee);
//         console.log('   Total Deduction: ₦' + totalDeduction);
//         console.log('   Account Name:', user.accountName);
        
//         const reference = `WTH${Date.now()}${request.userId.slice(0, 8)}`;
        
//         // ============ GET OR CREATE BENEFICIARY ============
//         let beneficiaryId = null;
        
//         console.log('📡 Creating beneficiary...');
        
//         try {
//             const beneficiaryRes = await axios.post(
//                 'https://api.flutterwave.com/v3/beneficiaries',
//                 {
//                     account_bank: user.bankCode,
//                     account_number: user.accountNumber,
//                     beneficiary_name: user.accountName,
//                     currency: 'NGN',
//                     bank_name: user.bankName
//                 },
//                 {
//                     headers: {
//                         'Authorization': `Bearer ${secretKey}`,
//                         'Content-Type': 'application/json'
//                     }
//                 }
//             );
            
//             if (beneficiaryRes.data.status === 'success') {
//                 beneficiaryId = beneficiaryRes.data.data.id;
//                 console.log('✅ Beneficiary created:', beneficiaryId);
//             }
//         } catch (createError) {
//             if (createError.response?.data?.message === 'Beneficiary already added to your account') {
//                 console.log('📡 Beneficiary already exists, fetching ID...');
                
//                 try {
//                     const listRes = await axios.get(
//                         'https://api.flutterwave.com/v3/beneficiaries',
//                         {
//                             headers: {
//                                 'Authorization': `Bearer ${secretKey}`,
//                                 'Content-Type': 'application/json'
//                             }
//                         }
//                     );
                    
//                     const existing = listRes.data.data?.find(b => 
//                         b.account_number === user.accountNumber && 
//                         b.bank_code === user.bankCode
//                     );
                    
//                     if (existing) {
//                         beneficiaryId = existing.id;
//                         console.log('✅ Found existing beneficiary:', beneficiaryId);
//                     } else if (listRes.data.data && listRes.data.data.length > 0) {
//                         beneficiaryId = listRes.data.data[0].id;
//                         console.log('✅ Using first available beneficiary:', beneficiaryId);
//                     } else {
//                         throw new Error('No beneficiaries found');
//                     }
//                 } catch (listError) {
//                     console.error('❌ Error fetching beneficiaries:', listError.response?.data || listError.message);
//                     throw listError;
//                 }
//             } else {
//                 throw createError;
//             }
//         }
        
//         if (!beneficiaryId) {
//             throw new Error('Could not get beneficiary ID');
//         }
        
//         // ============ CREATE TRANSFER - CORRECT V3 FORMAT ============
//         console.log('📡 Creating transfer with beneficiary ID:', beneficiaryId);
        
//         const transferRes = await axios.post(
//             'https://api.flutterwave.com/v3/transfers',
//             {
//                 amount: request.amount,
//                 currency: 'NGN',
//                 beneficiary: beneficiaryId,
//                 reference: reference,
//                 narration: `TheSpark withdrawal - ${user.accountName}`
//             },
//             {
//                 headers: {
//                     'Authorization': `Bearer ${secretKey}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );
        
//         console.log('✅ Transfer initiated:', transferRes.data.status);
//         console.log('   Transfer Reference:', transferRes.data.data?.reference);
        
//         if (transferRes.data.status === 'success') {
//             // ✅ Update user balance (deduct amount + fee)
//             await userRef.update({
//                 currentBalance: admin.firestore.FieldValue.increment(-totalDeduction),
//                 totalWithdrawn: admin.firestore.FieldValue.increment(request.amount)
//             });
//             console.log('✅ User balance updated (deducted: ₦' + totalDeduction + ')');
            
//             // Update request status
//             await requestRef.update({
//                 status: 'approved',
//                 processedAt: new Date(),
//                 processedBy: adminId,
//                 transferReference: reference
//             });
//             console.log('✅ Withdrawal request updated');
            
//             // ✅ Record transaction with fee details
//             await db.collection('transactions').add({
//                 userId: request.userId,
//                 type: 'withdrawal',
//                 amount: request.amount,
//                 fee: feeDetails.fee,
//                 totalFee: feeDetails.totalFee,
//                 totalDeduction: totalDeduction,
//                 cycle: request.cycle,
//                 day: request.requestDay,
//                 balanceAfter: user.currentBalance - totalDeduction,
//                 transferReference: reference,
//                 createdAt: admin.firestore.FieldValue.serverTimestamp()
//             });
//             console.log('✅ Transaction recorded');
            
//             // ✅ Send notification to user
//             await createNotification(
//                 request.userId,
//                 '✅ Withdrawal Approved',
//                 `Your withdrawal of ₦${request.amount.toLocaleString()} has been approved and is being processed. Fee: ₦${feeDetails.fee.toLocaleString()}`,
//                 'withdrawal_approved'
//             );
            
//             res.json({ 
//                 success: true, 
//                 message: 'Withdrawal approved', 
//                 reference: reference 
//             });
//         } else {
//             throw new Error(transferRes.data.message || 'Transfer failed');
//         }
        
//     } catch (error) {
//         console.error('❌ Withdrawal error details:');
//         console.error('   Status:', error.response?.status);
//         console.error('   Message:', error.response?.data?.message || error.message);
//         console.error('   Full response:', JSON.stringify(error.response?.data, null, 2));
        
//         await requestRef.update({
//             status: 'failed',
//             error: error.response?.data?.message || error.message,
//             processedAt: new Date(),
//             processedBy: adminId
//         });
        
//         res.status(500).json({ 
//             error: 'Failed to process withdrawal', 
//             details: error.response?.data?.message || error.message 
//         });
//     }
// });

// router.get('/withdrawals/pending', async (req, res) => {
//     const snapshot = await db.collection('withdrawalRequests')
//         .where('status', '==', 'pending')
//         .get();
    
//     const requests = [];
//     for (const doc of snapshot.docs) {
//         const request = doc.data();
//         const userDoc = await db.collection('users').doc(request.userId).get();
//         const user = userDoc.data();
        
//         requests.push({
//             id: doc.id,
//             ...request,
//             userName: userDoc.exists ? user.fullName : 'Unknown',
//             userBankAccount: user.bankCode ? {
//                 bankName: user.bankName,
//                 accountNumber: user.accountNumber,
//                 accountName: user.accountName,
//                 bankCode: user.bankCode
//             } : null
//         });
//     }
    
//     // Sort by createdAt (oldest first)
//     requests.sort((a, b) => {
//         const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
//         const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
//         return dateA - dateB;
//     });
    
//     res.json(requests);
// });


// router.post('/withdrawals/:requestId/reject', async (req, res) => {
//     const { requestId } = req.params;
    
//     await db.collection('withdrawalRequests').doc(requestId).update({
//         status: 'rejected',
//         rejectedAt: new Date()
//     });
    
//     res.json({ success: true });
// });


// // GET all flagged deposits - NO orderBy, uses manual sort like your other endpoints
// router.get('/flagged-deposits', async (req, res) => {
//     try {
//         const snapshot = await db.collection('flaggedDeposits').get();
        
//         const flagged = [];
//         snapshot.forEach(doc => {
//             flagged.push({ id: doc.id, ...doc.data() });
//         });
        
//         // Sort manually by createdAt (newest first) - SAME PATTERN as your loans, users, etc.
//         flagged.sort((a, b) => {
//             const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
//             const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
//             return dateB - dateA;
//         });
        
//         res.json(flagged);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// // RESOLVE flagged deposit (Approve or Reject)
// router.put('/flagged-deposits/:id/resolve', async (req, res) => {
//     const { id } = req.params;
//     const { status, resolveNote } = req.body;
    
//     try {
//         // Get the flagged deposit
//         const flaggedDoc = await db.collection('flaggedDeposits').doc(id).get();
//         const flaggedData = flaggedDoc.data();
        
//         if (!flaggedDoc.exists) {
//             return res.status(404).json({ error: 'Flagged deposit not found' });
//         }
        
//         // Check if already resolved
//         if (flaggedData.status && flaggedData.status !== 'review_needed') {
//             return res.status(400).json({ error: `This deposit is already ${flaggedData.status}. Use reversal endpoint to change.` });
//         }
        
//         // Update flagged deposit status
//         await db.collection('flaggedDeposits').doc(id).update({
//             status: status,
//             resolvedAt: new Date(),
//             resolvedBy: req.user.uid,
//             resolveNote: resolveNote,
//             previousStatus: 'review_needed'
//         });
        
//         // If approved, credit the user's balance
//         if (status === 'approved') {
//             const userRef = db.collection('users').doc(flaggedData.userId);
//             const userDoc = await userRef.get();
            
//             if (userDoc.exists) {
//                 const currentBalance = userDoc.data().currentBalance || 0;
//                 const amount = flaggedData.actualAmount || 0;
                
//                 // Add the actual amount to user's balance
//                 await userRef.update({
//                     currentBalance: admin.firestore.FieldValue.increment(amount),
//                     totalDeposited: admin.firestore.FieldValue.increment(amount)
//                 });
                
//                 // Create transaction record
//                 const transactionRef = await db.collection('transactions').add({
//                     userId: flaggedData.userId,
//                     type: 'deposit',
//                     amount: amount,
//                     intendedAmount: flaggedData.intendedAmount,
//                     flwReference: flaggedData.flwReference,
//                     status: 'completed',
//                     approvedBy: req.user.uid,
//                     approvedAt: new Date(),
//                     notes: resolveNote,
//                     flaggedDepositId: id,
//                     createdAt: admin.firestore.FieldValue.serverTimestamp()
//                 });
                
//                 // Store transaction ID in flagged deposit for reversal
//                 await db.collection('flaggedDeposits').doc(id).update({
//                     transactionId: transactionRef.id,
//                     balanceBefore: currentBalance,
//                     balanceAfter: currentBalance + amount
//                 });
                
//                 // ✅ Send notification using helper function
//                 await createNotification(
//                     flaggedData.userId,
//                     '✅ Deposit Approved After Review',
//                     `Your deposit of ₦${amount.toLocaleString()} has been approved and added to your balance. Note: ${resolveNote}`,
//                     'deposit_approved'
//                 );
                
//                 res.json({ 
//                     success: true, 
//                     message: `Deposit approved! ₦${amount.toLocaleString()} added to user's balance`,
//                     balanceAfter: currentBalance + amount
//                 });
//             } else {
//                 res.status(404).json({ error: 'User not found' });
//             }
//         } 
//         // If rejected, just record it (no money movement)
//         else if (status === 'rejected') {
//             // ✅ Send rejection notification using helper function
//             await createNotification(
//                 flaggedData.userId,
//                 '❌ Deposit Rejected',
//                 `Your deposit of ₦${flaggedData.actualAmount?.toLocaleString()} was rejected. Reason: ${resolveNote}`,
//                 'deposit_rejected'
//             );
            
//             res.json({ success: true, message: 'Deposit rejected' });
//         }
        
//     } catch (error) {
//         console.error('Error resolving flagged deposit:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // REVERSE a decision (undo approve or reject)
// router.post('/flagged-deposits/:id/reverse', async (req, res) => {
//     const { id } = req.params;
//     const { reverseReason } = req.body;
    
//     try {
//         // Get the flagged deposit
//         const flaggedDoc = await db.collection('flaggedDeposits').doc(id).get();
//         const flaggedData = flaggedDoc.data();
        
//         if (!flaggedDoc.exists) {
//             return res.status(404).json({ error: 'Flagged deposit not found' });
//         }
        
//         // Check current status
//         const currentStatus = flaggedData.status;
//         if (currentStatus === 'review_needed') {
//             return res.status(400).json({ error: 'This deposit is still pending review. No need to reverse.' });
//         }
        
//         // If it was approved, reverse the credit
//         if (currentStatus === 'approved') {
//             const userRef = db.collection('users').doc(flaggedData.userId);
//             const userDoc = await userRef.get();
            
//             if (userDoc.exists) {
//                 const amount = flaggedData.actualAmount || 0;
                
//                 // Deduct the amount from user's balance
//                 await userRef.update({
//                     currentBalance: admin.firestore.FieldValue.increment(-amount),
//                     totalDeposited: admin.firestore.FieldValue.increment(-amount)
//                 });
                
//                 // Update the transaction to reversed
//                 if (flaggedData.transactionId) {
//                     await db.collection('transactions').doc(flaggedData.transactionId).update({
//                         status: 'reversed',
//                         reversedAt: new Date(),
//                         reversedBy: req.user.uid,
//                         reverseReason: reverseReason
//                     });
//                 }
                
//                 // Create reversal transaction record
//                 await db.collection('transactions').add({
//                     userId: flaggedData.userId,
//                     type: 'reversal',
//                     amount: amount,
//                     originalFlaggedId: id,
//                     reason: reverseReason,
//                     reversedBy: req.user.uid,
//                     status: 'completed',
//                     createdAt: admin.firestore.FieldValue.serverTimestamp()
//                 });
                
//                 // ✅ Send notification using helper function
//                 await createNotification(
//                     flaggedData.userId,
//                     '🔄 Deposit Approval Reversed',
//                     `The approval of your deposit of ₦${amount.toLocaleString()} has been reversed. Reason: ${reverseReason}. The amount has been deducted from your balance.`,
//                     'deposit_reversed'
//                 );
//             }
//         } else if (currentStatus === 'rejected') {
//             // ✅ Send notification for rejected reversal using helper function
//             await createNotification(
//                 flaggedData.userId,
//                 '🔄 Deposit Rejection Reversed',
//                 `The rejection of your deposit of ₦${flaggedData.actualAmount?.toLocaleString()} has been reversed. It is now pending review again. Reason: ${reverseReason}`,
//                 'deposit_rejection_reversed'
//             );
//         }
        
//         // Update flagged deposit back to review_needed
//         await db.collection('flaggedDeposits').doc(id).update({
//             status: 'review_needed',
//             reversedAt: new Date(),
//             reversedBy: req.user.uid,
//             reverseReason: reverseReason,
//             previousStatus: currentStatus
//         });
        
//         res.json({ 
//             success: true, 
//             message: `Decision reversed! Deposit is back to review_needed status.`,
//             newStatus: 'review_needed'
//         });
        
//     } catch (error) {
//         console.error('Error reversing decision:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// // GET single flagged deposit with full details
// router.get('/flagged-deposits/:id', async (req, res) => {
//     const { id } = req.params;
    
//     try {
//         const flaggedDoc = await db.collection('flaggedDeposits').doc(id).get();
        
//         if (!flaggedDoc.exists) {
//             return res.status(404).json({ error: 'Flagged deposit not found' });
//         }
        
//         const flaggedData = { id: flaggedDoc.id, ...flaggedDoc.data() };
        
//         // Get user details
//         if (flaggedData.userId) {
//             const userDoc = await db.collection('users').doc(flaggedData.userId).get();
//             if (userDoc.exists) {
//                 flaggedData.user = { id: userDoc.id, ...userDoc.data() };
//             }
//         }
        
//         // Get transaction if exists
//         if (flaggedData.transactionId) {
//             const txDoc = await db.collection('transactions').doc(flaggedData.transactionId).get();
//             if (txDoc.exists) {
//                 flaggedData.transaction = { id: txDoc.id, ...txDoc.data() };
//             }
//         }
        
//         res.json(flaggedData);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });


// router.get('/stats', async (req, res) => {
//     const adminSettings = await db.collection('adminSettings').doc('settings').get();
//     const settings = adminSettings.exists ? adminSettings.data() : {};
    
//     const usersSnapshot = await db.collection('users')
//         .where('isActive', '==', true)
//         .get();
    
//     let totalSavings = 0;
//     let totalInterestPaid = 0;
    
//     usersSnapshot.forEach(doc => {
//         const user = doc.data();
//         totalSavings += user.currentBalance || 0;
//         totalInterestPaid += user.totalInterestEarned || 0;
//     });
    
//     res.json({
//         totalCustomers: usersSnapshot.size,
//         totalSavingsPool: totalSavings,
//         totalInterestPaid,
//         budgetLimit: settings.budgetLimit || 500000,
//         cumulativeInterestPaid: settings.cumulativeInterestPaid || 0,
//         savingsPoolLimit: settings.totalSavingsPoolLimit || 1200000,
//         stopTriggered: settings.stopTriggered || false,
//         hybridMode: settings.hybridMode || false,
//         platformEarnings: settings.platformEarnings || 0
//     });
// });

// router.post('/referrals/:referralId/pay', async (req, res) => {
//     const { referralId } = req.params;
    
//     const referralRef = db.collection('referrals').doc(referralId);
//     const referralDoc = await referralRef.get();
    
//     if (!referralDoc.exists) {
//         return res.status(404).json({ error: 'Referral not found' });
//     }
    
//     const referral = referralDoc.data();
    
//     if (referral.rewardPaid) {
//         return res.status(400).json({ error: 'Reward already paid' });
//     }
    
//     const referrerRef = db.collection('users').doc(referral.referrerId);
//     const referrerDoc = await referrerRef.get();
//     const referrer = referrerDoc.data();
    
//     await referrerRef.update({
//         currentBalance: referrer.currentBalance + referral.rewardAmount,
//         totalPrincipalSaved: referrer.totalPrincipalSaved + referral.rewardAmount
//     });
    
//     await referralRef.update({
//         rewardPaid: true,
//         rewardPaidDate: new Date()
//     });
    
//     await db.collection('transactions').add({
//         userId: referral.referrerId,
//         type: 'deposit',
//         amount: referral.rewardAmount,
//         cycle: referrer.currentCycle,
//         day: referrer.currentDay,
//         balanceAfter: referrer.currentBalance + referral.rewardAmount,
//         notes: 'Referral reward',
//         createdAt: new Date()
//     });
    
//     res.json({ success: true });
// });

// // Hybrid lending settings
// router.get('/hybrid/settings', async (req, res) => {
//     const settingsDoc = await db.collection('adminSettings').doc('settings').get();
//     const settings = settingsDoc.exists ? settingsDoc.data() : {};
    
//     const usersSnapshot = await db.collection('users')
//         .where('isActive', '==', true)
//         .get();
    
//     let totalPool = 0;
//     usersSnapshot.forEach(doc => {
//         totalPool += doc.data().currentBalance;
//     });
    
//     res.json({
//         hybridMode: settings.hybridMode || false,
//         lendingPercentage: settings.lendingPercentage || 70,
//         amountAvailableToLend: settings.amountAvailableToLend || 0,
//         totalLentOut: settings.totalLentOut || 0,
//         platformEarnings: settings.platformEarnings || 0,
//         totalSavingsPool: totalPool
//     });
// });

// // Get all loans
// router.get('/loans', async (req, res) => {
//     const snapshot = await db.collection('loans').get();
    
//     const loans = [];
//     snapshot.forEach(doc => loans.push({ id: doc.id, ...doc.data() }));
    
//     // Sort manually by createdAt (newest first)
//     loans.sort((a, b) => {
//         const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
//         const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
//         return dateB - dateA;
//     });
    
//     res.json(loans);
// });

// // ============ ADMIN MANAGEMENT ROUTES ============

// // Get all admins
// router.get('/admins', authenticate, isAdmin, async (req, res) => {
//     try {
//         const usersSnapshot = await db.collection('users')
//             .where('role', '==', 'admin')
//             .get();
        
//         const admins = [];
//         usersSnapshot.forEach(doc => {
//             admins.push({
//                 uid: doc.id,
//                 fullName: doc.data().fullName,
//                 email: doc.data().email,
//                 phone: doc.data().phone,
//                 role: doc.data().role,
//                 createdAt: doc.data().createdAt
//             });
//         });
        
//         res.json(admins);
//     } catch (error) {
//         console.error('Error fetching admins:', error);
//         res.status(500).json({ error: 'Failed to fetch admins' });
//     }
// });

// // Make a user an admin
// router.post('/make-admin/:userId', authenticate, isAdmin, async (req, res) => {
//     const { userId } = req.params;
    
//     try {
//         const userRef = db.collection('users').doc(userId);
//         const userDoc = await userRef.get();
        
//         if (!userDoc.exists) {
//             return res.status(404).json({ error: 'User not found' });
//         }
        
//         await userRef.update({
//             role: 'admin',
//             promotedBy: req.user.uid,
//             promotedAt: new Date()
//         });
        
//         res.json({ success: true, message: 'User is now an admin' });
//     } catch (error) {
//         console.error('Error making admin:', error);
//         res.status(500).json({ error: 'Failed to make admin' });
//     }
// });

// // Remove admin role
// router.post('/remove-admin/:userId', authenticate, isAdmin, async (req, res) => {
//     const { userId } = req.params;
    
//     if (userId === req.user.uid) {
//         return res.status(400).json({ error: 'You cannot remove your own admin role' });
//     }
    
//     try {
//         const userRef = db.collection('users').doc(userId);
//         const userDoc = await userRef.get();
        
//         if (!userDoc.exists) {
//             return res.status(404).json({ error: 'User not found' });
//         }
        
//         await userRef.update({
//             role: 'user',
//             removedBy: req.user.uid,
//             removedAt: new Date()
//         });
        
//         res.json({ success: true, message: 'Admin role removed' });
//     } catch (error) {
//         console.error('Error removing admin:', error);
//         res.status(500).json({ error: 'Failed to remove admin' });
//     }
// });

// // Check if current user is admin
// router.get('/check-admin', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     try {
//         const userDoc = await db.collection('users').doc(userId).get();
//         const isAdminUser = userDoc.exists && userDoc.data().role === 'admin';
        
//         res.json({ isAdmin: isAdminUser });
//     } catch (error) {
//         console.error('Error checking admin:', error);
//         res.status(500).json({ error: 'Failed to check admin status' });
//     }
// });

// module.exports = router;




// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////












const express = require('express');
const { db } = require('../services/firebase');
const { authenticate, isAdmin } = require('../middleware/auth');
const admin = require('firebase-admin');
const { calculateWithdrawalFee } = require('../utils/feeUtils'); // ✅ IMPORT FEE UTILITY
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

router.use(authenticate, isAdmin);

// ✅ FIXED: Added try/catch
router.get('/users', async (req, res) => {
    try {
        const snapshot = await db.collection('users').get();
        
        const users = [];
        snapshot.forEach(doc => users.push({ id: doc.id, ...doc.data() }));
        
        // Sort manually by joinDate (newest first)
        users.sort((a, b) => {
            const dateA = a.joinDate?.toDate ? a.joinDate.toDate() : new Date(a.joinDate || 0);
            const dateB = b.joinDate?.toDate ? b.joinDate.toDate() : new Date(b.joinDate || 0);
            return dateB - dateA;
        });
        
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ✅ FIXED: Added try/catch
router.get('/users/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const txSnapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .get();
        
        const transactions = [];
        txSnapshot.forEach(doc => transactions.push({ id: doc.id, ...doc.data() }));
        
        // Sort manually by createdAt (newest first)
        transactions.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        res.json({
            user: { id: userId, ...userDoc.data() },
            transactions: transactions.slice(0, 50)
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// ✅ FIXED: Withdrawal approval with proper error handling - variables declared outside try
router.post('/withdrawals/:requestId/approve', async (req, res) => {
    const { requestId } = req.params;
    const adminId = req.user.uid;
    const axios = require('axios');
    
    // ✅ Declare variables OUTSIDE try block so they're accessible in catch
    let request = null;
    let requestRef = null;
    let user = null;
    let userRef = null;
    let feeDetails = null;
    let totalDeduction = 0;
    
    try {
        // 1. Check admin
        const adminDoc = await db.collection('users').doc(adminId).get();
        if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        // 2. Get withdrawal request
        requestRef = db.collection('withdrawalRequests').doc(requestId);
        const requestDoc = await requestRef.get();
        
        if (!requestDoc.exists) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        request = requestDoc.data();
        
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request already processed' });
        }
        
        // 3. Get user - ✅ CHECK IF USER EXISTS
        userRef = db.collection('users').doc(request.userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            console.log(`❌ User ${request.userId} not found for withdrawal ${requestId}`);
            await requestRef.update({
                status: 'rejected',
                reason: 'User account no longer exists',
                processedAt: new Date(),
                processedBy: adminId
            });
            return res.status(400).json({ error: 'User account no longer exists' });
        }
        
        user = userDoc.data();
        
        // ✅ Calculate fee using imported function
        feeDetails = calculateWithdrawalFee(request.amount);
        totalDeduction = request.amount + feeDetails.totalFee;
        
        if (totalDeduction > user.currentBalance) {
            await requestRef.update({
                status: 'rejected',
                reason: 'Insufficient balance',
                processedAt: new Date(),
                processedBy: adminId
            });
            
            // ===== ✅ ADDED: Send rejection notification for insufficient balance =====
            await createNotification(
                request.userId,
                '❌ Withdrawal Rejected',
                `Your withdrawal of ₦${request.amount.toLocaleString()} was rejected due to insufficient balance.`,
                'withdrawal_rejected'
            );
            // ===== END ADDED =====
            
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        if (!user.bankCode || !user.accountNumber) {
            await requestRef.update({
                status: 'rejected',
                reason: 'No bank account',
                processedAt: new Date(),
                processedBy: adminId
            });
            
            // ===== ✅ ADDED: Send rejection notification for no bank account =====
            await createNotification(
                request.userId,
                '❌ Withdrawal Rejected',
                `Your withdrawal of ₦${request.amount.toLocaleString()} was rejected because you don't have a bank account set up. Please add your bank details.`,
                'withdrawal_rejected'
            );
            // ===== END ADDED =====
            
            return res.status(400).json({ error: 'User has no bank account' });
        }
        
        const secretKey = process.env.FLW_SECRET_KEY;
        
        if (!secretKey) {
            throw new Error('FLW_SECRET_KEY not configured in .env');
        }
        
        console.log('📡 Using FLW_SECRET_KEY for withdrawal');
        console.log('   Bank Code:', user.bankCode);
        console.log('   Bank Name:', user.bankName);
        console.log('   Account:', user.accountNumber);
        console.log('   Amount: ₦' + request.amount);
        console.log('   Fee: ₦' + feeDetails.fee);
        console.log('   Total Deduction: ₦' + totalDeduction);
        console.log('   Account Name:', user.accountName);
        
        const reference = `WTH${Date.now()}${request.userId.slice(0, 8)}`;
        
        // ============ GET OR CREATE BENEFICIARY ============
        let beneficiaryId = null;
        
        console.log('📡 Creating beneficiary...');
        
        try {
            const beneficiaryRes = await axios.post(
                'https://api.flutterwave.com/v3/beneficiaries',
                {
                    account_bank: user.bankCode,
                    account_number: user.accountNumber,
                    beneficiary_name: user.accountName,
                    currency: 'NGN',
                    bank_name: user.bankName
                },
                {
                    headers: {
                        'Authorization': `Bearer ${secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (beneficiaryRes.data.status === 'success') {
                beneficiaryId = beneficiaryRes.data.data.id;
                console.log('✅ Beneficiary created:', beneficiaryId);
            }
        } catch (createError) {
            if (createError.response?.data?.message === 'Beneficiary already added to your account') {
                console.log('📡 Beneficiary already exists, fetching ID...');
                
                try {
                    const listRes = await axios.get(
                        'https://api.flutterwave.com/v3/beneficiaries',
                        {
                            headers: {
                                'Authorization': `Bearer ${secretKey}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    
                    const existing = listRes.data.data?.find(b => 
                        b.account_number === user.accountNumber && 
                        b.bank_code === user.bankCode
                    );
                    
                    if (existing) {
                        beneficiaryId = existing.id;
                        console.log('✅ Found existing beneficiary:', beneficiaryId);
                    } else if (listRes.data.data && listRes.data.data.length > 0) {
                        beneficiaryId = listRes.data.data[0].id;
                        console.log('✅ Using first available beneficiary:', beneficiaryId);
                    } else {
                        throw new Error('No beneficiaries found');
                    }
                } catch (listError) {
                    console.error('❌ Error fetching beneficiaries:', listError.response?.data || listError.message);
                    throw listError;
                }
            } else {
                throw createError;
            }
        }
        
        if (!beneficiaryId) {
            throw new Error('Could not get beneficiary ID');
        }
        
        // ============ CREATE TRANSFER - CORRECT V3 FORMAT ============
        console.log('📡 Creating transfer with beneficiary ID:', beneficiaryId);
        
        const transferRes = await axios.post(
            'https://api.flutterwave.com/v3/transfers',
            {
                amount: request.amount,
                currency: 'NGN',
                beneficiary: beneficiaryId,
                reference: reference,
                narration: `TheSpark withdrawal - ${user.accountName}`
            },
            {
                headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Transfer initiated:', transferRes.data.status);
        console.log('   Transfer Reference:', transferRes.data.data?.reference);
        
        if (transferRes.data.status === 'success') {
            // ✅ Update user balance (deduct amount + fee)
            await userRef.update({
                currentBalance: admin.firestore.FieldValue.increment(-totalDeduction),
                totalWithdrawn: admin.firestore.FieldValue.increment(request.amount)
            });
            console.log('✅ User balance updated (deducted: ₦' + totalDeduction + ')');
            
            // Update request status
            await requestRef.update({
                status: 'approved',
                processedAt: new Date(),
                processedBy: adminId,
                transferReference: reference
            });
            console.log('✅ Withdrawal request updated');
            
            // ✅ Record transaction with fee details
            await db.collection('transactions').add({
                userId: request.userId,
                type: 'withdrawal',
                amount: request.amount,
                fee: feeDetails.fee,
                totalFee: feeDetails.totalFee,
                totalDeduction: totalDeduction,
                cycle: request.cycle,
                day: request.requestDay,
                balanceAfter: user.currentBalance - totalDeduction,
                transferReference: reference,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Transaction recorded');
            
            // ✅ Send notification to user
            await createNotification(
                request.userId,
                '✅ Withdrawal Approved',
                `Your withdrawal of ₦${request.amount.toLocaleString()} has been approved and is being processed. Fee: ₦${feeDetails.fee.toLocaleString()}`,
                'withdrawal_approved'
            );
            
            res.json({ 
                success: true, 
                message: 'Withdrawal approved', 
                reference: reference 
            });
        } else {
            throw new Error(transferRes.data.message || 'Transfer failed');
        }
        
    } catch (error) {
        console.error('❌ Withdrawal error details:');
        console.error('   Status:', error.response?.status);
        console.error('   Message:', error.response?.data?.message || error.message);
        console.error('   Full response:', JSON.stringify(error.response?.data, null, 2));
        
        // ===== GET BOTH ERRORS =====
        const technicalError = error.response?.data?.message || error.message;
        const flutterwaveResponse = error.response?.data || null;
        const statusCode = error.response?.status || null;
        
        let userMessage = technicalError;
        
        // Make error more user-friendly
        if (userMessage.includes('insufficient balance')) {
            userMessage = 'Insufficient balance in merchant account. Please contact support.';
        } else if (userMessage.includes('beneficiary')) {
            userMessage = 'Beneficiary account issue. Please verify your bank details.';
        } else if (userMessage.includes('bank')) {
            userMessage = 'Bank transfer failed. Please check your bank details.';
        } else if (userMessage.includes('This request cannot be processed')) {
            userMessage = 'This request cannot be processed. Please contact support.';
        } else if (userMessage.includes('secret key') || userMessage.includes('FLW_SECRET_KEY')) {
            userMessage = 'Payment service configuration error. Please contact support.';
        }
        
        // ✅ Send failure notification to user (using the outer request variable)
        try {
            if (request && request.userId) {
                await createNotification(
                    request.userId,
                    '❌ Withdrawal Failed',
                    `Your withdrawal of ₦${request.amount ? request.amount.toLocaleString() : 'unknown'} failed. Error: ${userMessage}. Please try again later.`,
                    'withdrawal_failed'
                );
            }
        } catch (notifyError) {
            console.error('Failed to send notification:', notifyError);
        }
        
        // ✅ Save BOTH errors to the database
        try {
            if (requestRef) {
                await requestRef.update({
                    status: 'failed',
                    error: userMessage,  // User-friendly (shown in UI)
                    technicalError: technicalError,  // Technical (for admin debugging)
                    flutterwaveResponse: flutterwaveResponse,  // Full Flutterwave response
                    statusCode: statusCode,  // HTTP status code
                    processedAt: new Date(),
                    processedBy: adminId
                });
            }
        } catch (updateError) {
            console.error('Failed to update request status:', updateError);
        }
        
        res.status(500).json({ 
            error: 'Failed to process withdrawal', 
            details: userMessage,
            technicalDetails: technicalError
        });
    }
});

// ✅ FIXED: Added try/catch
// ✅ FIXED: Get pending AND failed withdrawals (so failed ones stay visible)
router.get('/withdrawals/pending', async (req, res) => {
    try {
        // ✅ Get both pending AND failed withdrawals
        const pendingSnapshot = await db.collection('withdrawalRequests')
            .where('status', '==', 'pending')
            .get();
        
        const failedSnapshot = await db.collection('withdrawalRequests')
            .where('status', '==', 'failed')
            .get();
        
        const allRequests = [];
        
        // Process pending withdrawals
        for (const doc of pendingSnapshot.docs) {
            const request = doc.data();
            const userDoc = await db.collection('users').doc(request.userId).get();
            
            if (!userDoc.exists) {
                console.log(`⚠️ User ${request.userId} not found for withdrawal request ${doc.id}`);
                allRequests.push({
                    id: doc.id,
                    ...request,
                    userName: 'Deleted User',
                    userBankAccount: null
                });
                continue;
            }
            
            const user = userDoc.data();
            
            allRequests.push({
                id: doc.id,
                ...request,
                userName: user.fullName || 'Unknown',
                userBankAccount: user.bankCode ? {
                    bankName: user.bankName,
                    accountNumber: user.accountNumber,
                    accountName: user.accountName,
                    bankCode: user.bankCode
                } : null
            });
        }
        
        // Process failed withdrawals
        for (const doc of failedSnapshot.docs) {
            const request = doc.data();
            const userDoc = await db.collection('users').doc(request.userId).get();
            
            if (!userDoc.exists) {
                allRequests.push({
                    id: doc.id,
                    ...request,
                    userName: 'Deleted User',
                    userBankAccount: null
                });
                continue;
            }
            
            const user = userDoc.data();
            
            allRequests.push({
                id: doc.id,
                ...request,
                userName: user.fullName || 'Unknown',
                userBankAccount: user.bankCode ? {
                    bankName: user.bankName,
                    accountNumber: user.accountNumber,
                    accountName: user.accountName,
                    bankCode: user.bankCode
                } : null
            });
        }
        
        // Sort by createdAt (oldest first)
        allRequests.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateA - dateB;
        });
        
        res.json(allRequests);
    } catch (error) {
        console.error('Error fetching withdrawals:', error);
        res.status(500).json({ error: 'Failed to fetch withdrawals' });
    }
});

// ✅ NEW: Retry failed withdrawal
router.post('/withdrawals/:requestId/retry', async (req, res) => {
    const { requestId } = req.params;
    const adminId = req.user.uid;
    
    try {
        const requestRef = db.collection('withdrawalRequests').doc(requestId);
        const requestDoc = await requestRef.get();
        
        if (!requestDoc.exists) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        const request = requestDoc.data();
        
        if (request.status !== 'failed') {
            return res.status(400).json({ error: 'Only failed requests can be retried' });
        }
        
        // Reset status to pending
        await requestRef.update({
            status: 'pending',
            error: null,
            technicalError: null,
            retryCount: (request.retryCount || 0) + 1,
            retriedAt: new Date(),
            retriedBy: adminId
        });
        
        await createNotification(
            request.userId,
            '🔄 Withdrawal Retry',
            `Your withdrawal of ₦${request.amount.toLocaleString()} has been reset for retry.`,
            'withdrawal_retry'
        );
        
        res.json({ 
            success: true, 
            message: 'Withdrawal reset to pending for retry' 
        });
    } catch (error) {
        console.error('Error retrying withdrawal:', error);
        res.status(500).json({ error: 'Failed to retry withdrawal' });
    }
});

// DELETE failed withdrawal
router.delete('/withdrawals/:requestId', authenticate, isAdmin, async (req, res) => {
    const { requestId } = req.params;
    
    try {
        await db.collection('withdrawalRequests').doc(requestId).delete();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// ✅ FIXED: Reject withdrawal
router.post('/withdrawals/:requestId/reject', async (req, res) => {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.uid;
    
    let request = null;
    let requestRef = null;
    
    try {
        requestRef = db.collection('withdrawalRequests').doc(requestId);
        const requestDoc = await requestRef.get();
        
        if (!requestDoc.exists) {
            return res.status(404).json({ error: 'Request not found' });
        }
        
        request = requestDoc.data();
        
        if (request.status !== 'pending') {
            return res.status(400).json({ error: 'Request already processed' });
        }
        
        const rejectionReason = reason || 'No reason provided';
        
        const userDoc = await db.collection('users').doc(request.userId).get();
        
        if (userDoc.exists) {
            await createNotification(
                request.userId,
                '❌ Withdrawal Rejected',
                `Your withdrawal of ₦${request.amount.toLocaleString()} was rejected. Reason: ${rejectionReason}`,
                'withdrawal_rejected'
            );
        } else {
            console.log(`⚠️ User ${request.userId} not found, skipping notification`);
        }
        
        await requestRef.update({
            status: 'rejected',
            rejectedAt: new Date(),
            rejectedBy: adminId,
            reason: rejectionReason
        });
        
        res.json({ 
            success: true,
            message: 'Withdrawal rejected',
            reason: rejectionReason
        });
    } catch (error) {
        console.error('Error rejecting withdrawal:', error);
        
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

// ===== END UPDATED =====

// GET all flagged deposits - NO orderBy, uses manual sort like your other endpoints
router.get('/flagged-deposits', async (req, res) => {
    try {
        const snapshot = await db.collection('flaggedDeposits').get();
        
        const flagged = [];
        snapshot.forEach(doc => {
            flagged.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort manually by createdAt (newest first) - SAME PATTERN as your loans, users, etc.
        flagged.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        res.json(flagged);
    } catch (error) {
        console.error('Error fetching flagged deposits:', error);
        res.status(500).json({ error: 'Failed to fetch flagged deposits' });
    }
});

// RESOLVE flagged deposit (Approve or Reject)
router.put('/flagged-deposits/:id/resolve', async (req, res) => {
    const { id } = req.params;
    const { status, resolveNote } = req.body;
    
    try {
        // Get the flagged deposit
        const flaggedDoc = await db.collection('flaggedDeposits').doc(id).get();
        const flaggedData = flaggedDoc.data();
        
        if (!flaggedDoc.exists) {
            return res.status(404).json({ error: 'Flagged deposit not found' });
        }
        
        // Check if already resolved
        if (flaggedData.status && flaggedData.status !== 'review_needed') {
            return res.status(400).json({ error: `This deposit is already ${flaggedData.status}. Use reversal endpoint to change.` });
        }
        
        // Update flagged deposit status
        await db.collection('flaggedDeposits').doc(id).update({
            status: status,
            resolvedAt: new Date(),
            resolvedBy: req.user.uid,
            resolveNote: resolveNote,
            previousStatus: 'review_needed'
        });
        
        // If approved, credit the user's balance
        if (status === 'approved') {
            const userRef = db.collection('users').doc(flaggedData.userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                const currentBalance = userDoc.data().currentBalance || 0;
                const amount = flaggedData.actualAmount || 0;
                
                // Add the actual amount to user's balance
                await userRef.update({
                    currentBalance: admin.firestore.FieldValue.increment(amount),
                    totalDeposited: admin.firestore.FieldValue.increment(amount)
                });
                
                // Create transaction record
                const transactionRef = await db.collection('transactions').add({
                    userId: flaggedData.userId,
                    type: 'deposit',
                    amount: amount,
                    intendedAmount: flaggedData.intendedAmount,
                    flwReference: flaggedData.flwReference,
                    status: 'completed',
                    approvedBy: req.user.uid,
                    approvedAt: new Date(),
                    notes: resolveNote,
                    flaggedDepositId: id,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                // Store transaction ID in flagged deposit for reversal
                await db.collection('flaggedDeposits').doc(id).update({
                    transactionId: transactionRef.id,
                    balanceBefore: currentBalance,
                    balanceAfter: currentBalance + amount
                });
                
                // ✅ Send notification using helper function
                await createNotification(
                    flaggedData.userId,
                    '✅ Deposit Approved After Review',
                    `Your deposit of ₦${amount.toLocaleString()} has been approved and added to your balance. Note: ${resolveNote}`,
                    'deposit_approved'
                );
                
                res.json({ 
                    success: true, 
                    message: `Deposit approved! ₦${amount.toLocaleString()} added to user's balance`,
                    balanceAfter: currentBalance + amount
                });
            } else {
                res.status(404).json({ error: 'User not found' });
            }
        } 
        // If rejected, just record it (no money movement)
        else if (status === 'rejected') {
            // ✅ Send rejection notification using helper function
            await createNotification(
                flaggedData.userId,
                '❌ Deposit Rejected',
                `Your deposit of ₦${flaggedData.actualAmount?.toLocaleString()} was rejected. Reason: ${resolveNote}`,
                'deposit_rejected'
            );
            
            res.json({ success: true, message: 'Deposit rejected' });
        }
        
    } catch (error) {
        console.error('Error resolving flagged deposit:', error);
        res.status(500).json({ error: error.message });
    }
});

// REVERSE a decision (undo approve or reject)
router.post('/flagged-deposits/:id/reverse', async (req, res) => {
    const { id } = req.params;
    const { reverseReason } = req.body;
    
    try {
        // Get the flagged deposit
        const flaggedDoc = await db.collection('flaggedDeposits').doc(id).get();
        const flaggedData = flaggedDoc.data();
        
        if (!flaggedDoc.exists) {
            return res.status(404).json({ error: 'Flagged deposit not found' });
        }
        
        // Check current status
        const currentStatus = flaggedData.status;
        if (currentStatus === 'review_needed') {
            return res.status(400).json({ error: 'This deposit is still pending review. No need to reverse.' });
        }
        
        // If it was approved, reverse the credit
        if (currentStatus === 'approved') {
            const userRef = db.collection('users').doc(flaggedData.userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                const amount = flaggedData.actualAmount || 0;
                
                // Deduct the amount from user's balance
                await userRef.update({
                    currentBalance: admin.firestore.FieldValue.increment(-amount),
                    totalDeposited: admin.firestore.FieldValue.increment(-amount)
                });
                
                // Update the transaction to reversed
                if (flaggedData.transactionId) {
                    await db.collection('transactions').doc(flaggedData.transactionId).update({
                        status: 'reversed',
                        reversedAt: new Date(),
                        reversedBy: req.user.uid,
                        reverseReason: reverseReason
                    });
                }
                
                // Create reversal transaction record
                await db.collection('transactions').add({
                    userId: flaggedData.userId,
                    type: 'reversal',
                    amount: amount,
                    originalFlaggedId: id,
                    reason: reverseReason,
                    reversedBy: req.user.uid,
                    status: 'completed',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                // ✅ Send notification using helper function
                await createNotification(
                    flaggedData.userId,
                    '🔄 Deposit Approval Reversed',
                    `The approval of your deposit of ₦${amount.toLocaleString()} has been reversed. Reason: ${reverseReason}. The amount has been deducted from your balance.`,
                    'deposit_reversed'
                );
            }
        } else if (currentStatus === 'rejected') {
            // ✅ Send notification for rejected reversal using helper function
            await createNotification(
                flaggedData.userId,
                '🔄 Deposit Rejection Reversed',
                `The rejection of your deposit of ₦${flaggedData.actualAmount?.toLocaleString()} has been reversed. It is now pending review again. Reason: ${reverseReason}`,
                'deposit_rejection_reversed'
            );
        }
        
        // Update flagged deposit back to review_needed
        await db.collection('flaggedDeposits').doc(id).update({
            status: 'review_needed',
            reversedAt: new Date(),
            reversedBy: req.user.uid,
            reverseReason: reverseReason,
            previousStatus: currentStatus
        });
        
        res.json({ 
            success: true, 
            message: `Decision reversed! Deposit is back to review_needed status.`,
            newStatus: 'review_needed'
        });
        
    } catch (error) {
        console.error('Error reversing decision:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET single flagged deposit with full details
router.get('/flagged-deposits/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const flaggedDoc = await db.collection('flaggedDeposits').doc(id).get();
        
        if (!flaggedDoc.exists) {
            return res.status(404).json({ error: 'Flagged deposit not found' });
        }
        
        const flaggedData = { id: flaggedDoc.id, ...flaggedDoc.data() };
        
        // Get user details
        if (flaggedData.userId) {
            const userDoc = await db.collection('users').doc(flaggedData.userId).get();
            if (userDoc.exists) {
                flaggedData.user = { id: userDoc.id, ...userDoc.data() };
            }
        }
        
        // Get transaction if exists
        if (flaggedData.transactionId) {
            const txDoc = await db.collection('transactions').doc(flaggedData.transactionId).get();
            if (txDoc.exists) {
                flaggedData.transaction = { id: txDoc.id, ...txDoc.data() };
            }
        }
        
        res.json(flaggedData);
    } catch (error) {
        console.error('Error fetching flagged deposit:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ FIXED: Added try/catch
router.get('/stats', async (req, res) => {
    try {
        const adminSettings = await db.collection('adminSettings').doc('settings').get();
        const settings = adminSettings.exists ? adminSettings.data() : {};
        
        const usersSnapshot = await db.collection('users')
            .where('isActive', '==', true)
            .get();
        
        let totalSavings = 0;
        let totalInterestPaid = 0;
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            totalSavings += user.currentBalance || 0;
            totalInterestPaid += user.totalInterestEarned || 0;
        });
        
        res.json({
            totalCustomers: usersSnapshot.size,
            totalSavingsPool: totalSavings,
            totalInterestPaid,
            budgetLimit: settings.budgetLimit || 500000,
            cumulativeInterestPaid: settings.cumulativeInterestPaid || 0,
            savingsPoolLimit: settings.totalSavingsPoolLimit || 1200000,
            stopTriggered: settings.stopTriggered || false,
            hybridMode: settings.hybridMode || false,
            platformEarnings: settings.platformEarnings || 0
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ✅ FIXED: Added user existence check and try/catch
router.post('/referrals/:referralId/pay', async (req, res) => {
    const { referralId } = req.params;
    
    try {
        const referralRef = db.collection('referrals').doc(referralId);
        const referralDoc = await referralRef.get();
        
        if (!referralDoc.exists) {
            return res.status(404).json({ error: 'Referral not found' });
        }
        
        const referral = referralDoc.data();
        
        if (referral.rewardPaid) {
            return res.status(400).json({ error: 'Reward already paid' });
        }
        
        const referrerRef = db.collection('users').doc(referral.referrerId);
        const referrerDoc = await referrerRef.get();
        
        // ✅ CHECK IF REFERRER EXISTS
        if (!referrerDoc.exists) {
            console.log(`❌ Referrer ${referral.referrerId} not found for referral ${referralId}`);
            await referralRef.update({
                rewardPaid: true,
                rewardPaidDate: new Date(),
                error: 'Referrer account no longer exists'
            });
            return res.status(400).json({ error: 'Referrer account no longer exists' });
        }
        
        const referrer = referrerDoc.data();
        
        await referrerRef.update({
            currentBalance: (referrer.currentBalance || 0) + referral.rewardAmount,
            totalPrincipalSaved: (referrer.totalPrincipalSaved || 0) + referral.rewardAmount
        });
        
        await referralRef.update({
            rewardPaid: true,
            rewardPaidDate: new Date()
        });
        
        await db.collection('transactions').add({
            userId: referral.referrerId,
            type: 'deposit',
            amount: referral.rewardAmount,
            cycle: referrer.currentCycle || 0,
            day: referrer.currentDay || 0,
            balanceAfter: (referrer.currentBalance || 0) + referral.rewardAmount,
            notes: 'Referral reward',
            createdAt: new Date()
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error paying referral:', error);
        res.status(500).json({ error: 'Failed to pay referral' });
    }
});

// ✅ FIXED: Added try/catch
router.get('/hybrid/settings', async (req, res) => {
    try {
        const settingsDoc = await db.collection('adminSettings').doc('settings').get();
        const settings = settingsDoc.exists ? settingsDoc.data() : {};
        
        const usersSnapshot = await db.collection('users')
            .where('isActive', '==', true)
            .get();
        
        let totalPool = 0;
        usersSnapshot.forEach(doc => {
            totalPool += doc.data().currentBalance || 0;
        });
        
        res.json({
            hybridMode: settings.hybridMode || false,
            lendingPercentage: settings.lendingPercentage || 70,
            amountAvailableToLend: settings.amountAvailableToLend || 0,
            totalLentOut: settings.totalLentOut || 0,
            platformEarnings: settings.platformEarnings || 0,
            totalSavingsPool: totalPool
        });
    } catch (error) {
        console.error('Error fetching hybrid settings:', error);
        res.status(500).json({ error: 'Failed to fetch hybrid settings' });
    }
});

// ✅ FIXED: Added try/catch
router.get('/loans', async (req, res) => {
    try {
        const snapshot = await db.collection('loans').get();
        
        const loans = [];
        snapshot.forEach(doc => loans.push({ id: doc.id, ...doc.data() }));
        
        // Sort manually by createdAt (newest first)
        loans.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        res.json(loans);
    } catch (error) {
        console.error('Error fetching loans:', error);
        res.status(500).json({ error: 'Failed to fetch loans' });
    }
});

// ============ ADMIN MANAGEMENT ROUTES ============

// Get all admins
router.get('/admins', authenticate, isAdmin, async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users')
            .where('role', '==', 'admin')
            .get();
        
        const admins = [];
        usersSnapshot.forEach(doc => {
            admins.push({
                uid: doc.id,
                fullName: doc.data().fullName,
                email: doc.data().email,
                phone: doc.data().phone,
                role: doc.data().role,
                createdAt: doc.data().createdAt
            });
        });
        
        res.json(admins);
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ error: 'Failed to fetch admins' });
    }
});

// Make a user an admin
router.post('/make-admin/:userId', authenticate, isAdmin, async (req, res) => {
    const { userId } = req.params;
    
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await userRef.update({
            role: 'admin',
            promotedBy: req.user.uid,
            promotedAt: new Date()
        });
        
        res.json({ success: true, message: 'User is now an admin' });
    } catch (error) {
        console.error('Error making admin:', error);
        res.status(500).json({ error: 'Failed to make admin' });
    }
});

// Remove admin role
router.post('/remove-admin/:userId', authenticate, isAdmin, async (req, res) => {
    const { userId } = req.params;
    
    if (userId === req.user.uid) {
        return res.status(400).json({ error: 'You cannot remove your own admin role' });
    }
    
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await userRef.update({
            role: 'user',
            removedBy: req.user.uid,
            removedAt: new Date()
        });
        
        res.json({ success: true, message: 'Admin role removed' });
    } catch (error) {
        console.error('Error removing admin:', error);
        res.status(500).json({ error: 'Failed to remove admin' });
    }
});

// Check if current user is admin
// Check if current user is admin
router.get('/check-admin', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        // ✅ CHECK IF USER EXISTS
        if (!userDoc.exists) {
            console.log(`⚠️ User ${userId} not found in check-admin`);
            return res.status(404).json({ 
                isAdmin: false, 
                error: 'User not found',
                message: 'Your account profile was not found'
            });
        }
        
        const userData = userDoc.data();
        const isAdminUser = userData.role === 'admin';
        
        res.json({ 
            isAdmin: isAdminUser,
            role: userData.role || 'user'
        });
    } catch (error) {
        console.error('Error checking admin:', error);
        res.status(500).json({ 
            isAdmin: false, 
            error: 'Failed to check admin status' 
        });
    }
});

module.exports = router;