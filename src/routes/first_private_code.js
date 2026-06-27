// src/routes/first_private_code.js
const express = require('express');
const router = express.Router();

// ============ VERIFY PRIVATE ACCESS CODE ============
router.post('/verify-access', async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ 
            success: false, 
            error: 'Access code is required' 
        });
    }
    
    try {
        // ✅ Get valid code from environment variable
        const validCode = process.env.FIRST_PRIVATE_ACCESS_CODE || 'PRIVATE2026';
        
        // ✅ Check if code matches
        if (code === validCode) {
            return res.json({ 
                success: true, 
                message: 'Access granted!' 
            });
        } else {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid access code' 
            });
        }
    } catch (error) {
        console.error('Error verifying access:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Failed to verify access' 
        });
    }
});

// ============ GET CURRENT ACCESS CODE STATUS ============
router.get('/access-status', async (req, res) => {
    try {
        const hasCode = !!process.env.FIRST_PRIVATE_ACCESS_CODE;
        res.json({
            success: true,
            hasCode: hasCode,
            // Don't return the actual code!
        });
    } catch (error) {
        console.error('Error getting access status:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get access status' 
        });
    }
});

module.exports = router;