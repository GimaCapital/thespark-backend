// C:\Users\HP\Desktop\TheSpark\thespark-backend\src\services\flutterwaveTransfer.js
const admin = require('firebase-admin');
const axios = require('axios');
const { db } = require('./firebase');
const { calculateWithdrawalFee } = require('../utils/feeUtils');

// ============ HELPER ============
const createNotification = async (userId, title, message, type, extra = {}) => {
    try {
        await db.collection('notifications').add({
            userId,
            title,
            message,
            type,
            read: false,
            createdAt: new Date(),
            ...extra
        });
        console.log(`📢 Notification sent to ${userId}: ${title}`);
    } catch (error) {
        console.error('Failed to send notification:', error);
    }
};

/**
 * Executes a withdrawal end-to-end:
 *  1. Verifies the request is pending and the user has enough balance
 *  2. Creates or reuses a Flutterwave beneficiary
 *  3. Initiates the transfer
 *  4. On success: marks approved, deducts balance, records transaction, notifies user
 *  5. On failure: marks failed, saves audit trail, notifies user + all admins
 *
 * @param {string} requestId - Firestore doc id in withdrawalRequests
 * @param {string} actorId   - uid of whoever triggered this (admin uid, or userId for auto-approve)
 * @param {string} actorType - 'admin' or 'auto' (for audit trail)
 * @returns {object} result - { success, reason, reference?, httpStatus, error?, technicalError? }
 */
async function executeWithdrawal({ requestId, actorId, actorType = 'admin' }) {
    let request = null;
    let requestRef = null;
    let user = null;
    let userRef = null;
    let feeDetails = null;
    let totalDeduction = 0;

    try {
        // ─── 1. Load request ───
        requestRef = db.collection('withdrawalRequests').doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            return { success: false, reason: 'not_found', httpStatus: 404, error: 'Request not found' };
        }

        request = requestDoc.data();

        if (request.status !== 'pending') {
            return { success: false, reason: 'already_processed', httpStatus: 400, error: 'Request already processed' };
        }

        // ─── 2. Load user ───
        userRef = db.collection('users').doc(request.userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            console.log(`❌ User ${request.userId} not found for withdrawal ${requestId}`);
            await requestRef.update({
                status: 'rejected',
                reason: 'User account no longer exists',
                processedAt: new Date(),
                processedBy: actorId,
                processedByType: actorType
            });
            return { success: false, reason: 'user_missing', httpStatus: 400, error: 'User account no longer exists' };
        }

        user = userDoc.data();
        feeDetails = calculateWithdrawalFee(request.amount);
        totalDeduction = request.amount + feeDetails.totalFee;

        if (totalDeduction > user.currentBalance) {
            await requestRef.update({
                status: 'rejected',
                reason: 'Insufficient balance',
                processedAt: new Date(),
                processedBy: actorId,
                processedByType: actorType
            });
            await createNotification(
                request.userId,
                '❌ Withdrawal Rejected',
                `Your withdrawal of ₦${request.amount.toLocaleString()} was rejected due to insufficient balance.`,
                'withdrawal_rejected'
            );
            return { success: false, reason: 'insufficient_user_balance', httpStatus: 400, error: 'Insufficient balance' };
        }

        if (!user.bankCode || !user.accountNumber) {
            await requestRef.update({
                status: 'rejected',
                reason: 'No bank account',
                processedAt: new Date(),
                processedBy: actorId,
                processedByType: actorType
            });
            await createNotification(
                request.userId,
                '❌ Withdrawal Rejected',
                `Your withdrawal of ₦${request.amount.toLocaleString()} was rejected because you don't have a bank account set up. Please add your bank details.`,
                'withdrawal_rejected'
            );
            return { success: false, reason: 'no_bank_account', httpStatus: 400, error: 'User has no bank account' };
        }

        // ─── 3. Flutterwave credentials ───
        const secretKey = process.env.FLW_SECRET_KEY;
        if (!secretKey) {
            throw new Error('FLW_SECRET_KEY not configured in .env');
        }

        console.log(`📡 [${actorType}] Executing withdrawal ${requestId}`);
        console.log('   User:', request.userId);
        console.log('   Bank Code:', user.bankCode);
        console.log('   Account:', user.accountNumber);
        console.log('   Amount: ₦' + request.amount);
        console.log('   Fee: ₦' + feeDetails.fee);
        console.log('   Total Deduction: ₦' + totalDeduction);

        const reference = `WTH${Date.now()}${request.userId.slice(0, 8)}`;

        // ─── 4. Get or create beneficiary ───
        let beneficiaryId = null;
        console.log('📡 Creating beneficiary...');

        try {
            const beneficiaryRes = await axios.post(
                'https://api.flutterwave.com/v3/beneficiaries',
                {
                    account_bank: user.bankCode,
                    account_number: user.accountNumber,
                    beneficiary_name: user.accountName,
                    currency: 'NGN',
                    bank_name: user.bankName
                },
                {
                    headers: {
                        'Authorization': `Bearer ${secretKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (beneficiaryRes.data.status === 'success') {
                beneficiaryId = beneficiaryRes.data.data.id;
                console.log('✅ Beneficiary created:', beneficiaryId);
            }
        } catch (createError) {
            if (createError.response?.data?.message === 'Beneficiary already added to your account') {
                console.log('📡 Beneficiary already exists, fetching ID...');

                const listRes = await axios.get(
                    'https://api.flutterwave.com/v3/beneficiaries',
                    {
                        headers: {
                            'Authorization': `Bearer ${secretKey}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const existing = listRes.data.data?.find(b =>
                    b.account_number === user.accountNumber &&
                    b.bank_code === user.bankCode
                );

                if (existing) {
                    beneficiaryId = existing.id;
                    console.log('✅ Found existing beneficiary:', beneficiaryId);
                } else if (listRes.data.data && listRes.data.data.length > 0) {
                    beneficiaryId = listRes.data.data[0].id;
                    console.log('✅ Using first available beneficiary:', beneficiaryId);
                } else {
                    throw new Error('No beneficiaries found');
                }
            } else {
                throw createError;
            }
        }

        if (!beneficiaryId) {
            throw new Error('Could not get beneficiary ID');
        }

        // ─── 5. Create transfer ───
        console.log('📡 Creating transfer with beneficiary ID:', beneficiaryId);

        const transferRes = await axios.post(
            'https://api.flutterwave.com/v3/transfers',
            {
                amount: request.amount,
                currency: 'NGN',
                beneficiary: beneficiaryId,
                reference: reference,
                narration: `TheSpark withdrawal - ${user.accountName}`
            },
            {
                headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Transfer initiated:', transferRes.data.status);
        console.log('   Transfer Reference:', transferRes.data.data?.reference);

        if (transferRes.data.status !== 'success') {
            throw new Error(transferRes.data.message || 'Transfer failed');
        }

        // ─── 6. Success — deduct balance, mark approved, record transaction ───
        await userRef.update({
            currentBalance: admin.firestore.FieldValue.increment(-totalDeduction),
            totalWithdrawn: admin.firestore.FieldValue.increment(request.amount)
        });

        await requestRef.update({
            status: 'approved',
            processedAt: new Date(),
            processedBy: actorId,
            processedByType: actorType,
            transferReference: reference,
            debitedAt: admin.firestore.FieldValue.serverTimestamp()  
        });

        await db.collection('transactions').add({
            userId: request.userId,
            type: 'withdrawal',
            amount: request.amount,
            fee: feeDetails.fee,
            totalFee: feeDetails.totalFee,
            totalDeduction: totalDeduction,
            cycle: request.cycle,
            day: request.requestDay,
            balanceAfter: user.currentBalance - totalDeduction,
            transferReference: reference,
            processedByType: actorType,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await createNotification(
            request.userId,
            '✅ Withdrawal Approved',
            `Your withdrawal of ₦${request.amount.toLocaleString()} has been approved and is being processed. Fee: ₦${feeDetails.fee.toLocaleString()}`,
            'withdrawal_approved'
        );

        console.log(`✅ [${actorType}] Withdrawal ${requestId} executed successfully`);

        return {
            success: true,
            reference,
            amount: request.amount,
            fee: feeDetails.fee
        };

    } catch (error) {
        // ─── Failure path ───
        console.error(`❌ [${actorType}] Withdrawal ${requestId} failed:`);
        console.error('   Status:', error.response?.status);
        console.error('   Message:', error.response?.data?.message || error.message);
        console.error('   Full response:', JSON.stringify(error.response?.data, null, 2));

        const technicalError = error.response?.data?.message || error.message;
        const flutterwaveResponse = error.response?.data || null;
        const statusCode = error.response?.status || null;

        let userMessage = technicalError;
        if (userMessage.includes('insufficient balance')) {
            userMessage = 'Insufficient balance in merchant account. Please contact support.';
        } else if (userMessage.includes('beneficiary')) {
            userMessage = 'Beneficiary account issue. Please verify your bank details.';
        } else if (userMessage.includes('bank')) {
            userMessage = 'Bank transfer failed. Please check your bank details.';
        } else if (userMessage.includes('This request cannot be processed')) {
            userMessage = 'This request cannot be processed. Please contact support.';
        } else if (userMessage.includes('secret key') || userMessage.includes('FLW_SECRET_KEY')) {
            userMessage = 'Payment service configuration error. Please contact support.';
        }

        // Notify user
        try {
            if (request && request.userId) {
                await createNotification(
                    request.userId,
                    '❌ Withdrawal Failed',
                    `Your withdrawal of ₦${request.amount ? request.amount.toLocaleString() : 'unknown'} failed. Error: ${userMessage}. Please try again later.`,
                    'withdrawal_failed'
                );
            }
        } catch (e) {
            console.error('Failed to notify user:', e);
        }

        // Notify all admins with user name lookup
        try {
            const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();

            let userDisplayName = request?.userId || 'Unknown User';
            try {
                if (request?.userId) {
                    const failedUserDoc = await db.collection('users').doc(request.userId).get();
                    if (failedUserDoc.exists) {
                        const failedUser = failedUserDoc.data();
                        userDisplayName = failedUser.fullName || failedUser.email || request.userId;
                    }
                }
            } catch (e) {
                console.error('Failed to look up user name:', e);
            }

            const failureNotificationMessage = request
                ? `Withdrawal of ₦${(request.amount || 0).toLocaleString()} failed for ${userDisplayName}. Reason: ${userMessage}. Check failed withdrawals to retry.`
                : `A withdrawal failed. Reason: ${userMessage}. Check failed withdrawals to retry.`;

            for (const adminDoc of adminsSnap.docs) {
                await createNotification(
                    adminDoc.id,
                    '⚠️ Withdrawal Failed',
                    failureNotificationMessage,
                    'admin_withdrawal_failed',
                    { status: 'action_required' }
                );
            }

            console.log(`📢 Notified ${adminsSnap.size} admin(s)`);
        } catch (e) {
            console.error('Failed to notify admins:', e);
        }

        // Save full audit trail
        try {
            if (requestRef) {
                await requestRef.update({
                    status: 'failed',
                    error: userMessage,
                    technicalError,
                    flutterwaveResponse,
                    statusCode,
                    processedAt: new Date(),
                    processedBy: actorId,
                    processedByType: actorType
                });
            }
        } catch (e) {
            console.error('Failed to save audit trail:', e);
        }

        return {
            success: false,
            reason: 'flutterwave_error',
            httpStatus: 500,
            error: userMessage,
            technicalError
        };
    }
}

module.exports = { executeWithdrawal };