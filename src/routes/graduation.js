// const express = require('express');
// const { db } = require('../services/firebase');
// const { authenticate, isAdmin } = require('../middleware/auth');

// // Import Firebase Admin for FieldValue
// const admin = require('firebase-admin');

// const router = express.Router();

// // ============ HELPER FUNCTION ============
// // Convert Firestore Timestamp to ISO string
// const convertTimestamp = (timestamp) => {
//     if (!timestamp) return null;
//     if (typeof timestamp.toDate === 'function') {
//         return timestamp.toDate().toISOString();
//     }
//     if (timestamp._seconds) {
//         return new Date(timestamp._seconds * 1000).toISOString();
//     }
//     if (timestamp.seconds) {
//         return new Date(timestamp.seconds * 1000).toISOString();
//     }
//     return timestamp;
// };

// // ============ CERTIFICATE ROUTES ============
// router.post('/certificate/generate', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     const userDoc = await db.collection('users').doc(userId).get();
    
//     if (!userDoc.exists) {
//         return res.status(404).json({ error: 'User not found' });
//     }
    
//     const user = userDoc.data();
    
//     if (user.currentCycle <= 8 && !user.graduationDate) {
//         return res.status(400).json({ error: 'Not yet graduated. Complete all 8 cycles first.' });
//     }
    
//     const certificateData = {
//         userId,
//         fullName: user.fullName,
//         graduationDate: user.graduationDate ? convertTimestamp(user.graduationDate) : new Date().toISOString(),
//         totalSaved: user.totalPrincipalSaved,
//         totalInterestEarned: user.totalInterestEarned,
//         finalBalance: user.currentBalance,
//         certificateNumber: `SPARK-${userId.slice(0, 8).toUpperCase()}`,
//         generatedAt: new Date().toISOString()
//     };
    
//     const certRef = await db.collection('certificates').add(certificateData);
    
//     res.json({
//         success: true,
//         certificateId: certRef.id,
//         certificate: certificateData
//     });
// });

// router.get('/certificate', authenticate, async (req, res) => {
//     const userId = req.user.uid;
    
//     const certSnapshot = await db.collection('certificates')
//         .where('userId', '==', userId)
//         .limit(1)
//         .get();
    
//     if (certSnapshot.empty) {
//         return res.status(404).json({ error: 'No certificate found' });
//     }
    
//     const cert = certSnapshot.docs[0].data();
//     cert.graduationDate = convertTimestamp(cert.graduationDate);
//     cert.generatedAt = convertTimestamp(cert.generatedAt);
    
//     res.json({ certificate: cert });
// });

// router.get('/alumni/status', authenticate, async (req, res) => {
//     const userId = req.user.uid;
//     const alumniDoc = await db.collection('alumni').doc(userId).get();
//     res.json({ enrolled: alumniDoc.exists });
// });

// router.get('/investments', authenticate, async (req, res) => {
//     const userDoc = await db.collection('users').doc(req.user.uid).get();
//     const user = userDoc.data();
//     const isGraduated = user.currentCycle > 8 || user.graduationDate;
    
//     const investments = {
//         lending: {
//             title: "Micro-Lending (Become the Bank)",
//             description: "Pool money with other graduates to lend to small traders",
//             returnRate: "10-15% over 30-60 days",
//             riskLevel: "Low",
//             minimumInvestment: 10000,
//             available: isGraduated,
//             teaching: "You do not need a bank license to lend money. You just need trust and small amounts."
//         },
//         assets: {
//             title: "Asset Co-Ownership",
//             description: "Own tools together (POS machine, grinding machine, solar panel)",
//             options: [
//                 { name: "POS Machine", cost: 150000, groupSize: 5, eachPays: 30000, monthlyIncome: "₦4,000-₦6,000" },
//                 { name: "Grinding Machine", cost: 200000, groupSize: 5, eachPays: 40000, monthlyIncome: "₦5,000-₦8,000" },
//                 { name: "Solar Panel", cost: 300000, groupSize: 10, eachPays: 30000, monthlyIncome: "₦3,000-₦5,000" }
//             ],
//             available: isGraduated,
//             teaching: "You do not need to own 100% of something to benefit from it. Own 10% of 10 assets, not 100% of nothing."
//         },
//         training: {
//             title: "Training Tickets",
//             description: "Increase your ability to earn",
//             options: [
//                 { name: "Small Business Management", cost: 5000, description: "How to start a shop, manage stock, track profit" },
//                 { name: "Farming for Profit", cost: 10000, description: "How to start a small farm with ₦50,000" },
//                 { name: "Real Estate Basics", cost: 20000, description: "How to save for land, avoid scams, start small" },
//                 { name: "Digital Skills", cost: 15000, description: "Online work, freelancing, remote jobs" }
//             ],
//             available: true,
//             teaching: "The most valuable investment is in yourself. No one can take your knowledge."
//         }
//     };
    
//     res.json(investments);
// });

// router.post('/alumni/enroll', authenticate, async (req, res) => {
//     const userId = req.user.uid;
//     const userDoc = await db.collection('users').doc(userId).get();
//     const user = userDoc.data();
    
//     if (user.currentCycle <= 8 && !user.graduationDate) {
//         return res.status(400).json({ error: 'Must graduate first' });
//     }
    
//     const alumniRef = db.collection('alumni').doc(userId);
//     const alumniDoc = await alumniRef.get();
    
//     if (alumniDoc.exists) {
//         return res.json({ success: true, message: 'Already in alumni group' });
//     }
    
//     await alumniRef.set({
//         userId, fullName: user.fullName, graduationDate: user.graduationDate || new Date(),
//         totalSaved: user.totalPrincipalSaved, enrolledAt: new Date(), active: true
//     });
    
//     res.json({ success: true, message: 'Enrolled in alumni group' });
// });

// router.get('/premium-plans', authenticate, async (req, res) => {
//     const plans = [
//         { name: "Basic", monthlyFee: 0, interestRate: 2, bestFor: "All savers", features: ["Daily savings", "5% interest", "Withdraw anytime"] },
//         { name: "Premium", monthlyFee: 1000, interestRate: 5, bestFor: "Serious savers", features: ["Daily savings", "Higher interest", "Priority withdrawals"] },
//         { name: "Investor", monthlyFee: 2500, interestRate: 8, bestFor: "Those ready to invest", features: ["Daily savings", "Highest interest", "Instant withdrawals", "Access to investments"] }
//     ];
//     res.json(plans);
// });

// router.post('/premium/upgrade', authenticate, async (req, res) => {
//     const { planName } = req.body;
//     const userId = req.user.uid;
    
//     const plans = { Premium: { monthlyFee: 1000, interestRate: 5 }, Investor: { monthlyFee: 2500, interestRate: 8 } };
    
//     if (!plans[planName]) {
//         return res.status(400).json({ error: 'Invalid plan' });
//     }
    
//     const userDoc = await db.collection('users').doc(userId).get();
//     const user = userDoc.data();
    
//     if (user.currentBalance < plans[planName].monthlyFee) {
//         return res.status(400).json({ error: `Insufficient balance` });
//     }
    
//     await db.collection('users').doc(userId).update({
//         currentBalance: admin.firestore.FieldValue.increment(-plans[planName].monthlyFee),
//         premiumPlan: planName,
//         premiumInterestRate: plans[planName].interestRate,
//         premiumStartDate: new Date(),
//         premiumStatus: 'active'
//     });
    
//     await db.collection('transactions').add({
//         userId, type: 'premium_fee', amount: plans[planName].monthlyFee,
//         notes: `Upgraded to ${planName} plan`, createdAt: new Date()
//     });
    
//     res.json({ success: true, plan: planName, message: `Upgraded to ${planName} plan.` });
// });

// router.post('/premium/downgrade', authenticate, async (req, res) => {
//     const userId = req.user.uid;
//     const userDoc = await db.collection('users').doc(userId).get();
//     const user = userDoc.data();
    
//     if (!user.premiumPlan || user.premiumPlan === 'Basic') {
//         return res.status(400).json({ error: 'Already on Basic plan' });
//     }
    
//     await db.collection('users').doc(userId).update({
//         premiumPlan: 'Basic', premiumInterestRate: 2, premiumStatus: 'downgraded', premiumEndDate: new Date()
//     });
    
//     res.json({ success: true, message: 'Downgraded to Basic plan' });
// });

// // ============ HYBRID LENDING ROUTES ============

// // Get hybrid settings
// router.get('/admin/hybrid/settings', authenticate, isAdmin, async (req, res) => {
//     const settingsDoc = await db.collection('adminSettings').doc('settings').get();
//     const settings = settingsDoc.exists ? settingsDoc.data() : {};
    
//     const usersSnapshot = await db.collection('users').where('isActive', '==', true).get();
//     let totalPool = 0;
//     usersSnapshot.forEach(doc => { totalPool += doc.data().currentBalance || 0; });
    
//     res.json({
//         hybridMode: settings.hybridMode || false,
//         lendingPercentage: settings.lendingPercentage || 70,
//         amountAvailableToLend: settings.amountAvailableToLend || 0,
//         totalLentOut: settings.totalLentOut || 0,
//         platformEarnings: settings.platformEarnings || 0,
//         totalSavingsPool: totalPool,
//         lendingStartDate: convertTimestamp(settings.lendingStartDate),
//         updatedAt: convertTimestamp(settings.updatedAt)
//     });
// });

// // Activate hybrid mode
// router.post('/admin/hybrid/transition', authenticate, isAdmin, async (req, res) => {
//     const { lendPercentage = 70 } = req.body;
    
//     const usersSnapshot = await db.collection('users').where('isActive', '==', true).get();
//     let totalPool = 0;
//     usersSnapshot.forEach(doc => { totalPool += doc.data().currentBalance || 0; });
    
//     const amountToLend = totalPool * (lendPercentage / 100);
    
//     await db.collection('adminSettings').doc('settings').set({
//         hybridMode: true, lendingPercentage: lendPercentage, lendingStartDate: new Date(),
//         totalLentOut: 0, totalInterestFromLending: 0, amountAvailableToLend: amountToLend,
//         currentTotalSavingsPool: totalPool, updatedAt: new Date()
//     }, { merge: true });
    
//     res.json({
//         success: true,
//         message: `Hybrid mode activated. ${lendPercentage}% (₦${amountToLend.toLocaleString()}) available for lending.`,
//         totalPool,
//         amountToLend
//     });
// });

// // Create loan
// router.post('/admin/loans/create', authenticate, isAdmin, async (req, res) => {
//     const { borrowerName, borrowerPhone, amount, interestRate, durationDays, purpose } = req.body;
    
//     console.log('Creating loan with data:', req.body);
    
//     try {
//         const settingsDoc = await db.collection('adminSettings').doc('settings').get();
//         const settings = settingsDoc.data();
        
//         if (!settings.hybridMode) {
//             return res.status(400).json({ error: 'Hybrid mode not activated yet' });
//         }
        
//         const loanAmount = parseFloat(amount);
//         const rate = parseFloat(interestRate);
//         const days = parseInt(durationDays);
        
//         if (isNaN(loanAmount) || loanAmount <= 0) {
//             return res.status(400).json({ error: 'Invalid loan amount' });
//         }
        
//         if (loanAmount > (settings.amountAvailableToLend || 0)) {
//             return res.status(400).json({ error: `Amount exceeds available lending pool (₦${(settings.amountAvailableToLend || 0).toLocaleString()})` });
//         }
        
//         const interestAmount = loanAmount * (rate / 100);
//         const dueDate = new Date();
//         dueDate.setDate(dueDate.getDate() + days);
        
//         const loanData = {
//             borrowerName: borrowerName || 'Unknown',
//             borrowerPhone: borrowerPhone || '',
//             amount: loanAmount,
//             interestRate: rate,
//             interestAmount: interestAmount,
//             durationDays: days,
//             dueDate: dueDate,
//             purpose: purpose || '',
//             status: 'active',
//             createdAt: new Date()
//         };
        
//         console.log('Saving loan data:', loanData);
        
//         const loanRef = await db.collection('loans').add(loanData);
        
//         await db.collection('adminSettings').doc('settings').update({
//             amountAvailableToLend: admin.firestore.FieldValue.increment(-loanAmount),
//             totalLentOut: admin.firestore.FieldValue.increment(loanAmount)
//         });
        
//         res.json({
//             success: true,
//             loanId: loanRef.id,
//             message: `Loan of ₦${loanAmount.toLocaleString()} recorded. Due: ${dueDate.toLocaleDateString()}`
//         });
//     } catch (error) {
//         console.error('Error creating loan:', error);
//         res.status(500).json({ error: 'Failed to create loan: ' + error.message });
//     }
// });

// // Get all loans (NO orderBy - avoids index issues)
// // Get all loans - FIXED to convert dates properly
// router.get('/admin/loans', authenticate, isAdmin, async (req, res) => {
//     try {
//         // Fetch all loans without orderBy
//         const snapshot = await db.collection('loans').get();
//         const loans = [];
        
//         for (const doc of snapshot.docs) {
//             const data = doc.data();
            
//             // Convert Firestore Timestamp to ISO string properly
//             let dueDate = null;
//             let createdAt = null;
//             let repaidAt = null;
            
//             // Handle dueDate
//             if (data.dueDate) {
//                 if (typeof data.dueDate.toDate === 'function') {
//                     dueDate = data.dueDate.toDate().toISOString();
//                 } else if (data.dueDate._seconds) {
//                     dueDate = new Date(data.dueDate._seconds * 1000).toISOString();
//                 } else if (data.dueDate.seconds) {
//                     dueDate = new Date(data.dueDate.seconds * 1000).toISOString();
//                 }
//             }
            
//             // Handle createdAt
//             if (data.createdAt) {
//                 if (typeof data.createdAt.toDate === 'function') {
//                     createdAt = data.createdAt.toDate().toISOString();
//                 } else if (data.createdAt._seconds) {
//                     createdAt = new Date(data.createdAt._seconds * 1000).toISOString();
//                 } else if (data.createdAt.seconds) {
//                     createdAt = new Date(data.createdAt.seconds * 1000).toISOString();
//                 }
//             }
            
//             // Handle repaidAt
//             if (data.repaidAt) {
//                 if (typeof data.repaidAt.toDate === 'function') {
//                     repaidAt = data.repaidAt.toDate().toISOString();
//                 } else if (data.repaidAt._seconds) {
//                     repaidAt = new Date(data.repaidAt._seconds * 1000).toISOString();
//                 } else if (data.repaidAt.seconds) {
//                     repaidAt = new Date(data.repaidAt.seconds * 1000).toISOString();
//                 }
//             }
            
//             loans.push({
//                 id: doc.id,
//                 borrowerName: data.borrowerName,
//                 borrowerPhone: data.borrowerPhone,
//                 amount: data.amount,
//                 interestRate: data.interestRate,
//                 interestAmount: data.interestAmount,
//                 durationDays: data.durationDays,
//                 purpose: data.purpose,
//                 status: data.status,
//                 totalRepaid: data.totalRepaid,
//                 createdAt: createdAt,
//                 dueDate: dueDate,
//                 repaidAt: repaidAt
//             });
//         }
        
//         // Sort manually by createdAt (newest first)
//         loans.sort((a, b) => {
//             const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
//             const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
//             return dateB - dateA;
//         });
        
//         console.log('Sending loans with converted dates:', loans.map(l => ({ id: l.id, dueDate: l.dueDate })));
        
//         res.json(loans);
//     } catch (error) {
//         console.error('Error getting loans:', error);
//         res.status(500).json({ error: 'Failed to get loans' });
//     }
// });

// // Repay loan
// // Repay loan - Simple version (interest goes to platform earnings)
// router.post('/admin/loans/:loanId/repay', authenticate, isAdmin, async (req, res) => {
//     const { loanId } = req.params;
    
//     try {
//         const loanRef = db.collection('loans').doc(loanId);
//         const loanDoc = await loanRef.get();
        
//         if (!loanDoc.exists) {
//             return res.status(404).json({ error: 'Loan not found' });
//         }
        
//         const loan = loanDoc.data();
        
//         if (loan.status !== 'active') {
//             return res.status(400).json({ error: 'Loan already repaid' });
//         }
        
//         const totalRepayment = loan.amount + loan.interestAmount;
//         const platformProfit = loan.interestAmount;
        
//         // 1. Mark loan as repaid
//         await loanRef.update({ 
//             status: 'repaid', 
//             repaidAt: new Date(),
//             repaidBy: req.user.uid,
//             totalRepaid: totalRepayment
//         });
        
//         // 2. Return principal to available lending pool
//         // 3. Add interest to platform earnings
//         await db.collection('adminSettings').doc('settings').update({
//             amountAvailableToLend: admin.firestore.FieldValue.increment(loan.amount),
//             platformEarnings: admin.firestore.FieldValue.increment(platformProfit),
//             totalRepaidFromLending: admin.firestore.FieldValue.increment(totalRepayment)
//         });
        
//         res.json({ 
//             success: true, 
//             message: `Loan repaid successfully. ₦${loan.amount.toLocaleString()} returned to lending pool. Platform earnings: ₦${platformProfit.toLocaleString()}`,
//             details: {
//                 principalReturned: loan.amount,
//                 platformProfit: platformProfit,
//                 totalReceived: totalRepayment
//             }
//         });
//     } catch (error) {
//         console.error('Error repaying loan:', error);
//         res.status(500).json({ error: 'Failed to repay loan' });
//     }
// });

// module.exports = router;

const express = require('express');
const { db } = require('../services/firebase');
const { authenticate, isAdmin } = require('../middleware/auth');
const admin = require('firebase-admin');

const router = express.Router();

// ============ HELPER FUNCTIONS ============

// Convert Firestore Timestamp to ISO string
const convertTimestamp = (timestamp) => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    if (timestamp._seconds) {
        return new Date(timestamp._seconds * 1000).toISOString();
    }
    if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toISOString();
    }
    return timestamp;
};

// Get plan details
const getPlanDetails = (planName) => {
    const plans = {
        Basic: { monthlyFee: 0, interestRate: 5, dailyMin: 100, dailyMax: 2000, level: 1, features: [] },
        Premium: { monthlyFee: 1000, interestRate: 4, dailyMin: 500, dailyMax: 10000, level: 2, features: [] },
        Investor: { monthlyFee: 2500, interestRate: 3, dailyMin: 1000, dailyMax: 20000, level: 3, features: [] }
    };
    return plans[planName];
};

// ============ CERTIFICATE ROUTES ============

// Generate certificate
router.post('/certificate/generate', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userDoc.data();
    
    if (user.currentCycle <= 8 && !user.graduationDate) {
        return res.status(400).json({ error: 'Not yet graduated. Complete all 8 cycles first.' });
    }
    
    const certificateData = {
        userId,
        fullName: user.fullName,
        graduationDate: user.graduationDate ? convertTimestamp(user.graduationDate) : new Date().toISOString(),
        totalSaved: user.totalPrincipalSaved,
        totalInterestEarned: user.totalInterestEarned,
        finalBalance: user.currentBalance,
        certificateNumber: `SPARK-${userId.slice(0, 8).toUpperCase()}`,
        generatedAt: new Date().toISOString()
    };
    
    const certRef = await db.collection('certificates').add(certificateData);
    
    res.json({
        success: true,
        certificateId: certRef.id,
        certificate: certificateData
    });
});

// Get certificate
router.get('/certificate', authenticate, async (req, res) => {
    const userId = req.user.uid;
    
    const certSnapshot = await db.collection('certificates')
        .where('userId', '==', userId)
        .limit(1)
        .get();
    
    if (certSnapshot.empty) {
        return res.status(404).json({ error: 'No certificate found' });
    }
    
    const cert = certSnapshot.docs[0].data();
    cert.graduationDate = convertTimestamp(cert.graduationDate);
    cert.generatedAt = convertTimestamp(cert.generatedAt);
    
    res.json({ certificate: cert });
});

// ============ ALUMNI ROUTES ============

// Check alumni status
router.get('/alumni/status', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const alumniDoc = await db.collection('alumni').doc(userId).get();
    res.json({ enrolled: alumniDoc.exists });
});

// Enroll in alumni
router.post('/alumni/enroll', authenticate, async (req, res) => {
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    
    if (user.currentCycle <= 8 && !user.graduationDate) {
        return res.status(400).json({ error: 'Must graduate first' });
    }
    
    const alumniRef = db.collection('alumni').doc(userId);
    const alumniDoc = await alumniRef.get();
    
    if (alumniDoc.exists) {
        return res.json({ success: true, message: 'Already in alumni group' });
    }
    
    await alumniRef.set({
        userId,
        fullName: user.fullName,
        graduationDate: user.graduationDate || new Date(),
        totalSaved: user.totalPrincipalSaved,
        enrolledAt: new Date(),
        active: true
    });
    
    res.json({ success: true, message: 'Enrolled in alumni group' });
});

// ============ INVESTMENT ROUTES ============

// Get investment opportunities
router.get('/investments', authenticate, async (req, res) => {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const user = userDoc.data();
    const isGraduated = user.currentCycle > 8 || user.graduationDate;
    
    const investments = {
        lending: {
            title: "Micro-Lending (Become the Bank)",
            description: "Pool money with other graduates to lend to small traders",
            returnRate: "10-15% over 30-60 days",
            riskLevel: "Low",
            minimumInvestment: 10000,
            available: isGraduated,
            teaching: "You do not need a bank license to lend money. You just need trust and small amounts."
        },
        assets: {
            title: "Asset Co-Ownership",
            description: "Own tools together (POS machine, grinding machine, solar panel)",
            options: [
                { name: "POS Machine", cost: 150000, groupSize: 5, eachPays: 30000, monthlyIncome: "₦4,000-₦6,000" },
                { name: "Grinding Machine", cost: 200000, groupSize: 5, eachPays: 40000, monthlyIncome: "₦5,000-₦8,000" },
                { name: "Solar Panel", cost: 300000, groupSize: 10, eachPays: 30000, monthlyIncome: "₦3,000-₦5,000" }
            ],
            available: isGraduated,
            teaching: "You do not need to own 100% of something to benefit from it. Own 10% of 10 assets, not 100% of nothing."
        },
        training: {
            title: "Training Tickets",
            description: "Increase your ability to earn",
            options: [
                { name: "Small Business Management", cost: 5000, description: "How to start a shop, manage stock, track profit" },
                { name: "Farming for Profit", cost: 10000, description: "How to start a small farm with ₦50,000" },
                { name: "Real Estate Basics", cost: 20000, description: "How to save for land, avoid scams, start small" },
                { name: "Digital Skills", cost: 15000, description: "Online work, freelancing, remote jobs" }
            ],
            available: true,
            teaching: "The most valuable investment is in yourself. No one can take your knowledge."
        }
    };
    
    res.json(investments);
});

// ============ PREMIUM PLANS ROUTES ============

// Get premium plans
router.get('/premium-plans', authenticate, async (req, res) => {
    const plans = [
        { 
            name: "Basic", 
            monthlyFee: 0, 
            interestRate: 5, 
            dailyMin: 100, 
            dailyMax: 2000,
            bestFor: "Perfect for beginners",
            features: [
                    '✓ Graduate certificate after 8 cycles',
                    '✓ Full access to wealth education library',
                    '✓ Daily educational messages',
                    '✓ 21-day cycle tracking',
                    '✓ Progress dashboard',
                    '✓ Referral program access',
                    '✓ Community forum access',
                    '✓ Basic email support',
                    '✓ Cycle completion milestones'
            ]
        },
        { 
            name: "Premium", 
            monthlyFee: 1000, 
            interestRate: 4, 
            dailyMin: 500, 
            dailyMax: 10000,
            bestFor: "For serious savers",
            features: [
                    '✓ Graduate certificate after 8 cycles',
                    '✓ Priority support response (within 12 hours)',
                    '✓ Private Premium WhatsApp community',
                    '✓ Weekly live coaching calls',
                    '✓ Exclusive video lessons',
                    '✓ Downloadable worksheets',
                    '✓ Goal-setting workshops',
                    '✓ Monthly progress reports',
                    '✓ Early access to new features',
                    '✓ All Basic features included'
            ]
        },
        { 
            name: "Investor", 
            monthlyFee: 2500, 
            interestRate: 3, 
            dailyMin: 1000, 
            dailyMax: 20000,
            bestFor: "For wealth builders",
            features: [
                    '✓ Graduate certificate after 8 cycles',
                    '✓ Priority support response (within 6 hours)',
                    '✓ Private Investor WhatsApp community',
                    '✓ Weekly one-on-one coaching sessions',
                    '✓ Exclusive advanced learning content',
                    '✓ Investment education modules',
                    '✓ Asset-building workshops',
                    '✓ Real estate education',
                    '✓ Business development resources',
                    '✓ Quarterly strategy sessions',
                    '✓ All Premium features included'
            ]
        }
    ];
    res.json(plans);
});

// Upgrade or downgrade plan
router.post('/premium/upgrade', authenticate, async (req, res) => {
    const { planName } = req.body;
    const userId = req.user.uid;
    
    const plans = {
        Basic: { monthlyFee: 0, interestRate: 5, dailyMax: 2000, level: 1 },
        Premium: { monthlyFee: 1000, interestRate: 4, dailyMax: 10000, level: 2 },
        Investor: { monthlyFee: 2500, interestRate: 3, dailyMax: 20000, level: 3 }
    };
    
    if (!plans[planName]) {
        return res.status(400).json({ error: 'Invalid plan' });
    }
    
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();
    const currentPlan = user.premiumPlan || 'Basic';
    const targetPlan = plans[planName];
    const currentPlanDetails = plans[currentPlan];
    
    // If same plan
    if (currentPlan === planName) {
        return res.status(400).json({ error: `You are already on the ${planName} plan` });
    }
    
    // Handle UPGRADE (going to higher plan)
    if (targetPlan.level > currentPlanDetails.level) {
        const fee = targetPlan.monthlyFee;
        
        if (user.currentBalance < fee) {
            return res.status(400).json({ error: `Insufficient balance. Need ₦${fee.toLocaleString()} to upgrade to ${planName}` });
        }
        
        // Deduct fee
        await db.collection('users').doc(userId).update({
            currentBalance: admin.firestore.FieldValue.increment(-fee),
            premiumPlan: planName,
            premiumInterestRate: targetPlan.interestRate,
            premiumStartDate: new Date(),
            premiumStatus: 'active',
            dailySaveMax: targetPlan.dailyMax
        });
        
        // Record transaction
        await db.collection('transactions').add({
            userId,
            type: 'premium_fee',
            amount: fee,
            description: `Upgraded from ${currentPlan} to ${planName} plan`,
            createdAt: new Date()
        });
        
        return res.json({ 
            success: true, 
            plan: planName, 
            message: `Successfully upgraded to ${planName} plan! You now save up to ₦${targetPlan.dailyMax.toLocaleString()}/day and earn ${targetPlan.interestRate}% interest.`
        });
    }
    
    // Handle DOWNGRADE (going to lower plan)
    if (targetPlan.level < currentPlanDetails.level) {
        // No fee for downgrade
        await db.collection('users').doc(userId).update({
            premiumPlan: planName,
            premiumInterestRate: targetPlan.interestRate,
            premiumEndDate: new Date(),
            premiumStatus: 'downgraded',
            dailySaveMax: targetPlan.dailyMax
        });
        
        // Record transaction
        await db.collection('transactions').add({
            userId,
            type: 'plan_change',
            amount: 0,
            description: `Downgraded from ${currentPlan} to ${planName} plan`,
            createdAt: new Date()
        });
        
        return res.json({ 
            success: true, 
            plan: planName, 
            message: `Downgraded to ${planName} plan. Your daily save limit is now ₦${targetPlan.dailyMax.toLocaleString()}/day with ${targetPlan.interestRate}% interest.`
        });
    }
    
    res.status(400).json({ error: 'Unable to process plan change' });
});

// ============ HYBRID LENDING ROUTES (Admin only) ============

// Get hybrid settings
router.get('/admin/hybrid/settings', authenticate, isAdmin, async (req, res) => {
    const settingsDoc = await db.collection('adminSettings').doc('settings').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    
    const usersSnapshot = await db.collection('users').where('isActive', '==', true).get();
    let totalPool = 0;
    usersSnapshot.forEach(doc => { totalPool += doc.data().currentBalance || 0; });
    
    res.json({
        hybridMode: settings.hybridMode || false,
        lendingPercentage: settings.lendingPercentage || 70,
        amountAvailableToLend: settings.amountAvailableToLend || 0,
        totalLentOut: settings.totalLentOut || 0,
        platformEarnings: settings.platformEarnings || 0,
        totalSavingsPool: totalPool,
        lendingStartDate: convertTimestamp(settings.lendingStartDate),
        updatedAt: convertTimestamp(settings.updatedAt)
    });
});

// Activate hybrid mode
router.post('/admin/hybrid/transition', authenticate, isAdmin, async (req, res) => {
    const { lendPercentage = 70 } = req.body;
    
    const usersSnapshot = await db.collection('users').where('isActive', '==', true).get();
    let totalPool = 0;
    usersSnapshot.forEach(doc => { totalPool += doc.data().currentBalance || 0; });
    
    const amountToLend = totalPool * (lendPercentage / 100);
    
    await db.collection('adminSettings').doc('settings').set({
        hybridMode: true,
        lendingPercentage: lendPercentage,
        lendingStartDate: new Date(),
        totalLentOut: 0,
        totalInterestFromLending: 0,
        amountAvailableToLend: amountToLend,
        currentTotalSavingsPool: totalPool,
        updatedAt: new Date()
    }, { merge: true });
    
    res.json({
        success: true,
        message: `Hybrid mode activated. ${lendPercentage}% (₦${amountToLend.toLocaleString()}) available for lending.`,
        totalPool,
        amountToLend
    });
});

// Create loan
router.post('/admin/loans/create', authenticate, isAdmin, async (req, res) => {
    const { borrowerName, borrowerPhone, amount, interestRate, durationDays, purpose } = req.body;
    
    try {
        const settingsDoc = await db.collection('adminSettings').doc('settings').get();
        const settings = settingsDoc.data();
        
        if (!settings.hybridMode) {
            return res.status(400).json({ error: 'Hybrid mode not activated yet' });
        }
        
        const loanAmount = parseFloat(amount);
        const rate = parseFloat(interestRate);
        const days = parseInt(durationDays);
        
        if (isNaN(loanAmount) || loanAmount <= 0) {
            return res.status(400).json({ error: 'Invalid loan amount' });
        }
        
        if (loanAmount > (settings.amountAvailableToLend || 0)) {
            return res.status(400).json({ error: `Amount exceeds available lending pool (₦${(settings.amountAvailableToLend || 0).toLocaleString()})` });
        }
        
        const interestAmount = loanAmount * (rate / 100);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);
        
        const loanData = {
            borrowerName: borrowerName || 'Unknown',
            borrowerPhone: borrowerPhone || '',
            amount: loanAmount,
            interestRate: rate,
            interestAmount: interestAmount,
            durationDays: days,
            dueDate: dueDate,
            purpose: purpose || '',
            status: 'active',
            createdAt: new Date()
        };
        
        const loanRef = await db.collection('loans').add(loanData);
        
        await db.collection('adminSettings').doc('settings').update({
            amountAvailableToLend: admin.firestore.FieldValue.increment(-loanAmount),
            totalLentOut: admin.firestore.FieldValue.increment(loanAmount)
        });
        
        res.json({
            success: true,
            loanId: loanRef.id,
            message: `Loan of ₦${loanAmount.toLocaleString()} recorded. Due: ${dueDate.toLocaleDateString()}`
        });
    } catch (error) {
        console.error('Error creating loan:', error);
        res.status(500).json({ error: 'Failed to create loan: ' + error.message });
    }
});

// Get all loans
router.get('/admin/loans', authenticate, isAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('loans').get();
        const loans = [];
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            let dueDate = null;
            let createdAt = null;
            let repaidAt = null;
            
            if (data.dueDate) {
                if (typeof data.dueDate.toDate === 'function') {
                    dueDate = data.dueDate.toDate().toISOString();
                } else if (data.dueDate._seconds) {
                    dueDate = new Date(data.dueDate._seconds * 1000).toISOString();
                } else if (data.dueDate.seconds) {
                    dueDate = new Date(data.dueDate.seconds * 1000).toISOString();
                }
            }
            
            if (data.createdAt) {
                if (typeof data.createdAt.toDate === 'function') {
                    createdAt = data.createdAt.toDate().toISOString();
                } else if (data.createdAt._seconds) {
                    createdAt = new Date(data.createdAt._seconds * 1000).toISOString();
                } else if (data.createdAt.seconds) {
                    createdAt = new Date(data.createdAt.seconds * 1000).toISOString();
                }
            }
            
            if (data.repaidAt) {
                if (typeof data.repaidAt.toDate === 'function') {
                    repaidAt = data.repaidAt.toDate().toISOString();
                } else if (data.repaidAt._seconds) {
                    repaidAt = new Date(data.repaidAt._seconds * 1000).toISOString();
                } else if (data.repaidAt.seconds) {
                    repaidAt = new Date(data.repaidAt.seconds * 1000).toISOString();
                }
            }
            
            loans.push({
                id: doc.id,
                borrowerName: data.borrowerName,
                borrowerPhone: data.borrowerPhone,
                amount: data.amount,
                interestRate: data.interestRate,
                interestAmount: data.interestAmount,
                durationDays: data.durationDays,
                purpose: data.purpose,
                status: data.status,
                totalRepaid: data.totalRepaid,
                createdAt: createdAt,
                dueDate: dueDate,
                repaidAt: repaidAt
            });
        }
        
        loans.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return dateB - dateA;
        });
        
        res.json(loans);
    } catch (error) {
        console.error('Error getting loans:', error);
        res.status(500).json({ error: 'Failed to get loans' });
    }
});

// Repay loan
router.post('/admin/loans/:loanId/repay', authenticate, isAdmin, async (req, res) => {
    const { loanId } = req.params;
    
    try {
        const loanRef = db.collection('loans').doc(loanId);
        const loanDoc = await loanRef.get();
        
        if (!loanDoc.exists) {
            return res.status(404).json({ error: 'Loan not found' });
        }
        
        const loan = loanDoc.data();
        
        if (loan.status !== 'active') {
            return res.status(400).json({ error: 'Loan already repaid' });
        }
        
        const totalRepayment = loan.amount + loan.interestAmount;
        const platformProfit = loan.interestAmount;
        
        await loanRef.update({ 
            status: 'repaid', 
            repaidAt: new Date(),
            repaidBy: req.user.uid,
            totalRepaid: totalRepayment
        });
        
        await db.collection('adminSettings').doc('settings').update({
            amountAvailableToLend: admin.firestore.FieldValue.increment(loan.amount),
            platformEarnings: admin.firestore.FieldValue.increment(platformProfit),
            totalRepaidFromLending: admin.firestore.FieldValue.increment(totalRepayment)
        });
        
        res.json({ 
            success: true, 
            message: `Loan repaid successfully. ₦${loan.amount.toLocaleString()} returned to lending pool. Platform earnings: ₦${platformProfit.toLocaleString()}`,
            details: {
                principalReturned: loan.amount,
                platformProfit: platformProfit,
                totalReceived: totalRepayment
            }
        });
    } catch (error) {
        console.error('Error repaying loan:', error);
        res.status(500).json({ error: 'Failed to repay loan' });
    }
});

module.exports = router;