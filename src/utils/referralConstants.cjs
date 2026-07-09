// src/utils/referralConstants.js

/**
 * REFERRAL SYSTEM CONSTANTS
 * Central place to manage all referral-related values
 * Change these values once and they update everywhere
 */

const REFERRAL_CONSTANTS = {
    // ✅ New user bonus (instant)
    NEW_USER_BONUS: 50,
    
    // ✅ Referrer bonus (paid when referred user completes first cycle)
    REFERRER_BONUS: 500,
    
    // ✅ Bonus descriptions
    DESCRIPTIONS: {
        NEW_USER: 'Referral sign-up bonus',
        REFERRER: 'Referral bonus for completing first cycle'
    },
    
    // ✅ Transaction types
    TRANSACTION_TYPES: {
        NEW_USER: 'referral_bonus',
        REFERRER: 'referral_reward'
    }
};

module.exports = REFERRAL_CONSTANTS;