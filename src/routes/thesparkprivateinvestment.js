// const express = require('express');
// const { db } = require('../services/firebase');
// const { authenticate } = require('../middleware/auth');
// const admin = require('firebase-admin');
// const crypto = require('crypto');

// const router = express.Router();

// // ============ GENERATE ACCESS CODE ============
// const generateAccessCode = () => {
//     return crypto.randomBytes(4).toString('hex').toUpperCase();
// };

// // ============ VERIFY ACCESS CODE (AUTHENTICATED) ============
// router.post('/verify-code', authenticate, async (req, res) => {
//     const { accessCode } = req.body;
//     const userId = req.user.uid;
    
//     if (!accessCode) {
//         return res.status(400).json({ 
//             success: false, 
//             error: 'Access code is required' 
//         });
//     }
    
//     try {
//         // ✅ Check if access code exists, is NOT used, and NOT expired
//         const codeSnapshot = await db.collection('investmentAccessCodes')
//             .where('code', '==', accessCode.toUpperCase())
//             .where('isUsed', '==', false)
//             .get();
        
//         if (codeSnapshot.empty) {
//             return res.status(401).json({ 
//                 success: false, 
//                 error: 'Invalid or expired access code' 
//             });
//         }
        
//         const doc = codeSnapshot.docs[0];
//         const data = doc.data();
        
//         // ✅ Check if expired (24 hours)
//         if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
//             return res.status(401).json({ 
//                 success: false, 
//                 error: 'Access code has expired (24 hours)' 
//             });
//         }
        
//         // ✅ CRITICAL: Check if code is already locked to a different user
//         if (data.lockedBy && data.lockedBy !== userId) {
//             return res.status(403).json({ 
//                 success: false, 
//                 error: 'This code is already being used by another investor. Access denied.' 
//             });
//         }
        
//         // ✅ Lock the code to this specific user (if not already locked)
//         if (!data.lockedBy) {
//             await doc.ref.update({ 
//                 lockedBy: userId,
//                 lockedAt: admin.firestore.FieldValue.serverTimestamp()
//             });
//         }
        
//         res.json({ 
//             success: true, 
//             message: 'Access code verified',
//             investorName: data.investorName || '',
//             userId: userId
//         });
//     } catch (error) {
//         console.error('Error verifying access code:', error);
//         res.status(500).json({ 
//             success: false, 
//             error: 'Failed to verify access code' 
//         });
//     }
// });

// // ============ SUBMIT INVESTMENT INTEREST (AUTHENTICATED) ============
// router.post('/interest', authenticate, async (req, res) => {
//     const { 
//         fullName, 
//         email, 
//         phone, 
//         investmentAmount,
//         customAmount,
//         accessCode
//     } = req.body;
//     const userId = req.user.uid;
    
//     try {
//         // ✅ Verify access code is valid (not used, not expired)
//         const codeSnapshot = await db.collection('investmentAccessCodes')
//             .where('code', '==', accessCode.toUpperCase())
//             .where('isUsed', '==', false)
//             .get();
        
//         if (codeSnapshot.empty) {
//             return res.status(401).json({ 
//                 error: 'Invalid or expired access code' 
//             });
//         }
        
//         const codeDoc = codeSnapshot.docs[0];
//         const codeData = codeDoc.data();
        
//         // ✅ Check if expired (24 hours)
//         if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) {
//             return res.status(401).json({ 
//                 error: 'Access code has expired (24 hours)' 
//             });
//         }
        
//         // ✅ CRITICAL: Verify this user is the one who locked the code
//         if (codeData.lockedBy && codeData.lockedBy !== userId) {
//             return res.status(403).json({ 
//                 error: 'This code belongs to another investor. Access denied.' 
//             });
//         }
        
//         // Get user data from Firestore for fallback
//         const userDoc = await db.collection('users').doc(userId).get();
//         const userData = userDoc.data();
        
//         // Use phone from form or fallback to user profile
//         const userPhone = phone || userData?.phone || userData?.phoneNumber || '';
        
//         // Validate investment amount
//         const amount = investmentAmount || customAmount || 0;
//         if (parseInt(amount) < 100000) {
//             return res.status(400).json({ 
//                 error: 'Minimum investment is ₦100,000' 
//             });
//         }
        
//         // Check if user already submitted
//         const existing = await db.collection('investmentInterests')
//             .where('userId', '==', userId)
//             .get();
        
//         if (!existing.empty) {
//             return res.status(400).json({ 
//                 error: 'You have already expressed interest. We will contact you soon.' 
//             });
//         }
        
//         // ✅ Mark access code as used and remove lock
//         await codeDoc.ref.update({
//             isUsed: true,
//             usedAt: admin.firestore.FieldValue.serverTimestamp(),
//             usedBy: userId,
//             lockedBy: admin.firestore.FieldValue.delete(),
//             lockedAt: admin.firestore.FieldValue.delete()
//         });
        
//         // Save investment interest
//         await db.collection('investmentInterests').add({
//             userId,
//             fullName: fullName || userData?.fullName || '',
//             email: email || userData?.email || '',
//             phone: userPhone,
//             investmentAmount: parseInt(amount),
//             accessCode: accessCode.toUpperCase(),
//             investorName: codeData.investorName || '',
//             type: 'profit_sharing',
//             status: 'new',
//             createdAt: admin.firestore.FieldValue.serverTimestamp()
//         });
        
//         // Notify admin
//         await db.collection('notifications').add({
//             userId: 'admin',
//             title: '🔔 New Investment Interest',
//             message: `${fullName || userData?.fullName || 'Anonymous'} interested: ₦${parseInt(amount).toLocaleString()}`,
//             type: 'investment_interest',
//             read: false,
//             createdAt: admin.firestore.FieldValue.serverTimestamp()
//         });
        
//         console.log(`📊 Investment interest: ${fullName || userData?.fullName || 'Anonymous'} - ₦${amount}`);
        
//         res.json({ 
//             success: true, 
//             message: 'Interest submitted successfully' 
//         });
//     } catch (error) {
//         console.error('Error saving investment interest:', error);
//         res.status(500).json({ 
//             error: 'Failed to submit interest. Please try again.' 
//         });
//     }
// });

// // ============ ADMIN: GENERATE ACCESS CODES ============
// router.post('/generate-codes', authenticate, async (req, res) => {
//     const { count = 1, investorName } = req.body;
    
//     try {
//         // Check if user is admin
//         const userDoc = await db.collection('users').doc(req.user.uid).get();
//         if (!userDoc.exists || userDoc.data().role !== 'admin') {
//             return res.status(403).json({ error: 'Admin access required' });
//         }
        
//         const codes = [];
//         const batch = db.batch();
        
//         // ✅ Set expiry to 24 hours from now as Firestore Timestamp
//         const expiryDate = new Date();
//         expiryDate.setHours(expiryDate.getHours() + 24);
//         const expiryTimestamp = admin.firestore.Timestamp.fromDate(expiryDate);
        
//         for (let i = 0; i < count; i++) {
//             const code = generateAccessCode();
//             const ref = db.collection('investmentAccessCodes').doc();
//             batch.set(ref, {
//                 code: code,
//                 investorName: investorName || `Investor ${i + 1}`,
//                 expiresAt: expiryTimestamp,
//                 isUsed: false,
//                 createdAt: admin.firestore.FieldValue.serverTimestamp(),
//                 createdBy: req.user.uid
//             });
//             codes.push(code);
//         }
        
//         await batch.commit();
        
//         res.json({ 
//             success: true, 
//             message: `${codes.length} access codes generated (expires in 24 hours)`,
//             codes: codes,
//             expiresAt: expiryDate.toISOString()
//         });
//     } catch (error) {
//         console.error('Error generating codes:', error);
//         res.status(500).json({ error: 'Failed to generate codes' });
//     }
// });

// // ============ ADMIN: GET ALL ACCESS CODES ============
// router.get('/access-codes', authenticate, async (req, res) => {
//     try {
//         const userDoc = await db.collection('users').doc(req.user.uid).get();
//         if (!userDoc.exists || userDoc.data().role !== 'admin') {
//             return res.status(403).json({ error: 'Admin access required' });
//         }
        
//         const snapshot = await db.collection('investmentAccessCodes')
//             .orderBy('createdAt', 'desc')
//             .get();
        
//         const codes = [];
//         snapshot.forEach(doc => {
//             const data = doc.data();
//             codes.push({ 
//                 id: doc.id, 
//                 code: data.code,
//                 investorName: data.investorName,
//                 isUsed: data.isUsed,
//                 createdBy: data.createdBy,
//                 usedBy: data.usedBy || null,
//                 lockedBy: data.lockedBy || null,
//                 createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : null,
//                 expiresAt: data.expiresAt?.toDate?.() ? data.expiresAt.toDate().toISOString() : null,
//                 usedAt: data.usedAt?.toDate?.() ? data.usedAt.toDate().toISOString() : null,
//                 lockedAt: data.lockedAt?.toDate?.() ? data.lockedAt.toDate().toISOString() : null
//             });
//         });
        
//         res.json(codes);
//     } catch (error) {
//         console.error('Error fetching access codes:', error);
//         res.status(500).json({ error: 'Failed to fetch access codes' });
//     }
// });

// // ============ GET ALL INVESTMENT INTERESTS (ADMIN ONLY) ============
// router.get('/interests', authenticate, async (req, res) => {
//     try {
//         const userDoc = await db.collection('users').doc(req.user.uid).get();
//         if (!userDoc.exists || userDoc.data().role !== 'admin') {
//             return res.status(403).json({ error: 'Admin access required' });
//         }
        
//         const snapshot = await db.collection('investmentInterests')
//             .orderBy('createdAt', 'desc')
//             .get();
        
//         const interests = [];
//         snapshot.forEach(doc => {
//             interests.push({ 
//                 id: doc.id, 
//                 ...doc.data(),
//                 createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
//             });
//         });
        
//         res.json(interests);
//     } catch (error) {
//         console.error('Error fetching investment interests:', error);
//         res.status(500).json({ error: 'Failed to fetch interests' });
//     }
// });

// // ============ GET SINGLE INVESTMENT INTEREST (ADMIN ONLY) ============
// router.get('/interests/:id', authenticate, async (req, res) => {
//     const { id } = req.params;
    
//     try {
//         const userDoc = await db.collection('users').doc(req.user.uid).get();
//         if (!userDoc.exists || userDoc.data().role !== 'admin') {
//             return res.status(403).json({ error: 'Admin access required' });
//         }
        
//         const doc = await db.collection('investmentInterests').doc(id).get();
//         if (!doc.exists) {
//             return res.status(404).json({ error: 'Investment interest not found' });
//         }
        
//         res.json({ 
//             id: doc.id, 
//             ...doc.data(),
//             createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
//         });
//     } catch (error) {
//         console.error('Error fetching investment interest:', error);
//         res.status(500).json({ error: 'Failed to fetch interest' });
//     }
// });

// // ============ UPDATE INVESTMENT INTEREST STATUS (ADMIN ONLY) ============
// router.put('/interests/:id/status', authenticate, async (req, res) => {
//     const { id } = req.params;
//     const { status, notes } = req.body;
    
//     try {
//         const userDoc = await db.collection('users').doc(req.user.uid).get();
//         if (!userDoc.exists || userDoc.data().role !== 'admin') {
//             return res.status(403).json({ error: 'Admin access required' });
//         }
        
//         const validStatuses = ['new', 'contacted', 'invested', 'not_interested'];
//         if (!validStatuses.includes(status)) {
//             return res.status(400).json({ error: 'Invalid status' });
//         }
        
//         await db.collection('investmentInterests').doc(id).update({
//             status: status,
//             notes: notes || '',
//             updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//             updatedBy: req.user.uid
//         });
        
//         res.json({ success: true, message: 'Status updated successfully' });
//     } catch (error) {
//         console.error('Error updating investment interest:', error);
//         res.status(500).json({ error: 'Failed to update status' });
//     }
// });

// // ============ DELETE INVESTMENT INTEREST (ADMIN ONLY) ============
// router.delete('/interests/:id', authenticate, async (req, res) => {
//     const { id } = req.params;
    
//     try {
//         const userDoc = await db.collection('users').doc(req.user.uid).get();
//         if (!userDoc.exists || userDoc.data().role !== 'admin') {
//             return res.status(403).json({ error: 'Admin access required' });
//         }
        
//         await db.collection('investmentInterests').doc(id).delete();
        
//         res.json({ success: true, message: 'Investment interest deleted successfully' });
//     } catch (error) {
//         console.error('Error deleting investment interest:', error);
//         res.status(500).json({ error: 'Failed to delete interest' });
//     }
// });

// // ============ GET STATS (ADMIN ONLY) ============
// router.get('/stats', authenticate, async (req, res) => {
//     try {
//         const userDoc = await db.collection('users').doc(req.user.uid).get();
//         if (!userDoc.exists || userDoc.data().role !== 'admin') {
//             return res.status(403).json({ error: 'Admin access required' });
//         }
        
//         const snapshot = await db.collection('investmentInterests').get();
        
//         let total = 0;
//         let totalAmount = 0;
//         let newCount = 0;
//         let contactedCount = 0;
//         let investedCount = 0;
//         let notInterestedCount = 0;
        
//         snapshot.forEach(doc => {
//             const data = doc.data();
//             total++;
//             totalAmount += data.investmentAmount || 0;
            
//             switch(data.status) {
//                 case 'new': newCount++; break;
//                 case 'contacted': contactedCount++; break;
//                 case 'invested': investedCount++; break;
//                 case 'not_interested': notInterestedCount++; break;
//                 default: break;
//             }
//         });
        
//         res.json({
//             totalInterests: total,
//             totalAmount: totalAmount,
//             stats: {
//                 new: newCount,
//                 contacted: contactedCount,
//                 invested: investedCount,
//                 notInterested: notInterestedCount
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching investment stats:', error);
//         res.status(500).json({ error: 'Failed to fetch stats' });
//     }
// });

// module.exports = router;

const express = require('express');
const { db } = require('../services/firebase');
const { authenticate } = require('../middleware/auth');
const admin = require('firebase-admin');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const router = express.Router();

// ============ CONFIGURATION ============
const OTP_EXPIRY_MINUTES = 30;
const SESSION_TIMEOUT_MINUTES = 60;
const MAX_OTP_ATTEMPTS = 5;
const MAX_CODE_ATTEMPTS_PER_IP = 10;
const MAX_OTP_REQUESTS_PER_EMAIL_PER_HOUR = 6;
const RATE_LIMIT_WINDOW_HOURS = 1;

// ============ CORS CONFIGURATION ============
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
};

// Apply CORS to all routes in this router
router.use(cors(corsOptions));

// ============ COLLECTION NAMES (PRIVATE INVESTMENT PREFIX) ============
const COLLECTIONS = {
    ACCESS_CODES: 'private_investment_access_codes',
    INTERESTS: 'private_investment_interests',
    SESSIONS: 'private_investment_sessions',
    PENDING_VERIFICATIONS: 'private_investment_pending_verifications',
    RATE_LIMITS: 'private_investment_rate_limits',
    SUSPICIOUS_ACTIVITY: 'private_investment_suspicious_activity',
    NOTIFICATIONS: 'notifications',
    USERS: 'users'
};

// ============ EMAIL SETUP (GMAIL SMTP) ============
let transporter = null;

console.log('📧 Email Config:');
console.log('GMAIL_USER:', process.env.GMAIL_USER ? '✅ Set' : '❌ NOT SET');
console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✅ Set' : '❌ NOT SET');
console.log('🌐 CORS_ORIGIN:', process.env.CORS_ORIGIN || 'http://localhost:3000');

const setupEmailTransporter = () => {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.warn('⚠️ Email not configured. OTP emails will not work.');
        return;
    }
    
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
    
    transporter.verify((error) => {
        if (error) {
            console.error('❌ Email error:', error.message);
        } else {
            console.log('✅ Email ready!');
        }
    });
};

setupEmailTransporter();

// ============ HELPERS ============
const generateAccessCode = () => {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const getDeviceFingerprint = (req) => {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const acceptLanguage = req.headers['accept-language'] || 'unknown';
    
    return crypto.createHash('sha256')
        .update(`${userAgent}${ip}${acceptLanguage}`)
        .digest('hex');
};

// ============ NOTIFICATION HELPER ============
const createNotification = async (userId, title, message, type, additionalData = {}) => {
    try {
        const notificationData = {
            userId: userId,
            title: title,
            message: message,
            type: type,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            ...additionalData
        };
        
        await db.collection(COLLECTIONS.NOTIFICATIONS).add(notificationData);
        console.log(`📢 Notification sent to ${userId}: ${title}`);
        return true;
    } catch (error) {
        console.error('❌ Failed to send notification:', error);
        return false;
    }
};

// ============ RATE LIMIT ============
const checkRateLimit = async (identifier, type) => {
    try {
        const now = new Date();
        const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
        
        const snapshot = await db.collection(COLLECTIONS.RATE_LIMITS)
            .where('identifier', '==', identifier)
            .where('type', '==', type)
            .get();
        
        let count = 0;
        const batch = db.batch();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.timestamp && data.timestamp.toDate() > windowStart) {
                count++;
            } else {
                batch.delete(doc.ref);
            }
        });
        
        await batch.commit().catch(() => {});
        return count;
    } catch (error) {
        console.error('Error checking rate limit:', error);
        return 0;
    }
};

const addRateLimit = async (identifier, type) => {
    try {
        await db.collection(COLLECTIONS.RATE_LIMITS).add({
            identifier: identifier,
            type: type,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error adding rate limit:', error);
    }
};

// ============ SEND OTP EMAIL ============
const sendOTPEmail = async (email, fullName, otp, accessCode) => {
    if (!transporter) {
        console.error('❌ Transporter not available');
        return false;
    }
    
   const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; border-bottom: 2px solid #f0b429; padding-bottom: 20px; }
            .header .logo { font-size: 28px; font-weight: bold; color: #1a1a2e; }
            .header .logo span { color: #f0b429; }
            .header .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
            .otp-code { font-size: 40px; font-weight: bold; text-align: center; color: #f0b429; letter-spacing: 10px; padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🔥 The<span>Spark</span></div>
                <div class="subtitle">🔐  Private Investment Verification</div>
            </div>
            
            <p>Hello <strong>${fullName}</strong>,</p>
            <p>Use the code below to verify your email address:</p>
            
            <div class="otp-code">${otp}</div>
            
            <p>This code will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
            
            <div class="footer">
                <p>This is a private investment invitation. All information is confidential.</p>
                <p>© ${new Date().getFullYear()} TheSpark</p>
            </div>
        </div>
    </body>
    </html>
`;
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.GMAIL_USER,
            to: email,
            subject: '🔐 Your Investment Verification Code',
            html: htmlContent
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error.message);
        return false;
    }
};

// ============ ROUTE: VERIFY ACCESS CODE ============
router.post('/verify-code', async (req, res) => {
    const { accessCode } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    console.log('📝 Verify code request:', accessCode);
    
    if (!accessCode) {
        return res.status(400).json({ 
            success: false, 
            error: 'Access code is required' 
        });
    }
    
    try {
        // 🔒 RATE LIMIT
        const codeAttempts = await checkRateLimit(ip, 'code_verification');
        if (codeAttempts >= MAX_CODE_ATTEMPTS_PER_IP) {
            return res.status(429).json({
                success: false,
                error: 'Too many attempts. Please try again later.'
            });
        }
        
        // ✅ Check if access code exists
        const codeSnapshot = await db.collection(COLLECTIONS.ACCESS_CODES)
            .where('code', '==', accessCode.toUpperCase())
            .where('isUsed', '==', false)
            .get();
        
        if (codeSnapshot.empty) {
            await addRateLimit(ip, 'code_verification');
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid or expired access code' 
            });
        }
        
        const doc = codeSnapshot.docs[0];
        const data = doc.data();
        
        // ✅ Check if expired
        if (data.expiresAt) {
            const expiresAt = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
            if (expiresAt < new Date()) {
                await addRateLimit(ip, 'code_verification');
                return res.status(401).json({ 
                    success: false, 
                    error: 'Access code has expired (24 hours)' 
                });
            }
        }
        
        // ✅ Code is valid
        await addRateLimit(ip, 'code_verification');
        
        res.json({ 
            success: true, 
            message: 'Access code verified',
            investorName: data.investorName || '',
            accessCode: accessCode.toUpperCase()
        });
    } catch (error) {
        console.error('❌ Error verifying code:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to verify access code. Please try again.' 
        });
    }
});

// ============ ROUTE: REQUEST OTP ============   // 🔒 Check if email already used//
// router.post('/request-otp', async (req, res) => {
//     const { accessCode, fullName, email, phone } = req.body;
//     const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
//     console.log('📝 Request OTP for:', email);
    
//     if (!accessCode || !fullName || !email || !phone) {
//         return res.status(400).json({ 
//             error: 'All fields are required' 
//         });
//     }
    
//     try {
//         // RATE LIMIT
//         const otpRequests = await checkRateLimit(email, 'otp_request');
//         if (otpRequests >= MAX_OTP_REQUESTS_PER_EMAIL_PER_HOUR) {
//             return res.status(429).json({
//                 error: 'Too many OTP requests. Please try again later.'
//             });
//         }
        
//         // ✅ Verify access code
//         const codeSnapshot = await db.collection(COLLECTIONS.ACCESS_CODES)
//             .where('code', '==', accessCode.toUpperCase())
//             .where('isUsed', '==', false)
//             .get();
        
//         if (codeSnapshot.empty) {
//             return res.status(401).json({ 
//                 error: 'Invalid or expired access code' 
//             });
//         }
        
//         const codeDoc = codeSnapshot.docs[0];
//         const codeData = codeDoc.data();
        
//         // ✅ Check if expired
//         if (codeData.expiresAt) {
//             const expiresAt = codeData.expiresAt.toDate ? codeData.expiresAt.toDate() : new Date(codeData.expiresAt);
//             if (expiresAt < new Date()) {
//                 return res.status(401).json({ 
//                     error: 'Access code has expired (24 hours)' 
//                 });
//             }
//         }
        
//         // 🔒 Check if email already used
//         const existing = await db.collection(COLLECTIONS.INTERESTS)
//             .where('email', '==', email)
//             .get();
        
//         if (!existing.empty) {
//             return res.status(400).json({
//                 error: 'This email has already expressed interest.'
//             });
//         }
        
//         // ✅ Generate OTP
//         const otp = generateOTP();
//         const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);
        
//         console.log('📝 OTP Generated:', otp);
//         console.log('📝 OTP Expires:', otpExpiry);
        
//         // 🔒 Store OTP
//         await db.collection(COLLECTIONS.PENDING_VERIFICATIONS).add({
//             accessCode: accessCode.toUpperCase(),
//             email: email,
//             fullName: fullName,
//             phone: phone,
//             otp: otp,
//             otpExpiry: otpExpiry,
//             otpAttempts: 0,
//             ipAddress: ip,
//             status: 'pending',
//             createdAt: admin.firestore.FieldValue.serverTimestamp()
//         });
        
//         // ✅ Send OTP email
//         const emailSent = await sendOTPEmail(email, fullName, otp, accessCode.toUpperCase());
        
//         if (!emailSent) {
//             return res.status(500).json({
//                 error: 'Failed to send OTP. Please check your email address.'
//             });
//         }
        
//         await addRateLimit(email, 'otp_request');
//         await addRateLimit(ip, 'otp_request');
        
//         res.json({
//             success: true,
//             message: `OTP sent to ${email}`,
//             expiresIn: OTP_EXPIRY_MINUTES
//         });
        
//     } catch (error) {
//         console.error('❌ Error requesting OTP:', error);
//         res.status(500).json({ 
//             error: 'Failed to send OTP. Please try again.' 
//         });
//     }
// });


// ============ ROUTE: REQUEST OTP ============
router.post('/request-otp', async (req, res) => {
    const { accessCode, fullName, email, phone } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    console.log('📝 Request OTP for:', email);
    
    if (!accessCode || !fullName || !email || !phone) {
        return res.status(400).json({ 
            error: 'All fields are required' 
        });
    }
    
    try {
        // RATE LIMIT
        const otpRequests = await checkRateLimit(email, 'otp_request');
        if (otpRequests >= MAX_OTP_REQUESTS_PER_EMAIL_PER_HOUR) {
            return res.status(429).json({
                error: 'Too many OTP requests. Please try again later.'
            });
        }
        
        // ✅ Verify access code is valid (not used)
        const codeSnapshot = await db.collection(COLLECTIONS.ACCESS_CODES)
            .where('code', '==', accessCode.toUpperCase())
            .where('isUsed', '==', false)
            .get();
        
        if (codeSnapshot.empty) {
            return res.status(401).json({ 
                error: 'Invalid or expired access code' 
            });
        }
        
        const codeDoc = codeSnapshot.docs[0];
        const codeData = codeDoc.data();
        
        // ✅ Check if expired
        if (codeData.expiresAt) {
            const expiresAt = codeData.expiresAt.toDate ? codeData.expiresAt.toDate() : new Date(codeData.expiresAt);
            if (expiresAt < new Date()) {
                return res.status(401).json({ 
                    error: 'Access code has expired (24 hours)' 
                });
            }
        }
        
        // ✅ CHANGED: Check if this email already used THIS SPECIFIC code
        const existing = await db.collection(COLLECTIONS.INTERESTS)
            .where('email', '==', email)
            .where('accessCode', '==', accessCode.toUpperCase())
            .get();
        
        if (!existing.empty) {
            return res.status(400).json({
                error: 'This email has already used this access code. Please request a new code for additional investments.'
            });
        }
        
        // ✅ Generate OTP
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);
        
        console.log('📝 OTP Generated:', otp);
        console.log('📝 OTP Expires:', otpExpiry);
        
        // 🔒 Store OTP
        await db.collection(COLLECTIONS.PENDING_VERIFICATIONS).add({
            accessCode: accessCode.toUpperCase(),
            email: email,
            fullName: fullName,
            phone: phone,
            otp: otp,
            otpExpiry: otpExpiry,
            otpAttempts: 0,
            ipAddress: ip,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // ✅ Send OTP email
        const emailSent = await sendOTPEmail(email, fullName, otp, accessCode.toUpperCase());
        
        if (!emailSent) {
            return res.status(500).json({
                error: 'Failed to send OTP. Please check your email address.'
            });
        }
        
        await addRateLimit(email, 'otp_request');
        await addRateLimit(ip, 'otp_request');
        
        res.json({
            success: true,
            message: `OTP sent to ${email}`,
            expiresIn: OTP_EXPIRY_MINUTES
        });
        
    } catch (error) {
        console.error('❌ Error requesting OTP:', error);
        res.status(500).json({ 
            error: 'Failed to send OTP. Please try again.' 
        });
    }
});

// ============ ROUTE: VERIFY OTP ============
router.post('/verify-otp', async (req, res) => {
    const { accessCode, email, otp } = req.body;
    
    console.log('📝 Verifying OTP for:', email);
    console.log('📝 OTP entered:', otp);
    
    if (!accessCode || !email || !otp) {
        return res.status(400).json({ 
            error: 'All fields are required' 
        });
    }
    
    try {
        // Find pending verification
        const pendingSnapshot = await db.collection(COLLECTIONS.PENDING_VERIFICATIONS)
            .where('accessCode', '==', accessCode.toUpperCase())
            .where('email', '==', email)
            .where('status', '==', 'pending')
            .get();
        
        if (pendingSnapshot.empty) {
            return res.status(401).json({
                error: 'Invalid or expired verification request.'
            });
        }
        
        const pendingDoc = pendingSnapshot.docs[0];
        const pendingData = pendingDoc.data();
        
        console.log('📝 Stored OTP:', pendingData.otp);
        console.log('📝 OTP Attempts:', pendingData.otpAttempts);
        
        // ✅ Get OTP expiry as Date
        let otpExpiryDate;
        if (pendingData.otpExpiry) {
            if (typeof pendingData.otpExpiry.toDate === 'function') {
                otpExpiryDate = pendingData.otpExpiry.toDate();
            } else if (pendingData.otpExpiry instanceof Date) {
                otpExpiryDate = pendingData.otpExpiry;
            } else if (pendingData.otpExpiry._seconds !== undefined) {
                otpExpiryDate = new Date(pendingData.otpExpiry._seconds * 1000);
            } else {
                otpExpiryDate = new Date(pendingData.otpExpiry);
            }
        }
        
        const now = new Date();
        console.log('📝 OTP Expiry:', otpExpiryDate);
        console.log('📝 Current Time:', now);
        console.log('📝 Is Expired:', otpExpiryDate && otpExpiryDate < now);
        
        // ✅ Check if OTP is expired
        if (otpExpiryDate && otpExpiryDate < now) {
            await pendingDoc.ref.update({ 
                status: 'expired',
                expiredAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.status(401).json({
                error: 'OTP has expired. Please request a new one.'
            });
        }
        
        // ✅ Check OTP attempts
        if (pendingData.otpAttempts >= MAX_OTP_ATTEMPTS) {
            await pendingDoc.ref.update({ 
                status: 'locked',
                lockedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.status(429).json({
                error: 'Too many failed attempts. Please request a new OTP.'
            });
        }
        
        // ✅ Verify OTP
        if (pendingData.otp !== otp) {
            const newAttempts = (pendingData.otpAttempts || 0) + 1;
            await pendingDoc.ref.update({
                otpAttempts: newAttempts
            });
            const remaining = MAX_OTP_ATTEMPTS - newAttempts;
            return res.status(401).json({
                error: `Invalid OTP. ${remaining} attempts remaining.`
            });
        }
        
        // ✅ OTP is correct - mark as verified
        await pendingDoc.ref.update({
            status: 'verified',
            verifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // ✅ Store session with 60-minute timeout
        const sessionExpiry = new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60000);
        
        const sessionRef = await db.collection(COLLECTIONS.SESSIONS).add({
            accessCode: accessCode.toUpperCase(),
            email: email,
            fullName: pendingData.fullName,
            phone: pendingData.phone,
            expiresAt: sessionExpiry,
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Generate session token
        const sessionToken = crypto.createHash('sha256')
            .update(`${accessCode}${email}${sessionRef.id}${Date.now()}`)
            .digest('hex');
        
        // ✅ Store session token in the session document for validation
        await sessionRef.update({
            sessionToken: sessionToken
        });
        
        res.json({
            success: true,
            message: 'OTP verified successfully!',
            sessionToken: sessionToken,
            expiresIn: SESSION_TIMEOUT_MINUTES,
            userData: {
                fullName: pendingData.fullName,
                email: pendingData.email,
                phone: pendingData.phone
            }
        });
        
    } catch (error) {
        console.error('❌ Error verifying OTP:', error);
        res.status(500).json({ 
            error: 'Failed to verify OTP. Please try again.' 
        });
    }
});

// ============ ROUTE: SUBMIT INTEREST ============  ✅ CHECK: Does this email have a registered account?
// router.post('/interest', async (req, res) => {
//     const { 
//         accessCode, 
//         fullName, 
//         email, 
//         phone, 
//         investmentAmount,
//         customAmount,
//         sessionToken,
//         agreeTerms 
//     } = req.body;
//     const ip = req.ip || req.socket.remoteAddress || 'unknown';
//     const fingerprint = getDeviceFingerprint(req);
    
//     console.log('📝 Submitting interest for:', email);
//     console.log('📝 Session Token received:', sessionToken ? '✅ Yes' : '❌ No');
//     console.log('📝 Device Fingerprint:', fingerprint ? '✅ Captured' : '❌ Not captured');
    
//     try {
//         // ✅ Check if sessionToken exists
//         if (!sessionToken) {
//             return res.status(401).json({
//                 error: 'Session token missing. Please verify your email again.'
//             });
//         }
        
//         // 🔒 Verify session token
//         const sessionSnapshot = await db.collection(COLLECTIONS.SESSIONS)
//             .where('accessCode', '==', accessCode.toUpperCase())
//             .where('email', '==', email)
//             .where('isActive', '==', true)
//             .where('sessionToken', '==', sessionToken)
//             .get();
        
//         if (sessionSnapshot.empty) {
//             return res.status(401).json({
//                 error: 'Session expired or invalid. Please verify your email again.'
//             });
//         }
        
//         const sessionDoc = sessionSnapshot.docs[0];
//         const sessionData = sessionDoc.data();
        
//         console.log('📝 Session found for:', sessionData.email);
//         console.log('📝 Session expires at:', sessionData.expiresAt);
        
//         // 🔒 Check session expiry
//         let expiresAt;
//         if (sessionData.expiresAt) {
//             expiresAt = sessionData.expiresAt.toDate ? sessionData.expiresAt.toDate() : new Date(sessionData.expiresAt);
//         }
//         const now = new Date();
        
//         if (expiresAt && expiresAt < now) {
//             await sessionDoc.ref.update({ isActive: false });
//             return res.status(401).json({
//                 error: 'Session expired. Please verify your email again.'
//             });
//         }
        
//         // 🔒 Check if session matches user
//         if (sessionData.fullName !== fullName || sessionData.phone !== phone) {
//             return res.status(403).json({
//                 error: 'Session data mismatch. Please verify again.'
//             });
//         }
        
//         // ✅ Verify access code is valid (not used)
//         const codeSnapshot = await db.collection(COLLECTIONS.ACCESS_CODES)
//             .where('code', '==', accessCode.toUpperCase())
//             .where('isUsed', '==', false)
//             .get();
        
//         if (codeSnapshot.empty) {
//             return res.status(401).json({ 
//                 error: 'Invalid or expired access code' 
//             });
//         }
        
//         const codeDoc = codeSnapshot.docs[0];
//         const codeData = codeDoc.data();
        
//         // ✅ Check if expired
//         if (codeData.expiresAt) {
//             const expiresAtCode = codeData.expiresAt.toDate ? codeData.expiresAt.toDate() : new Date(codeData.expiresAt);
//             if (expiresAtCode < new Date()) {
//                 return res.status(401).json({ 
//                     error: 'Access code has expired' 
//                 });
//             }
//         }
        
//         // Validate investment amount
//         const amount = investmentAmount || customAmount || 0;
//         if (parseInt(amount) < 100000) {
//             return res.status(400).json({ 
//                 error: 'Minimum investment is ₦100,000' 
//             });
//         }
        
//         if (!agreeTerms) {
//             return res.status(400).json({
//                 error: 'Please agree to the terms and conditions'
//             });
//         }
        
//         // ✅ CHECK: Does this email have a registered account?
//         let userId = null;
//         let userExists = false;
        
//         try {
//             const userSnapshot = await db.collection(COLLECTIONS.USERS)
//                 .where('email', '==', email)
//                 .get();
            
//             if (!userSnapshot.empty) {
//                 const userDoc = userSnapshot.docs[0];
//                 userId = userDoc.id;
//                 userExists = true;
//                 console.log(`✅ Found existing user: ${userId} for email: ${email}`);
//             } else {
//                 console.log(`ℹ️ No existing user found for email: ${email}`);
//             }
//         } catch (error) {
//             console.error('Error checking for existing user:', error);
//         }
        
//         // ✅ Mark access code as used
//         await codeDoc.ref.update({
//             isUsed: true,
//             usedAt: admin.firestore.FieldValue.serverTimestamp(),
//             usedBy: email
//         });
        
//         // ✅ Save investment interest with user info and device fingerprint
//         const interestData = {
//             fullName: fullName || '',
//             email: email || '',
//             phone: phone || '',
//             investmentAmount: parseInt(amount),
//             accessCode: accessCode.toUpperCase(),
//             investorName: codeData.investorName || '',
//             type: 'profit_sharing',
//             status: 'new',
//             ipAddress: ip,
//             deviceFingerprint: fingerprint,
//             sessionToken: sessionToken,
//             agreedToTerms: true,
//             userExists: userExists,
//             userId: userId,
//             wasLoggedIn: false,
//             createdAt: admin.firestore.FieldValue.serverTimestamp()
//         };
        
//         await db.collection(COLLECTIONS.INTERESTS).add(interestData);
        
//         // ✅ Invalidate session
//         await sessionDoc.ref.update({
//             isActive: false,
//             completedAt: admin.firestore.FieldValue.serverTimestamp()
//         });
        
//         // ✅ Delete pending verification
//         const pendingSnapshot = await db.collection(COLLECTIONS.PENDING_VERIFICATIONS)
//             .where('accessCode', '==', accessCode.toUpperCase())
//             .where('email', '==', email)
//             .get();
        
//         if (!pendingSnapshot.empty) {
//             await pendingSnapshot.docs[0].ref.update({ status: 'completed' });
//         }
        
//         // ✅ Send notifications
//         const notificationMessage = userExists 
//             ? `${fullName} (Registered User) interested: ₦${parseInt(amount).toLocaleString()} (Email: ${email})`
//             : `${fullName} (New Lead) interested: ₦${parseInt(amount).toLocaleString()} (Email: ${email})`;
        
//         // Send notification to admin
//         await createNotification(
//             'admin',
//             '🔔 New Investment Interest',
//             notificationMessage,
//             'investment_interest',
//             {
//                 ipAddress: ip,
//                 deviceFingerprint: fingerprint,
//                 userExists: userExists,
//                 userId: userId,
//                 investmentAmount: parseInt(amount),
//                 email: email,
//                 phone: phone
//             }
//         );
        
//         // ✅ Also send notification to the user (if they have an account)
//         if (userExists && userId) {
//             await createNotification(
//                 userId,
//                 '✅ Investment Interest Received',
//                 `Thank you ${fullName}! We have received your investment interest of ₦${parseInt(amount).toLocaleString()}. We will contact you within 48 hours.`,
//                 'investment_confirmation',
//                 {
//                     investmentAmount: parseInt(amount),
//                     status: 'pending'
//                 }
//             );
//         }
        
//         console.log(`✅ Investment saved: ${fullName} - ₦${amount} - ${email} (User exists: ${userExists})`);
        
//         res.json({ 
//             success: true, 
//             message: 'Interest submitted successfully!',
//             nextSteps: 'We will contact you within 48 hours.',
//             userExists: userExists,
//             userId: userId
//         });
//     } catch (error) {
//         console.error('❌ Error submitting interest:', error);
//         res.status(500).json({ 
//             error: 'Failed to submit interest. Please try again.' 
//         });
//     }
// });


// ============ ROUTE: SUBMIT INTEREST ============
router.post('/interest', async (req, res) => {
    const { 
        accessCode, 
        fullName, 
        email, 
        phone, 
        investmentAmount,
        customAmount,
        sessionToken,
        agreeTerms 
    } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const fingerprint = getDeviceFingerprint(req);
    
    console.log('📝 Submitting interest for:', email);
    console.log('📝 Session Token received:', sessionToken ? '✅ Yes' : '❌ No');
    console.log('📝 Device Fingerprint:', fingerprint ? '✅ Captured' : '❌ Not captured');
    
    try {
        // ✅ Check if sessionToken exists
        if (!sessionToken) {
            return res.status(401).json({
                error: 'Session token missing. Please verify your email again.'
            });
        }
        
        // 🔒 Verify session token
        const sessionSnapshot = await db.collection(COLLECTIONS.SESSIONS)
            .where('accessCode', '==', accessCode.toUpperCase())
            .where('email', '==', email)
            .where('isActive', '==', true)
            .where('sessionToken', '==', sessionToken)
            .get();
        
        if (sessionSnapshot.empty) {
            return res.status(401).json({
                error: 'Session expired or invalid. Please verify your email again.'
            });
        }
        
        const sessionDoc = sessionSnapshot.docs[0];
        const sessionData = sessionDoc.data();
        
        console.log('📝 Session found for:', sessionData.email);
        console.log('📝 Session expires at:', sessionData.expiresAt);
        
        // 🔒 Check session expiry
        let expiresAt;
        if (sessionData.expiresAt) {
            expiresAt = sessionData.expiresAt.toDate ? sessionData.expiresAt.toDate() : new Date(sessionData.expiresAt);
        }
        const now = new Date();
        
        if (expiresAt && expiresAt < now) {
            await sessionDoc.ref.update({ isActive: false });
            return res.status(401).json({
                error: 'Session expired. Please verify your email again.'
            });
        }
        
        // 🔒 Check if session matches user
        if (sessionData.fullName !== fullName || sessionData.phone !== phone) {
            return res.status(403).json({
                error: 'Session data mismatch. Please verify again.'
            });
        }
        
        // ✅ Verify access code is valid (not used)
        const codeSnapshot = await db.collection(COLLECTIONS.ACCESS_CODES)
            .where('code', '==', accessCode.toUpperCase())
            .where('isUsed', '==', false)
            .get();
        
        if (codeSnapshot.empty) {
            return res.status(401).json({ 
                error: 'Invalid or expired access code' 
            });
        }
        
        const codeDoc = codeSnapshot.docs[0];
        const codeData = codeDoc.data();
        
        // ✅ Check if expired
        if (codeData.expiresAt) {
            const expiresAtCode = codeData.expiresAt.toDate ? codeData.expiresAt.toDate() : new Date(codeData.expiresAt);
            if (expiresAtCode < new Date()) {
                return res.status(401).json({ 
                    error: 'Access code has expired' 
                });
            }
        }
        
        // Validate investment amount
        const amount = investmentAmount || customAmount || 0;
        if (parseInt(amount) < 100000) {
            return res.status(400).json({ 
                error: 'Minimum investment is ₦100,000' 
            });
        }
        
        if (!agreeTerms) {
            return res.status(400).json({
                error: 'Please agree to the terms and conditions'
            });
        }
        
        // ✅ REMOVED: Email already used check - allowing multiple investments
        
        // ✅ CHECK: Does this email have a registered account?
        let userId = null;
        let userExists = false;
        
        try {
            const userSnapshot = await db.collection(COLLECTIONS.USERS)
                .where('email', '==', email)
                .get();
            
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                userId = userDoc.id;
                userExists = true;
                console.log(`✅ Found existing user: ${userId} for email: ${email}`);
            } else {
                console.log(`ℹ️ No existing user found for email: ${email}`);
            }
        } catch (error) {
            console.error('Error checking for existing user:', error);
        }
        
        // ✅ Mark access code as used
        await codeDoc.ref.update({
            isUsed: true,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
            usedBy: email
        });
        
        // ✅ Save investment interest with user info and device fingerprint
        const interestData = {
            fullName: fullName || '',
            email: email || '',
            phone: phone || '',
            investmentAmount: parseInt(amount),
            accessCode: accessCode.toUpperCase(),
            investorName: codeData.investorName || '',
            type: 'profit_sharing',
            status: 'new',
            ipAddress: ip,
            deviceFingerprint: fingerprint,
            sessionToken: sessionToken,
            agreedToTerms: true,
            userExists: userExists,
            userId: userId,
            wasLoggedIn: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection(COLLECTIONS.INTERESTS).add(interestData);
        
        // ✅ Invalidate session
        await sessionDoc.ref.update({
            isActive: false,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // ✅ Delete pending verification
        const pendingSnapshot = await db.collection(COLLECTIONS.PENDING_VERIFICATIONS)
            .where('accessCode', '==', accessCode.toUpperCase())
            .where('email', '==', email)
            .get();
        
        if (!pendingSnapshot.empty) {
            await pendingSnapshot.docs[0].ref.update({ status: 'completed' });
        }
        
        // ✅ Send notifications
        const notificationMessage = userExists 
            ? `${fullName} (Registered User) interested: ₦${parseInt(amount).toLocaleString()} (Email: ${email})`
            : `${fullName} (New Lead) interested: ₦${parseInt(amount).toLocaleString()} (Email: ${email})`;
        
        // Send notification to admin
        await createNotification(
            'admin',
            '🔔 New Investment Interest',
            notificationMessage,
            'investment_interest',
            {
                ipAddress: ip,
                deviceFingerprint: fingerprint,
                userExists: userExists,
                userId: userId,
                investmentAmount: parseInt(amount),
                email: email,
                phone: phone
            }
        );
        
        // ✅ Also send notification to the user (if they have an account)
        if (userExists && userId) {
            await createNotification(
                userId,
                '✅ Investment Interest Received',
                `Thank you ${fullName}! We have received your investment interest of ₦${parseInt(amount).toLocaleString()}. We will contact you within 48 hours.`,
                'investment_confirmation',
                {
                    investmentAmount: parseInt(amount),
                    status: 'pending'
                }
            );
        }
        
        console.log(`✅ Investment saved: ${fullName} - ₦${amount} - ${email} (User exists: ${userExists})`);
        
        res.json({ 
            success: true, 
            message: 'Interest submitted successfully!',
            nextSteps: 'We will contact you within 48 hours.',
            userExists: userExists,
            userId: userId
        });
    } catch (error) {
        console.error('❌ Error submitting interest:', error);
        res.status(500).json({ 
            error: 'Failed to submit interest. Please try again.' 
        });
    }
});

// ============ ROUTE: SEND INVESTOR EMAIL ============
router.post('/send-investor-email', authenticate, async (req, res) => {
    const { interestId, email, fullName, investmentAmount, investorName } = req.body;
    
    try {
        // Check if user is admin
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        if (!email || !fullName) {
            return res.status(400).json({ error: 'Email and fullName are required' });
        }
        
        // ✅ Get URLs from environment variables
        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        
        // ✅ Send email using nodemailer
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { text-align: center; border-bottom: 2px solid #f0b429; padding-bottom: 20px; }
                    .header h1 { color: #1a1a2e; margin: 0; }
                    .header .logo { font-size: 24px; font-weight: bold; color: #f0b429; }
                    .content { padding: 20px 0; }
                    .details { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
                    .details table { width: 100%; border-collapse: collapse; }
                    .details td { padding: 8px 0; border-bottom: 1px solid #e9ecef; }
                    .details td:last-child { text-align: right; font-weight: bold; }
                    .button { display: inline-block; background: #f0b429; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
                    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🔥 TheSpark</div>
                        <h1 style="color: #1a1a2e; font-size: 24px;">Private Investment Opportunity</h1>
                    </div>
                    
                    <div class="content">
                        <p>Dear <strong>${fullName}</strong>,</p>
                        
                        <p>Thank you for expressing interest in our private investment opportunity. We're excited to have you on board!</p>
                        
                        ${investorName ? `<p style="color: #666; font-size: 14px;">You were invited by: <strong>${investorName}</strong></p>` : ''}
                        
                        <h3 style="color: #1a1a2e;">📊 Investment Summary</h3>
                        
                        <div class="details">
                            <table>
                                <tr>
                                    <td>Investment Amount</td>
                                    <td>₦${parseInt(investmentAmount).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td>Term</td>
                                    <td>5 Years</td>
                                </tr>
                                <tr>
                                    <td>Expected Return</td>
                                    <td>72% (₦${Math.round(parseInt(investmentAmount) * 0.72).toLocaleString()} profit)</td>
                                </tr>
                                <tr>
                                    <td>Structure</td>
                                    <td>100% Capital Return → 30% Profit Share</td>
                                </tr>
                            </table>
                        </div>
                        
                        <h3 style="color: #1a1a2e;">📋 Next Steps</h3>
                        
                        <ol style="line-height: 1.8;">
                            <li>✅ Review the investment details above</li>
                            <li>📞 Our team will contact you within 48 hours to finalize everything</li>
                            <li>💰 We'll provide payment details during our consultation</li>
                        </ol>
                        
                        <p style="text-align: center;">
                            <a href="${appUrl}" class="button">🏠 Visit TheSpark</a>
                        </p>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px; color: #856404;">
                                ⚠️ This is a private investment invitation. All information is confidential.
                                <br>Investment is at risk. No guaranteed returns.
                            </p>
                        </div>
                        
                        <p style="color: #666; font-size: 14px;">
                            We will contact you within <strong>48 hours</strong> to schedule a call. 
                            If you have any questions, feel free to reply to this email.
                        </p>
                        
                        <p style="margin-top: 20px;">
                            Best regards,<br>
                            <strong>TheSpark Investment Team</strong>
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p>This is a private investment invitation. All information is confidential.</p>
                        <p>© ${new Date().getFullYear()} TheSpark Investment</p>
                        <p><a href="${appUrl}" style="color: #666; text-decoration: none;">${appUrl}</a></p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.GMAIL_USER,
            to: email,
            subject: `📊 Private Investment Opportunity - TheSpark (₦${parseInt(investmentAmount).toLocaleString()})`,
            html: htmlContent
        };

        await transporter.sendMail(mailOptions);
        
        console.log(`📧 Investor email sent to: ${email}`);
        if (investorName) {
            console.log(`📧 Invited by: ${investorName}`);
        }
        
        // ✅ Update the interest record with email sent status
        if (interestId) {
            await db.collection(COLLECTIONS.INTERESTS).doc(interestId).update({
                emailSent: true,
                emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
                emailSentBy: req.user.uid
            });
        }
        
        // ✅ Send notification to admin
        await createNotification(
            req.user.uid,
            '📧 Investor Email Sent',
            `Email sent to ${fullName} (${email}) for ₦${parseInt(investmentAmount).toLocaleString()}`,
            'email_sent',
            {
                email: email,
                fullName: fullName,
                investorName: investorName || null,
                investmentAmount: parseInt(investmentAmount)
            }
        );
        
        res.json({ 
            success: true, 
            message: `Email sent successfully to ${email}` 
        });
        
    } catch (error) {
        console.error('❌ Error sending investor email:', error);
        res.status(500).json({ 
            error: 'Failed to send email. Please try again.' 
        });
    }
});
// ============ ADMIN ROUTES ============
router.post('/generate-codes', authenticate, async (req, res) => {
    const { count = 1, investorName } = req.body;
    
    try {
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const codes = [];
        const batch = db.batch();
        
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 24);
        const expiryTimestamp = admin.firestore.Timestamp.fromDate(expiryDate);
        
        for (let i = 0; i < count; i++) {
            const code = generateAccessCode();
            const ref = db.collection(COLLECTIONS.ACCESS_CODES).doc();
            batch.set(ref, {
                code: code,
                investorName: investorName || `Investor ${i + 1}`,
                expiresAt: expiryTimestamp,
                isUsed: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: req.user.uid
            });
            codes.push(code);
        }
        
        await batch.commit();
        
        // ✅ Notify admin that codes were generated
        await createNotification(
            req.user.uid,
            '🔑 Access Codes Generated',
            `${codes.length} access codes generated for ${investorName || 'investors'}`,
            'codes_generated',
            {
                count: codes.length,
                investorName: investorName || 'investors',
                expiresAt: expiryDate.toISOString()
            }
        );
        
        res.json({ 
            success: true, 
            message: `${codes.length} access codes generated (expires in 24 hours)`,
            codes: codes,
            expiresAt: expiryDate.toISOString()
        });
    } catch (error) {
        console.error('Error generating codes:', error);
        res.status(500).json({ error: 'Failed to generate codes' });
    }
});

router.get('/access-codes', authenticate, async (req, res) => {
    try {
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const snapshot = await db.collection(COLLECTIONS.ACCESS_CODES)
            .orderBy('createdAt', 'desc')
            .get();
        
        const codes = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            codes.push({ 
                id: doc.id, 
                code: data.code,
                investorName: data.investorName,
                isUsed: data.isUsed,
                createdBy: data.createdBy,
                usedBy: data.usedBy || null,
                createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : null,
                expiresAt: data.expiresAt?.toDate?.() ? data.expiresAt.toDate().toISOString() : null,
                usedAt: data.usedAt?.toDate?.() ? data.usedAt.toDate().toISOString() : null
            });
        });
        
        res.json(codes);
    } catch (error) {
        console.error('Error fetching access codes:', error);
        res.status(500).json({ error: 'Failed to fetch access codes' });
    }
});

router.get('/interests', authenticate, async (req, res) => {
    try {
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const snapshot = await db.collection(COLLECTIONS.INTERESTS)
            .orderBy('createdAt', 'desc')
            .get();
        
        const interests = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            interests.push({ 
                id: doc.id, 
                ...data,
                createdAt: data.createdAt?.toDate?.() || data.createdAt
            });
        });
        
        res.json(interests);
    } catch (error) {
        console.error('Error fetching investment interests:', error);
        res.status(500).json({ error: 'Failed to fetch interests' });
    }
});

router.get('/stats', authenticate, async (req, res) => {
    try {
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const snapshot = await db.collection(COLLECTIONS.INTERESTS).get();
        
        let total = 0;
        let totalAmount = 0;
        let newCount = 0;
        let contactedCount = 0;
        let investedCount = 0;
        let notInterestedCount = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            total++;
            totalAmount += data.investmentAmount || 0;
            
            switch(data.status) {
                case 'new': newCount++; break;
                case 'contacted': contactedCount++; break;
                case 'invested': investedCount++; break;
                case 'not_interested': notInterestedCount++; break;
                default: break;
            }
        });
        
        res.json({
            totalInterests: total,
            totalAmount: totalAmount,
            stats: {
                new: newCount,
                contacted: contactedCount,
                invested: investedCount,
                notInterested: notInterestedCount
            }
        });
    } catch (error) {
        console.error('Error fetching investment stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;