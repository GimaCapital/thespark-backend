// src/services/addressService.js (Backend)
const { db } = require('../services/firebase');

// Save user address
const saveAddress = async (userId, addressData) => {
    const userRef = db.collection('users').doc(userId);
    
    // Get existing addresses
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const addresses = userData.addresses || [];
    
    // Add new address with unique ID
    const newAddress = {
        id: Date.now().toString(),
        ...addressData,
        isDefault: addresses.length === 0, // First address is default
        createdAt: new Date().toISOString()
    };
    
    // If this is set as default, remove default from others
    if (addressData.isDefault) {
        addresses.forEach(addr => addr.isDefault = false);
    }
    
    addresses.push(newAddress);
    
    await userRef.update({ addresses });
    return newAddress;
};

// Get user addresses
const getUserAddresses = async (userId) => {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    return userData.addresses || [];
};

// Delete address
const deleteAddress = async (userId, addressId) => {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const addresses = userData.addresses || [];
    
    const updatedAddresses = addresses.filter(addr => addr.id !== addressId);
    
    // If deleted address was default, set first as default
    const deleted = addresses.find(addr => addr.id === addressId);
    if (deleted?.isDefault && updatedAddresses.length > 0) {
        updatedAddresses[0].isDefault = true;
    }
    
    await userRef.update({ addresses: updatedAddresses });
    return updatedAddresses;
};

module.exports = { saveAddress, getUserAddresses, deleteAddress };