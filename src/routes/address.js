// src/routes/address.js
const express = require('express');
const router = express.Router();

const { db } = require('../services/firebase'); // ← Use your existing config
const { authenticate } = require('../middleware/auth');
const { saveAddress, getUserAddresses, deleteAddress } = require('../services/addressService');

// Get user addresses
router.get('/addresses', authenticate, async (req, res) => {
    try {
        const addresses = await getUserAddresses(req.user.uid);
        res.json({ success: true, addresses: addresses || [] });
    } catch (error) {
        console.error('Error getting addresses:', error);
        res.status(500).json({ success: false, error: 'Failed to get addresses' });
    }
});

// Add new address
router.post('/addresses', authenticate, async (req, res) => {
    const { fullName, phone, street, city, state, country, isDefault } = req.body;
    
    if (!street || !city || !state) {
        return res.status(400).json({ 
            success: false, 
            error: 'Street, city, and state are required' 
        });
    }
    
    try {
        const address = await saveAddress(req.user.uid, {
            fullName: fullName || req.user.displayName || 'User',
            phone: phone || '',
            street,
            city,
            state,
            country: country || 'Nigeria',
            isDefault: Boolean(isDefault)
        });
        res.json({ success: true, address });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ success: false, error: 'Failed to add address' });
    }
});

// Delete address
router.delete('/addresses/:addressId', authenticate, async (req, res) => {
    try {
        const result = await deleteAddress(req.user.uid, req.params.addressId);
        res.json({ success: true, addresses: result || [] });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ success: false, error: 'Failed to delete address' });
    }
});

// Set default address
router.put('/addresses/:addressId/default', authenticate, async (req, res) => {
    const { addressId } = req.params;
    try {
        const userRef = db.collection('users').doc(req.user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const userData = userDoc.data();
        let addresses = userData.addresses || [];
        
        // Update isDefault flag
        const updated = addresses.map(addr => ({
            ...addr,
            isDefault: (addr.id === addressId || addr._id === addressId)
        }));
        
        await userRef.update({ addresses: updated });
        res.json({ success: true, addresses: updated });
    } catch (error) {
        console.error('Error setting default address:', error);
        res.status(500).json({ success: false, error: 'Failed to set default address' });
    }
});

module.exports = router;