// // src/services/flutterwaveService.js
// const Flutterwave = require('flutterwave-node-v3');

// // Initialize Flutterwave
// const flutterwave = new Flutterwave(
//   process.env.FLW_PUBLIC_KEY,
//   process.env.FLW_SECRET_KEY
// );

// /**
//  * Create a permanent virtual account for a user
//  * This account number stays the same for the user forever
//  */
// async function createVirtualAccount(user) {
//   try {
//     const response = await flutterwave.VirtualAccount.create({
//       email: user.email,
//       is_permanent: true,
//       firstname: user.fullName?.split(' ')[0] || user.fullName,
//       lastname: user.fullName?.split(' ')[1] || '',
//       tx_ref: `SPARK_${user.userId}_${Date.now()}`,
//       narration: `TheSpark Savings - ${user.fullName}`,
//       amount: null  // No fixed amount - accepts any deposit
//     });
    
//     return {
//       success: true,
//       accountNumber: response.data.account_number,
//       bankName: response.data.bank_name,
//       bankCode: response.data.bank_code,
//       accountReference: response.data.tx_ref
//     };
//   } catch (error) {
//     console.error('Flutterwave virtual account error:', error);
//     return { success: false, error: error.message };
//   }
// }

// /**
//  * Get virtual account details for a user
//  */
// async function getVirtualAccount(accountReference) {
//   try {
//     const response = await flutterwave.VirtualAccount.get({
//       tx_ref: accountReference
//     });
    
//     return {
//       success: true,
//       data: response.data
//     };
//   } catch (error) {
//     console.error('Get virtual account error:', error);
//     return { success: false, error: error.message };
//   }
// }

// /**
//  * Initiate a payout (withdrawal) to user's bank account
//  */
// async function initiatePayout(amount, bankCode, accountNumber, accountName, reference) {
//   try {
//     const response = await flutterwave.Payout.create({
//       amount: amount,
//       bank_code: bankCode,
//       account_number: accountNumber,
//       account_name: accountName,
//       reference: reference,
//       narration: `TheSpark withdrawal to ${accountName}`,
//       currency: "NGN"
//     });
    
//     if (response.status === 'success') {
//       return {
//         success: true,
//         reference: response.data.reference,
//         amount: response.data.amount,
//         status: response.data.status
//       };
//     }
    
//     return { success: false, error: response.message };
//   } catch (error) {
//     console.error('Payout error:', error);
//     return { success: false, error: error.message };
//   }
// }

// /**
//  * Verify bank account details before adding
//  */
// async function verifyBankAccount(accountNumber, bankCode) {
//   try {
//     const response = await flutterwave.Misc.bvn({
//       account_number: accountNumber,
//       bank_code: bankCode
//     });
    
//     if (response.status === 'success') {
//       return {
//         success: true,
//         accountName: response.data.account_name
//       };
//     }
    
//     return { success: false, error: response.message };
//   } catch (error) {
//     console.error('Account verification error:', error);
//     return { success: false, error: error.message };
//   }
// }

// /**
//  * Get list of supported banks in Nigeria
//  */
// async function getBanks() {
//   try {
//     const response = await flutterwave.Misc.getBanks({
//       country: "NG"
//     });
    
//     if (response.status === 'success') {
//       return {
//         success: true,
//         banks: response.data
//       };
//     }
    
//     return { success: false, error: response.message };
//   } catch (error) {
//     console.error('Get banks error:', error);
//     return { success: false, error: error.message };
//   }
// }

// /**
//  * Check transaction status
//  */
// async function getTransactionStatus(reference) {
//   try {
//     const response = await flutterwave.Transaction.verify({
//       id: reference
//     });
    
//     if (response.status === 'success') {
//       return {
//         success: true,
//         status: response.data.status,
//         amount: response.data.amount
//       };
//     }
    
//     return { success: false, error: response.message };
//   } catch (error) {
//     console.error('Transaction status error:', error);
//     return { success: false, error: error.message };
//   }
// }

// module.exports = {
//   createVirtualAccount,
//   getVirtualAccount,
//   initiatePayout,
//   verifyBankAccount,
//   getBanks,
//   getTransactionStatus
// };







// // src/services/flutterwaveService.js
// const axios = require('axios');
// const crypto = require('crypto');

// // Log configuration on load (without exposing secrets)
// console.log('🔧 Flutterwave Service Initialized');
// console.log('   Environment:', process.env.FLW_ENVIRONMENT || 'sandbox');
// console.log('   Client ID:', process.env.FLW_CLIENT_ID ? '✅ Set' : '❌ Missing');
// console.log('   Client Secret:', process.env.FLW_CLIENT_SECRET ? '✅ Set' : '❌ Missing');

// const FLW_BASE_URL = process.env.FLW_ENVIRONMENT === 'production'
//   ? 'https://api.flutterwave.com'
//   : 'https://developersandbox-api.flutterwave.com';

// let cachedToken = null;
// let tokenExpiry = null;

// async function getAccessToken() {
//   if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
//     console.log('📦 Using cached token');
//     return cachedToken;
//   }
  
//   console.log('🔑 Requesting new access token...');
  
//   try {
//     const response = await axios.post(
//       'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
//       new URLSearchParams({
//         client_id: process.env.FLW_CLIENT_ID,
//         client_secret: process.env.FLW_CLIENT_SECRET,
//         grant_type: 'client_credentials'
//       }),
//       {
//         headers: {
//           'Content-Type': 'application/x-www-form-urlencoded'
//         },
//         timeout: 30000
//       }
//     );
    
//     cachedToken = response.data.access_token;
//     tokenExpiry = Date.now() + ((response.data.expires_in - 60) * 1000);
//     console.log('✅ Token obtained, expires in', response.data.expires_in, 'seconds');
//     return cachedToken;
//   } catch (error) {
//     console.error('❌ Token error:', error.response?.status, error.response?.data?.error_description || error.message);
//     throw new Error(`Authentication failed: ${error.response?.data?.error_description || error.message}`);
//   }
// }

// async function getBanks() {
//   try {
//     const token = await getAccessToken();
    
//     const response = await axios.get(
//       `${FLW_BASE_URL}/banks?country=NG`,
//       {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Accept': 'application/json'
//         },
//         timeout: 30000
//       }
//     );
    
//     if (response.data.status === 'success') {
//       return {
//         success: true,
//         banks: response.data.data
//       };
//     }
    
//     return { success: false, error: response.data.message };
//   } catch (error) {
//     console.error('Get banks error:', error.response?.status, error.response?.data);
//     return { 
//       success: false, 
//       error: error.response?.data?.error?.message || error.message 
//     };
//   }
// }

// async function createCustomer(user) {
//   try {
//     const token = await getAccessToken();
    
//     const response = await axios.post(
//       `${FLW_BASE_URL}/customers`,
//       {
//         name: {
//           first: user.fullName?.split(' ')[0] || user.fullName,
//           last: user.fullName?.split(' ')[1] || 'User',
//         },
//         email: user.email
//       },
//       {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );
    
//     if (response.data.status === 'success') {
//       return {
//         success: true,
//         customerId: response.data.data.id
//       };
//     }
    
//     return { success: false, error: response.data.message };
//   } catch (error) {
//     console.error('Create customer error:', error.response?.data || error.message);
//     return { success: false, error: error.message };
//   }
// }

// async function createStaticVirtualAccount(customerId, user) {
//   try {
//     const token = await getAccessToken();
    
//     const payload = {
//       reference: crypto.randomUUID(),
//       customer_id: customerId,
//       amount: 0,
//       currency: "NGN",
//       account_type: "static",
//       narration: `${user.fullName} - TheSpark Savings`,
//       bvn: "12345678901"
//     };
    
//     const response = await axios.post(
//       `${FLW_BASE_URL}/virtual-accounts`,
//       payload,
//       {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );
    
//     if (response.data.status === 'success') {
//       const data = response.data.data;
//       return {
//         success: true,
//         accountNumber: data.account_number,
//         bankName: data.account_bank_name,
//         virtualAccountId: data.id
//       };
//     }
    
//     return { success: false, error: response.data.message };
//   } catch (error) {
//     console.error('Create virtual account error:', error.response?.data || error.message);
//     return { success: false, error: error.message };
//   }
// }

// async function createUserVirtualAccount(user) {
//   const customer = await createCustomer(user);
//   if (!customer.success) {
//     return { success: false, error: customer.error };
//   }
  
//   const virtualAccount = await createStaticVirtualAccount(customer.customerId, user);
//   if (!virtualAccount.success) {
//     return { success: false, error: virtualAccount.error };
//   }
  
//   return {
//     success: true,
//     customerId: customer.customerId,
//     ...virtualAccount
//   };
// }

// module.exports = {
//   getBanks,
//   createUserVirtualAccount
// };

// const axios = require('axios');
// const crypto = require('crypto');

// const FLW_BASE_URL = 'https://developersandbox-api.flutterwave.com';

// let cachedToken = null;
// let tokenExpiry = null;

// async function getAccessToken() {
//     if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
//         return cachedToken;
//     }
    
//     try {
//         const response = await axios.post(
//             'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
//             new URLSearchParams({
//                 client_id: process.env.FLW_CLIENT_ID,
//                 client_secret: process.env.FLW_CLIENT_SECRET,
//                 grant_type: 'client_credentials'
//             }),
//             {
//                 headers: {
//                     'Content-Type': 'application/x-www-form-urlencoded'
//                 }
//             }
//         );
        
//         cachedToken = response.data.access_token;
//         tokenExpiry = Date.now() + (9 * 60 * 1000);
//         return cachedToken;
//     } catch (error) {
//         console.error('Flutterwave token error:', error.response?.data || error.message);
//         throw error;
//     }
// }

// async function createCustomer(user) {
//     try {
//         const token = await getAccessToken();
        
//         const response = await axios.post(
//             `${FLW_BASE_URL}/customers`,
//             {
//                 name: {
//                     first: user.fullName?.split(' ')[0] || user.fullName,
//                     last: user.fullName?.split(' ')[1] || 'User',
//                 },
//                 email: user.email
//             },
//             {
//                 headers: {
//                     'Authorization': `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );
        
//         if (response.data.status === 'success') {
//             return {
//                 success: true,
//                 customerId: response.data.data.id
//             };
//         }
        
//         return { success: false, error: response.data.message };
//     } catch (error) {
//         console.error('Create customer error:', error.response?.data || error.message);
//         return { success: false, error: error.message };
//     }
// }

// async function createStaticVirtualAccount(customerId, user) {
//     try {
//         const token = await getAccessToken();
//         const reference = crypto.randomUUID();
        
//         const payload = {
//             reference: reference,
//             customer_id: customerId,
//             amount: 0,
//             currency: "NGN",
//             account_type: "static",
//             narration: `${user.fullName} - TheSpark Savings`,
//             bvn: "12345678901"
//         };
        
//         const response = await axios.post(
//             `${FLW_BASE_URL}/virtual-accounts`,
//             payload,
//             {
//                 headers: {
//                     'Authorization': `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );
        
//         if (response.data.status === 'success') {
//             const data = response.data.data;
//             return {
//                 success: true,
//                 accountNumber: data.account_number,
//                 bankName: data.account_bank_name,
//                 virtualAccountId: data.id
//             };
//         }
        
//         return { success: false, error: response.data.message };
//     } catch (error) {
//         console.error('Create virtual account error:', error.response?.data || error.message);
//         return { success: false, error: error.message };
//     }
// }

// async function createUserVirtualAccount(user) {
//     const customer = await createCustomer(user);
//     if (!customer.success) {
//         return { success: false, error: customer.error };
//     }
    
//     const virtualAccount = await createStaticVirtualAccount(customer.customerId, user);
//     if (!virtualAccount.success) {
//         return { success: false, error: virtualAccount.error };
//     }
    
//     return {
//         success: true,
//         customerId: customer.customerId,
//         accountNumber: virtualAccount.accountNumber,
//         bankName: virtualAccount.bankName,
//         virtualAccountId: virtualAccount.virtualAccountId
//     };
// }

// module.exports = {
//     createUserVirtualAccount
// };





// const axios = require('axios');
// const crypto = require('crypto');

// // Use LIVE URL for production
// const FLW_BASE_URL = 'https://api.flutterwave.com';

// let cachedToken = null;
// let tokenExpiry = null;

// async function getAccessToken() {
//     if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
//         return cachedToken;
//     }
    
//     try {
//         const response = await axios.post(
//             'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
//             new URLSearchParams({
//                 client_id: process.env.FLW_CLIENT_ID,
//                 client_secret: process.env.FLW_CLIENT_SECRET,
//                 grant_type: 'client_credentials'
//             }),
//             {
//                 headers: {
//                     'Content-Type': 'application/x-www-form-urlencoded'
//                 }
//             }
//         );
        
//         cachedToken = response.data.access_token;
//         tokenExpiry = Date.now() + (9 * 60 * 1000);
//         return cachedToken;
//     } catch (error) {
//         console.error('Flutterwave token error:', error.response?.data || error.message);
//         throw error;
//     }
// }

// async function createCustomer(user) {
//     try {
//         const token = await getAccessToken();
        
//         console.log('🟡 Creating customer at:', `${FLW_BASE_URL}/customers`);
        
//         const response = await axios.post(
//             `${FLW_BASE_URL}/customers`,
//             {
//                 name: {
//                     first: user.fullName?.split(' ')[0] || user.fullName,
//                     last: user.fullName?.split(' ')[1] || 'User',
//                 },
//                 email: user.email
//             },
//             {
//                 headers: {
//                     'Authorization': `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );
        
//         if (response.data.status === 'success') {
//             console.log('✅ Customer created:', response.data.data.id);
//             return {
//                 success: true,
//                 customerId: response.data.data.id
//             };
//         }
        
//         return { success: false, error: response.data.message };
//     } catch (error) {
//         console.error('❌ Create customer error:', error.response?.data || error.message);
//         return { success: false, error: error.message };
//     }
// }

// async function createStaticVirtualAccount(customerId, user) {
//     try {
//         const token = await getAccessToken();
//         const reference = crypto.randomUUID();
        
//         const payload = {
//             reference: reference,
//             customer_id: customerId,
//             amount: 0,
//             currency: "NGN",
//             account_type: "static",
//             narration: `${user.fullName} - TheSpark Savings`,
//             // For LIVE mode: use user's real BVN
//             bvn: user.bvn
//         };
        
//         console.log('🟡 Creating virtual account at:', `${FLW_BASE_URL}/virtual-accounts`);
        
//         const response = await axios.post(
//             `${FLW_BASE_URL}/virtual-accounts`,
//             payload,
//             {
//                 headers: {
//                     'Authorization': `Bearer ${token}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );
        
//         if (response.data.status === 'success') {
//             const data = response.data.data;
//             console.log('✅ Virtual account created:', data.account_number);
//             return {
//                 success: true,
//                 accountNumber: data.account_number,
//                 bankName: data.account_bank_name,
//                 virtualAccountId: data.id
//             };
//         }
        
//         return { success: false, error: response.data.message };
//     } catch (error) {
//         console.error('❌ Create virtual account error:', error.response?.data || error.message);
//         return { success: false, error: error.message };
//     }
// }

// async function createUserVirtualAccount(user) {
//     console.log('📝 Creating virtual account for:', user.email);
//     console.log('   Has BVN:', user.bvn ? '✅ Yes' : '❌ No');
//     console.log('   Environment: PRODUCTION (LIVE)');
    
//     // For LIVE mode, user MUST have BVN
//     if (!user.bvn) {
//         return { success: false, error: 'BVN is required for live virtual accounts' };
//     }
    
//     const customer = await createCustomer(user);
//     if (!customer.success) {
//         return { success: false, error: customer.error };
//     }
    
//     const virtualAccount = await createStaticVirtualAccount(customer.customerId, user);
//     if (!virtualAccount.success) {
//         return { success: false, error: virtualAccount.error };
//     }
    
//     return {
//         success: true,
//         customerId: customer.customerId,
//         accountNumber: virtualAccount.accountNumber,
//         bankName: virtualAccount.bankName,
//         virtualAccountId: virtualAccount.virtualAccountId
//     };
// }

// module.exports = {
//     createUserVirtualAccount
// };




// src/services/flutterwaveService.js



// const axios = require('axios');

// // Use LIVE v3 Virtual Account endpoint
// const FLW_VIRTUAL_ACCOUNT_URL = 'https://api.flutterwave.com/v3/virtual-account-numbers';

// async function createUserVirtualAccount(user) {
//     console.log('📝 Creating LIVE virtual account for:', user.email);
//     console.log('   Has BVN:', user.bvn ? '✅ Yes' : '❌ No');

//     if (!user.bvn) {
//         return { success: false, error: 'BVN is required for live virtual accounts' };
//     }

//     const payload = {
//         email: user.email,
//         is_permanent: true,
//         bvn: user.bvn,
//         tx_ref: `SPARK_VA_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
//         firstname: user.fullName?.split(' ')[0] || 'User',
//         lastname: user.fullName?.split(' ')[1] || 'Name',
//         narration: `TheSpark Project - ${user.fullName}`,
//         phonenumber: user.phone || '08000000000',
//         currency: 'NGN'
//     };

//     try {
//         const response = await axios.post(FLW_VIRTUAL_ACCOUNT_URL, payload, {
//             headers: {
//                 'Authorization': `Bearer ${process.env.FLW_SECRET_KEY}`,
//                 'Content-Type': 'application/json'
//             }
//         });

//         if (response.data.status === 'success') {
//             const data = response.data.data;
//             console.log('✅ Virtual account created:', data.account_number);
//             return {
//                 success: true,
//                 accountNumber: data.account_number,
//                 bankName: data.bank_name,
//                 reference: data.flw_ref
//             };
//         } else {
//             throw new Error(response.data.message);
//         }
//     } catch (error) {
//         console.error('❌ Error creating virtual account:', error.response?.data || error.message);
//         return { success: false, error: error.response?.data?.message || error.message };
//     }
// }

// module.exports = { createUserVirtualAccount };

const axios = require('axios');

// Use LIVE v3 Virtual Account endpoint
const FLW_VIRTUAL_ACCOUNT_URL = 'https://api.flutterwave.com/v3/virtual-account-numbers';

async function createUserVirtualAccount(user) {
    console.log('📝 Creating LIVE virtual account for:', user.email);
    console.log('   Has BVN:', user.bvn ? '✅ Yes' : '❌ No');
    console.log('   Has Phone:', user.phone ? '✅ Yes' : '❌ No');
    console.log('   Full Name:', user.fullName);
    console.log('   Phone Number:', user.phone);

    if (!user.bvn) {
        return { success: false, error: 'BVN is required for live virtual accounts' };
    }

    // ✅ Clean up the name - remove extra spaces, trim
    const fullName = user.fullName?.trim() || '';
    const nameParts = fullName.split(' ').filter(part => part.length > 0);
    
    let firstName, lastName;

    if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
    } else if (nameParts.length === 1) {
        firstName = nameParts[0];
        lastName = 'TheSpark user';
    } else {
        firstName = 'TheSpark';
        lastName = 'TheSpark user';
    }

    console.log('   First Name:', firstName);
    console.log('   Last Name:', lastName);

    // ✅ Use provided phone or fallback
    const phoneNumber = user.phone || '08000000000';

    const payload = {
        email: user.email,
        is_permanent: true,
        bvn: user.bvn,
        tx_ref: `SPARK_VA_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        firstname: firstName,
        lastname: lastName,
        narration: `TheSpark Project - ${fullName || 'TheSpark User'}`,
        phonenumber: phoneNumber,
        currency: 'NGN'
    };

    console.log('📡 Payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await axios.post(FLW_VIRTUAL_ACCOUNT_URL, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.FLW_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('📡 Flutterwave Response:', JSON.stringify(response.data, null, 2));

        if (response.data.status === 'success') {
            const data = response.data.data;
            console.log('✅ Virtual account created:', data.account_number);
            return {
                success: true,
                accountNumber: data.account_number,
                bankName: data.bank_name,
                reference: data.flw_ref,
                customerId: data.customer_id
            };
        } else {
            console.error('❌ Flutterwave error:', response.data);
            return { success: false, error: response.data.message };
        }
    } catch (error) {
        console.error('❌ Error creating virtual account:');
        console.error('   Status:', error.response?.status);
        console.error('   Message:', error.response?.data?.message || error.message);
        console.error('   Full Response:', JSON.stringify(error.response?.data, null, 2));
        return { 
            success: false, 
            error: error.response?.data?.message || error.message,
            fullError: error.response?.data
        };
    }
}

module.exports = { createUserVirtualAccount };