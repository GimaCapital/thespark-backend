const { auth } = require('../services/firebase');

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
        console.error('Auth error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
}

async function isAdmin(req, res, next) {
    const adminUid = process.env.ADMIN_UID;
    
    if (!adminUid || req.user.uid !== adminUid) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
}

module.exports = { authenticate, isAdmin };