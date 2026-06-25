// const { auth } = require('../services/firebase');

// async function authenticate(req, res, next) {
//     const token = req.headers.authorization?.split('Bearer ')[1];
    
//     if (!token) {
//         return res.status(401).json({ error: 'No token provided' });
//     }
    
//     try {
//         const decodedToken = await auth.verifyIdToken(token);
//         req.user = decodedToken;
//         next();
//     } catch (error) {
//         console.error('Auth error:', error);
//         return res.status(401).json({ error: 'Invalid token' });
//     }
// }

// async function isAdmin(req, res, next) {
//     const adminUid = process.env.ADMIN_UID;
    
//     if (!adminUid || req.user.uid !== adminUid) {
//         return res.status(403).json({ error: 'Admin access required' });
//     }
    
//     next();
// }

// module.exports = { authenticate, isAdmin };

const { auth, db } = require('../services/firebase'); // ✅ Import db

async function authenticate(req, res, next) {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        return res.status(401).json({ error: 'Invalid token', message: error.message });
    }
}

async function isAdmin(req, res, next) {
    try {
        // ✅ Check if user exists in database
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        
        if (!userDoc.exists) {
            console.log(`❌ User ${req.user.uid} not found in database`);
            return res.status(403).json({ error: 'User not found' });
        }
        
        const userData = userDoc.data();
        console.log(`🔍 Checking admin for: ${userData.fullName || req.user.uid}, Role: ${userData.role}`);
        
        // ✅ Check if role is 'admin'
        if (userData.role !== 'admin') {
            console.log(`❌ User ${userData.fullName} is not an admin (role: ${userData.role})`);
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        console.log(`✅ Admin access granted for: ${userData.fullName}`);
        req.userData = userData; // ✅ Store user data for later use
        next();
    } catch (error) {
        console.error('❌ Admin check error:', error);
        return res.status(403).json({ error: 'Admin access required' });
    }
}

module.exports = { authenticate, isAdmin };