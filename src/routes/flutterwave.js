// const express = require('express');
// const axios = require('axios');
// const { db } = require('../services/firebase');
// const { authenticate } = require('../middleware/auth');
// const admin = require('firebase-admin');
// const { createUserVirtualAccount } = require('../services/flutterwaveService');

// const router = express.Router();

// // ============ WEBHOOK (NO AUTHENTICATION REQUIRED) ============
// router.post('/webhook', async (req, res) => {
//     console.log('💰 Flutterwave webhook received');
//     console.log('Webhook body:', JSON.stringify(req.body, null, 2));
    
//     // ✅ Verify webhook signature
//     const secretHash = process.env.FLW_SECRET_HASH;
//     const signature = req.headers['verif-hash'];
    
//     if (!secretHash) {
//         console.error('❌ FLW_SECRET_HASH not configured in .env');
//         return res.status(200).send('OK');
//     }
    
//     if (signature !== secretHash) {
//         console.error('❌ Invalid webhook signature');
//         return res.status(401).send('Invalid signature');
//     }
    
//     console.log('✅ Webhook signature verified');
    
//     // Immediately return 200 to prevent timeout
//     res.status(200).send('OK');
    
//     try {
//         const event = req.body;
        
//         // Handle v3 webhook format (event: charge.completed)
//         if (event.event === 'charge.completed' && event.data?.status === 'successful') {
//             const data = event.data;
//             const email = data.customer?.email;
//             const amount = data.amount;
//             const chargeId = data.id ? String(data.id) : null;
//             const reference = data.flw_ref || data.tx_ref || null;
            
//             console.log(`💰 v3 Webhook: Deposit of ₦${amount} from ${email}`);
            
//             if (!email) {
//                 console.error('❌ No email in webhook payload');
//                 return;
//             }
            
//             const usersSnapshot = await db.collection('users')
//                 .where('email', '==', email)
//                 .limit(1)
//                 .get();
            
//             if (!usersSnapshot.empty) {
//                 const userDoc = usersSnapshot.docs[0];
//                 const userId = userDoc.id;
//                 const user = userDoc.data();
//                 const currentBalance = user.currentBalance || 0;
//                 const currentDay = user.currentDay || 1;
                
//                 // Check for duplicate transaction
//                 let existingTx = null;
//                 if (chargeId) {
//                     const existingSnapshot = await db.collection('transactions')
//                         .where('flwChargeId', '==', chargeId)
//                         .limit(1)
//                         .get();
//                     if (!existingSnapshot.empty) {
//                         existingTx = existingSnapshot.docs[0];
//                     }
//                 }
                
//                 if (existingTx) {
//                     console.log('Duplicate webhook received, skipping');
//                     return;
//                 }
                
//                 // Credit user's wallet
//                 await db.collection('users').doc(userId).update({
//                     currentBalance: (currentBalance || 0) + amount,
//                     totalPrincipalSaved: admin.firestore.FieldValue.increment(amount),
//                     ...(currentDay <= 16 && { totalSavedDays1to16: admin.firestore.FieldValue.increment(amount) })
//                 });
                
//                 // Prepare transaction data (filter out undefined values)
//                 const transactionData = {
//                     userId: userId,
//                     type: 'deposit',
//                     amount: amount,
//                     method: 'bank_transfer',
//                     provider: 'flutterwave',
//                     cycle: user.currentCycle || 1,
//                     day: currentDay,
//                     balanceAfter: (currentBalance || 0) + amount,
//                     isDays1to16: currentDay <= 16,
//                     earnsInterest: currentDay <= 16,
//                     description: 'Deposit via bank transfer',
//                     createdAt: admin.firestore.FieldValue.serverTimestamp()
//                 };
                
//                 // Only add if defined
//                 if (chargeId) transactionData.flwChargeId = chargeId;
//                 if (reference) transactionData.flwReference = reference;
                
//                 await db.collection('transactions').add(transactionData);
                
//                 console.log(`✅ Credited ₦${amount} to user ${userId}`);
//                 console.log(`   New balance: ${(currentBalance || 0) + amount}`);
//             } else {
//                 console.error(`❌ User not found for email: ${email}`);
//             }
//         }
        
//         // Handle v4 webhook format (type: charge.completed)
//         if (event.type === 'charge.completed' && event.data?.status === 'succeeded') {
//             const data = event.data;
//             const email = data.customer?.email;
//             const amount = data.amount;
//             const chargeId = data.id;
//             const reference = data.reference;
            
//             console.log(`💰 v4 Webhook: Deposit of ₦${amount} from ${email}`);
            
//             // Same processing logic as above...
//             if (!email) {
//                 console.error('❌ No email in webhook payload');
//                 return;
//             }
            
//             const usersSnapshot = await db.collection('users')
//                 .where('email', '==', email)
//                 .limit(1)
//                 .get();
            
//             if (!usersSnapshot.empty) {
//                 const userId = usersSnapshot.docs[0].id;
//                 const user = usersSnapshot.docs[0].data();
//                 const currentBalance = user.currentBalance || 0;
//                 const currentDay = user.currentDay || 1;
                
//                 // Check for duplicate
//                 let existingTx = null;
//                 if (chargeId) {
//                     const existingSnapshot = await db.collection('transactions')
//                         .where('flwChargeId', '==', chargeId)
//                         .limit(1)
//                         .get();
//                     if (!existingSnapshot.empty) {
//                         existingTx = existingSnapshot.docs[0];
//                     }
//                 }
                
//                 if (existingTx) {
//                     console.log('Duplicate webhook received, skipping');
//                     return;
//                 }
                
//                 await db.collection('users').doc(userId).update({
//                     currentBalance: (currentBalance || 0) + amount,
//                     totalPrincipalSaved: admin.firestore.FieldValue.increment(amount),
//                     ...(currentDay <= 16 && { totalSavedDays1to16: admin.firestore.FieldValue.increment(amount) })
//                 });
                
//                 const transactionData = {
//                     userId: userId,
//                     type: 'deposit',
//                     amount: amount,
//                     method: 'bank_transfer',
//                     provider: 'flutterwave',
//                     cycle: user.currentCycle || 1,
//                     day: currentDay,
//                     balanceAfter: (currentBalance || 0) + amount,
//                     isDays1to16: currentDay <= 16,
//                     earnsInterest: currentDay <= 16,
//                     description: 'Deposit via bank transfer',
//                     createdAt: admin.firestore.FieldValue.serverTimestamp()
//                 };
                
//                 if (chargeId) transactionData.flwChargeId = chargeId;
//                 if (reference) transactionData.flwReference = reference;
                
//                 await db.collection('transactions').add(transactionData);
                
//                 console.log(`✅ Credited ₦${amount} to user ${userId}`);
//             }
//         }
        
//         // Handle transfer events (withdrawals)
//         if (event.type === 'transfer.completed') {
//             console.log('💰 Transfer completed:', event.data?.reference);
//         }
        
//         if (event.type === 'transfer.failed') {
//             console.error('❌ Transfer failed:', event.data?.reference, event.data?.reason);
//         }
        
//     } catch (error) {
//         console.error('❌ Error processing webhook:', error);
//     }
// });

// // ============ ALL ROUTES BELOW REQUIRE AUTHENTICATION ============
// router.use(authenticate);

// // GET - Fetch all Nigerian banks
// router.get('/banks', async (req, res) => {
//     try {
//         console.log('🟡 Fetching banks from Flutterwave...');
        
//         const tokenRes = await axios.post(
//             'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
//             new URLSearchParams({
//                 client_id: process.env.FLW_CLIENT_ID,
//                 client_secret: process.env.FLW_CLIENT_SECRET,
//                 grant_type: 'client_credentials'
//             })
//         );
        
//         const token = tokenRes.data.access_token;
        
//         const response = await axios.get(
//             'https://developersandbox-api.flutterwave.com/banks',
//             {
//                 params: { country: 'NG' },
//                 headers: {
//                     'Authorization': `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );
        
//         if (response.data.status === 'success') {
//             const banks = response.data.data.map(bank => ({
//                 code: bank.code,
//                 name: bank.name
//             }));
            
//             console.log(`✅ Fetched ${banks.length} banks`);
//             res.json({ success: true, banks: banks });
//         } else {
//             res.status(500).json({ error: 'Failed to fetch banks' });
//         }
//     } catch (error) {
//         console.error('❌ Error fetching banks:', error.response?.data || error.message);
//         res.status(500).json({ error: 'Failed to fetch banks' });
//     }
// });

// // Create virtual account for authenticated user
// router.post('/create-account', async (req, res) => {
//     const userId = req.user.uid;
//     const { email, fullName } = req.body;
    
//     try {
//         const userDoc = await db.collection('users').doc(userId).get();
        
//         if (!userDoc.exists) {
//             return res.status(404).json({ error: 'User not found' });
//         }
        
//         const user = userDoc.data();
        
//         if (user.flwAccountNumber) {
//             return res.json({
//                 success: true,
//                 hasAccount: true,
//                 accountNumber: user.flwAccountNumber,
//                 bankName: user.flwBankName,
//                 message: 'Virtual account already exists'
//             });
//         }
        
//         const result = await createUserVirtualAccount({
//             fullName: fullName || user.fullName,
//             email: email || user.email,
//             bvn: user.bvn,
//             phone: user.phone
//         });
        
//         if (result.success) {
//             await db.collection('users').doc(userId).update({
//                 flwAccountNumber: result.accountNumber,
//                 flwBankName: result.bankName,
//                 flwCreatedAt: admin.firestore.FieldValue.serverTimestamp()
//             });
            
//             res.json({
//                 success: true,
//                 hasAccount: true,
//                 accountNumber: result.accountNumber,
//                 bankName: result.bankName,
//                 message: 'Virtual account created successfully'
//             });
//         } else {
//             res.status(500).json({ error: result.error });
//         }
//     } catch (error) {
//         console.error('Error creating virtual account:', error);
//         res.status(500).json({ error: 'Failed to create virtual account' });
//     }
// });

// // Get user's virtual account
// router.get('/my-account', async (req, res) => {
//     const userId = req.user.uid;
    
//     try {
//         const userDoc = await db.collection('users').doc(userId).get();
//         const user = userDoc.data();
        
//         if (user.flwAccountNumber) {
//             return res.json({
//                 success: true,
//                 hasAccount: true,
//                 accountNumber: user.flwAccountNumber,
//                 bankName: user.flwBankName,
//                 fullName: user.fullName 
//             });
//         }
        
//         res.json({ success: true, hasAccount: false });
//     } catch (error) {
//         console.error('Error getting virtual account:', error);
//         res.status(500).json({ error: 'Failed to get account details' });
//     }
// });

// module.exports = router;




// src/routes/flutterwave.js
const express = require('express');
const axios = require('axios');
const { db } = require('../services/firebase');
const { authenticate } = require('../middleware/auth');
const admin = require('firebase-admin');
const { createUserVirtualAccount } = require('../services/flutterwaveService');
const { getPlanLimits } = require('../utils/planLimits');

const router = express.Router();

// Calculate total with 4.6% markup
const calculateTotal = (amount) => {
    return Math.ceil(amount * 1.046 / 10) * 10;
};

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

// ============ WEBHOOK (NO AUTHENTICATION REQUIRED) ============
router.post('/webhook', async (req, res) => {
    console.log('💰 Flutterwave webhook received');
    console.log('Webhook body:', JSON.stringify(req.body, null, 2));
    
    // Verify webhook signature
    const secretHash = process.env.FLW_SECRET_HASH;
    const signature = req.headers['verif-hash'];
    
    if (!secretHash) {
        console.error('❌ FLW_SECRET_HASH not configured in .env');
        return res.status(200).send('OK');
    }
    
    if (signature !== secretHash) {
        console.error('❌ Invalid webhook signature');
        return res.status(401).send('Invalid signature');
    }
    
    console.log('✅ Webhook signature verified');
    
    // Immediately return 200 to prevent timeout
    res.status(200).send('OK');
    
    try {
        const event = req.body;
        
        // Handle v3 webhook format (event: charge.completed)
        if (event.event === 'charge.completed' && event.data?.status === 'successful') {
            const data = event.data;
            const email = data.customer?.email;
            const amount = data.amount;
            const chargeId = data.id ? String(data.id) : null;
            const reference = data.flw_ref || data.tx_ref || null;
            
            console.log(`💰 v3 Webhook: Deposit of ₦${amount} from ${email}`);
            
            if (!email) {
                console.error('❌ No email in webhook payload');
                return;
            }
            
            const usersSnapshot = await db.collection('users')
                .where('email', '==', email)
                .limit(1)
                .get();
            
            if (!usersSnapshot.empty) {
                const userDoc = usersSnapshot.docs[0];
                const userId = userDoc.id;
                const user = userDoc.data();
                const currentBalance = user.currentBalance || 0;
                const currentDay = user.currentDay || 1;
                const plan = user.premiumPlan || 'Basic';
                const limits = getPlanLimits(plan);
                
                // Check if amount is within plan limits
                if (amount < limits.min || amount > limits.max) {
                    console.log(`⚠️ Deposit ₦${amount} rejected - outside ${plan} plan limits (₦${limits.min}-₦${limits.max})`);
                    
                    await db.collection('rejectedDeposits').add({
                        userId: userId,
                        amount: amount,
                        plan: plan,
                        minLimit: limits.min,
                        maxLimit: limits.max,
                        reason: `Amount outside ${plan} plan limits`,
                        flwReference: reference,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    return;
                }
                
                // Check for duplicate transaction
                let existingTx = null;
                if (chargeId) {
                    const existingSnapshot = await db.collection('transactions')
                        .where('flwChargeId', '==', chargeId)
                        .limit(1)
                        .get();
                    if (!existingSnapshot.empty) {
                        existingTx = existingSnapshot.docs[0];
                    }
                }
                
                if (existingTx) {
                    console.log('Duplicate webhook received, skipping');
                    return;
                }
                
                // Get all deposit intents for this user
                const intentSnapshot = await db.collection('depositIntents')
                    .where('userId', '==', userId)
                    .get();
                
                let isValidDeposit = true;
                let matchedIntent = null;
                
                if (!intentSnapshot.empty) {
                    // Filter pending intents in memory
                    const pendingIntents = [];
                    intentSnapshot.forEach(doc => {
                        const intent = doc.data();
                        if (intent.status === 'pending') {
                            pendingIntents.push({ id: doc.id, ...intent });
                        }
                    });
                    
                    // Sort by createdAt (newest first) in memory
                    pendingIntents.sort((a, b) => {
                        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                        return dateB - dateA;
                    });
                    
                    if (pendingIntents.length > 0) {
                        const latestIntent = pendingIntents[0];
                        matchedIntent = latestIntent;
                        
                        // Compare with totalWithFee (what they should pay)
                        if (amount !== latestIntent.totalWithFee) {
                            isValidDeposit = false;
                            console.log(`⚠️ Amount mismatch: expected ₦${latestIntent.totalWithFee}, received ₦${amount}`);
                            
                            await db.collection('flaggedDeposits').add({
                                userId: userId,
                                intendedAmount: latestIntent.amount,
                                expectedAmount: latestIntent.totalWithFee,
                                actualAmount: amount,
                                status: 'review_needed',
                                flwReference: reference,
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                        } else {
                            await db.collection('depositIntents').doc(latestIntent.id).update({ 
                                status: 'matched',
                                matchedAt: admin.firestore.FieldValue.serverTimestamp(),
                                // processed: true  // ← ADD THIS
                            });
                        }
                    }
                }
                
                if (isValidDeposit && matchedIntent) {
                    // CREDIT USER WITH THE SAVINGS AMOUNT (matchedIntent.amount)
                    const savingsAmount = matchedIntent.amount;
                    
                    await db.collection('users').doc(userId).update({
                        currentBalance: (currentBalance || 0) + savingsAmount,
                        totalPrincipalSaved: admin.firestore.FieldValue.increment(savingsAmount),
                        ...(currentDay <= 16 && { totalSavedDays1to16: admin.firestore.FieldValue.increment(savingsAmount) })
                    });
                    
                    // Prepare transaction data
                    const transactionData = {
                        userId: userId,
                        type: 'deposit',
                        amount: savingsAmount,
                        method: 'bank_transfer',
                        provider: 'flutterwave',
                        cycle: user.currentCycle || 1,
                        day: currentDay,
                        balanceAfter: (currentBalance || 0) + savingsAmount,
                        isDays1to16: currentDay <= 16,
                        earnsInterest: currentDay <= 16,
                        description: 'Deposit via bank transfer',
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (chargeId) transactionData.flwChargeId = chargeId;
                    if (reference) transactionData.flwReference = reference;
                    
                    await db.collection('transactions').add(transactionData);
                    
                    // Update admin savings pool
                    await db.collection('adminSettings').doc('settings').update({
                        currentTotalSavingsPool: admin.firestore.FieldValue.increment(savingsAmount)
                    });
                    
                    console.log(`✅ Credited ₦${savingsAmount} to user ${userId}`);
                    console.log(`   User paid ₦${amount}, fees deducted separately`);
                    
                    // ===== ✅ ADDED: Send deposit success notification =====
                    await createNotification(
                        userId,
                        '✅ Deposit Successful',
                        `Your deposit of ₦${savingsAmount.toLocaleString()} has been successfully added to your savings balance. ${currentDay <= 16 ? 'This deposit will earn interest!' : '⚠️ Days 17-21 deposits earn NO interest.'}`,
                        'deposit_approved'
                    );
                    // ===== END ADDED =====
                    
                } else if (!isValidDeposit) {
                    console.log(`❌ Deposit NOT credited - amount mismatch`);
                }
            } else {
                console.error(`❌ User not found for email: ${email}`);
            }
        }
        
        // Handle v3 webhook format (type: charge.completed)
        if (event.type === 'charge.completed' && event.data?.status === 'succeeded') {
            const data = event.data;
            const email = data.customer?.email;
            const amount = data.amount;
            const chargeId = data.id;
            const reference = data.reference;
            
            console.log(`💰 v3 Webhook: Deposit of ₦${amount} from ${email}`);
            
            if (!email) {
                console.error('❌ No email in webhook payload');
                return;
            }
            
            const usersSnapshot = await db.collection('users')
                .where('email', '==', email)
                .limit(1)
                .get();
            
            if (!usersSnapshot.empty) {
                const userId = usersSnapshot.docs[0].id;
                const user = usersSnapshot.docs[0].data();
                const currentBalance = user.currentBalance || 0;
                const currentDay = user.currentDay || 1;
                const plan = user.premiumPlan || 'Basic';
                const limits = getPlanLimits(plan);
                
                if (amount < limits.min || amount > limits.max) {
                    console.log(`⚠️ Deposit ₦${amount} rejected - outside ${plan} plan limits`);
                    
                    await db.collection('rejectedDeposits').add({
                        userId: userId,
                        amount: amount,
                        plan: plan,
                        minLimit: limits.min,
                        maxLimit: limits.max,
                        reason: `Amount outside ${plan} plan limits`,
                        flwReference: reference,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    return;
                }
                
                let existingTx = null;
                if (chargeId) {
                    const existingSnapshot = await db.collection('transactions')
                        .where('flwChargeId', '==', chargeId)
                        .limit(1)
                        .get();
                    if (!existingSnapshot.empty) {
                        existingTx = existingSnapshot.docs[0];
                    }
                }
                
                if (existingTx) {
                    console.log('Duplicate webhook received, skipping');
                    return;
                }
                
                // Get all deposit intents for this user
                const intentSnapshot = await db.collection('depositIntents')
                    .where('userId', '==', userId)
                    .get();
                
                let isValidDeposit = true;
                let matchedIntent = null;
                
                if (!intentSnapshot.empty) {
                    const pendingIntents = [];
                    intentSnapshot.forEach(doc => {
                        const intent = doc.data();
                        if (intent.status === 'pending') {
                            pendingIntents.push({ id: doc.id, ...intent });
                        }
                    });
                    
                    pendingIntents.sort((a, b) => {
                        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                        return dateB - dateA;
                    });
                    
                    if (pendingIntents.length > 0) {
                        const latestIntent = pendingIntents[0];
                        matchedIntent = latestIntent;
                        
                        if (amount !== latestIntent.totalWithFee) {
                            isValidDeposit = false;
                            console.log(`⚠️ Amount mismatch: expected ₦${latestIntent.totalWithFee}, received ₦${amount}`);
                            
                            await db.collection('flaggedDeposits').add({
                                userId: userId,
                                intendedAmount: latestIntent.amount,
                                expectedAmount: latestIntent.totalWithFee,
                                actualAmount: amount,
                                status: 'review_needed',
                                flwReference: reference,
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                        } else {
                            await db.collection('depositIntents').doc(latestIntent.id).update({ 
                                status: 'matched',
                                matchedAt: admin.firestore.FieldValue.serverTimestamp(),
                                // processed: true  // ← ADD THIS
                            });
                        }
                    }
                }
                
                if (isValidDeposit && matchedIntent) {
                    const savingsAmount = matchedIntent.amount;
                    
                    await db.collection('users').doc(userId).update({
                        currentBalance: (currentBalance || 0) + savingsAmount,
                        totalPrincipalSaved: admin.firestore.FieldValue.increment(savingsAmount),
                        ...(currentDay <= 16 && { totalSavedDays1to16: admin.firestore.FieldValue.increment(savingsAmount) })
                    });
                    
                    const transactionData = {
                        userId: userId,
                        type: 'deposit',
                        amount: savingsAmount,
                        method: 'bank_transfer',
                        provider: 'flutterwave',
                        cycle: user.currentCycle || 1,
                        day: currentDay,
                        balanceAfter: (currentBalance || 0) + savingsAmount,
                        isDays1to16: currentDay <= 16,
                        earnsInterest: currentDay <= 16,
                        description: 'Deposit via bank transfer',
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    };
                    
                    if (chargeId) transactionData.flwChargeId = chargeId;
                    if (reference) transactionData.flwReference = reference;
                    
                    await db.collection('transactions').add(transactionData);
                    
                    await db.collection('adminSettings').doc('settings').update({
                        currentTotalSavingsPool: admin.firestore.FieldValue.increment(savingsAmount)
                    });
                    
                    console.log(`✅ Credited ₦${savingsAmount} to user ${userId}`);
                    console.log(`   User paid ₦${amount}, fees deducted separately`);
                    
                    // ===== ✅ ADDED: Send deposit success notification =====
                    await createNotification(
                        userId,
                        '✅ Deposit Successful',
                        `Your deposit of ₦${savingsAmount.toLocaleString()} has been successfully added to your savings balance. ${currentDay <= 16 ? 'This deposit will earn interest!' : '⚠️ Days 17-21 deposits earn NO interest.'}`,
                        'deposit_approved'
                    );
                    // ===== END ADDED =====
                    
                } else if (!isValidDeposit) {
                    console.log(`❌ Deposit NOT credited - amount mismatch`);
                }
            }
        }
        
        // ===== ✅ UPDATED: Handle transfer events (withdrawals) =====
        if (event.event === 'transfer.completed') {
            console.log('💰 Transfer completed:', event.data?.reference);
            
            const transferData = event.data;
            const reference = transferData.reference;
            const status = transferData.status; // "SUCCESSFUL" or "FAILED"
            
            // Find the withdrawal request by transfer reference
            const withdrawalSnapshot = await db.collection('withdrawalRequests')
                .where('transferReference', '==', reference)
                .limit(1)
                .get();
            
            if (!withdrawalSnapshot.empty) {
                const withdrawalDoc = withdrawalSnapshot.docs[0];
                const withdrawalId = withdrawalDoc.id;
                const withdrawalData = withdrawalDoc.data();
                const userId = withdrawalData.userId;
                
                if (status === 'SUCCESSFUL') {
                    // ✅ Transfer successful - update status
                    await db.collection('withdrawalRequests').doc(withdrawalId).update({
                        status: 'completed',
                        completedAt: new Date(),
                        flutterwaveStatus: status
                    });
                    
                    // ✅ Send success notification to user
                    await createNotification(
                        userId,
                        '✅ Withdrawal Completed',
                        `Your withdrawal of ₦${withdrawalData.amount.toLocaleString()} has been completed successfully and sent to your bank account.`,
                        'withdrawal_completed'
                    );
                    
                    console.log(`✅ Withdrawal ${reference} completed successfully`);
                    console.log(`📢 Completion notification sent to user ${userId}`);
                    
                } else if (status === 'FAILED') {
                    // ❌ Transfer failed - revert balance and notify user
                    
                    // Get the user
                    const userRef = db.collection('users').doc(userId);
                    const userDoc = await userRef.get();
                    const user = userDoc.data();
                    
                    // Reverse the deducted amount (amount + fee)
                    const totalDeduction = withdrawalData.totalDeduction || withdrawalData.amount + (withdrawalData.fee || 0);
                    
                    // Refund the user
                    await userRef.update({
                        currentBalance: admin.firestore.FieldValue.increment(totalDeduction),
                        totalWithdrawn: admin.firestore.FieldValue.increment(-withdrawalData.amount)
                    });
                    
                    console.log(`🔄 Refunded ₦${totalDeduction} to user ${userId}`);
                    
                    // Update withdrawal request status
                    await db.collection('withdrawalRequests').doc(withdrawalId).update({
                        status: 'failed',
                        flutterwaveStatus: status,
                        failedAt: new Date(),
                        failureReason: transferData.complete_message || 'Transfer failed',
                        refunded: true,
                        refundedAt: new Date()
                    });
                    
                    // Send failure notification to user
                    const failureMessage = transferData.complete_message || 'Transfer failed on Flutterwave';
                    await createNotification(
                        userId,
                        '❌ Withdrawal Failed',
                        `Your withdrawal of ₦${withdrawalData.amount.toLocaleString()} failed. Reason: ${failureMessage}. Your money has been refunded to your wallet.`,
                        'withdrawal_failed'
                    );
                    
                    console.log(`❌ Withdrawal ${reference} failed: ${failureMessage}`);
                }
            } else {
                console.log(`⚠️ No withdrawal request found for reference: ${reference}`);
            }
        }
        
        // Also handle transfer.failed with event.event
        if (event.event === 'transfer.failed') {
            console.error('❌ Transfer failed:', event.data?.reference, event.data?.reason);
            
            const transferData = event.data;
            const reference = transferData.reference;
            
            // Find and update the withdrawal
            const withdrawalSnapshot = await db.collection('withdrawalRequests')
                .where('transferReference', '==', reference)
                .limit(1)
                .get();
            
            if (!withdrawalSnapshot.empty) {
                const withdrawalDoc = withdrawalSnapshot.docs[0];
                const withdrawalId = withdrawalDoc.id;
                const withdrawalData = withdrawalDoc.data();
                const userId = withdrawalData.userId;
                
                // Refund user
                const userRef = db.collection('users').doc(userId);
                const totalDeduction = withdrawalData.totalDeduction || withdrawalData.amount + (withdrawalData.fee || 0);
                
                await userRef.update({
                    currentBalance: admin.firestore.FieldValue.increment(totalDeduction),
                    totalWithdrawn: admin.firestore.FieldValue.increment(-withdrawalData.amount)
                });
                
                await db.collection('withdrawalRequests').doc(withdrawalId).update({
                    status: 'failed',
                    flutterwaveStatus: 'FAILED',
                    failedAt: new Date(),
                    failureReason: transferData.reason || 'Transfer failed',
                    refunded: true,
                    refundedAt: new Date()
                });
                
                // Send notification
                await createNotification(
                    userId,
                    '❌ Withdrawal Failed',
                    `Your withdrawal of ₦${withdrawalData.amount.toLocaleString()} failed. Your money has been refunded to your wallet.`,
                    'withdrawal_failed'
                );
                
                console.log(`❌ Transfer failed for reference: ${reference}`);
            }
        }
        // ===== END UPDATED =====
        
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
    }
});

// ============ ALL ROUTES BELOW REQUIRE AUTHENTICATION ============
router.use(authenticate);

// GET - Fetch all Nigerian banks
router.get('/banks', async (req, res) => {
    try {
        console.log('🟡 Fetching banks from Flutterwave...');
        
        const tokenRes = await axios.post(
            'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
            new URLSearchParams({
                client_id: process.env.FLW_CLIENT_ID,
                client_secret: process.env.FLW_CLIENT_SECRET,
                grant_type: 'client_credentials'
            })
        );
        
        const token = tokenRes.data.access_token;
        
        const response = await axios.get(
            'https://api.flutterwave.com/banks',
            {
                params: { country: 'NG' },
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.data.status === 'success') {
            const banks = response.data.data.map(bank => ({
                code: bank.code,
                name: bank.name
            }));
            
            // Show ALL banks (first 50)
            // console.log('═══════════════════════════════════════');
            // console.log('🏦 FIRST 50 BANKS FROM FLUTTERWAVE:');
            // console.log('═══════════════════════════════════════');
            // banks.slice(0, 50).forEach((bank, index) => {
            //     console.log(`${index + 1}. Code: ${bank.code} | Name: ${bank.name}`);
            // });
            // console.log('═══════════════════════════════════════');
            // console.log(`✅ Total banks fetched: ${banks.length}`);
            
            res.json({ success: true, banks: banks });
        } else {
            res.status(500).json({ error: 'Failed to fetch banks' });
        }
    } catch (error) {
        console.error('❌ Error fetching banks:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch banks' });
    }
});




// Create virtual account for authenticated user
router.post('/create-account', async (req, res) => {
    const userId = req.user.uid;
    const { email, fullName } = req.body;
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = userDoc.data();
        
        if (user.flwAccountNumber) {
            return res.json({
                success: true,
                hasAccount: true,
                accountNumber: user.flwAccountNumber,
                bankName: user.flwBankName,
                message: 'Virtual account already exists'
            });
        }
        
        const result = await createUserVirtualAccount({
            fullName: fullName || user.fullName,
            email: email || user.email,
            bvn: user.bvn,
            phone: user.phone
        });
        
        if (result.success) {
            await db.collection('users').doc(userId).update({
                flwAccountNumber: result.accountNumber,
                flwBankName: result.bankName,
                flwCreatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            res.json({
                success: true,
                hasAccount: true,
                accountNumber: result.accountNumber,
                bankName: result.bankName,
                message: 'Virtual account created successfully'
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error creating virtual account:', error);
        res.status(500).json({ error: 'Failed to create virtual account' });
    }
});

// Get user's virtual account
router.get('/my-account', async (req, res) => {
    const userId = req.user.uid;
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const user = userDoc.data();
        
        if (user.flwAccountNumber) {
            return res.json({
                success: true,
                hasAccount: true,
                accountNumber: user.flwAccountNumber,
                bankName: user.flwBankName,
                fullName: user.fullName
            });
        }
        
        res.json({ success: true, hasAccount: false });
    } catch (error) {
        console.error('Error getting virtual account:', error);
        res.status(500).json({ error: 'Failed to get account details' });
    }
});


// src/routes/flutterwave.js - Add this log
router.post('/validate-account', authenticate, async (req, res) => {
    const { bankCode, accountNumber } = req.body;
    
    if (!bankCode || !accountNumber) {
        return res.status(400).json({ success: false, message: 'Bank code and account number required' });
    }
    
    try {
        const secretKey = process.env.FLW_SECRET_KEY;
        
        const response = await axios.post(
            'https://api.flutterwave.com/v3/accounts/resolve',
            {
                account_number: accountNumber,
                account_bank: bankCode
            },
            {
                headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );
        
        console.log('📡 Account validation response:', response.data.status);
        console.log('📡 Full response:', JSON.stringify(response.data, null, 2)); // ← ADD THIS
        
        if (response.data.status === 'success') {
            return res.json({
                success: true,
                accountName: response.data.data.account_name
            });
        } else {
            return res.json({
                success: false,
                message: response.data.message || 'Account not found'
            });
        }
        
    } catch (error) {
        console.error('❌ Account validation error:', error.response?.status, error.response?.data || error.message);
        
        return res.json({
            success: false,
            message: error.response?.data?.message || 'Failed to validate account. Please try again.'
        });
    }
});

module.exports = router;