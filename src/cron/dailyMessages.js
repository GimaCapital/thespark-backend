const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

// Use environment variables (matching your server.js pattern)
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function sendDailyMessages() {
    console.log(`[${new Date().toISOString()}] Sending daily messages...`);
    
    try {
        // Get all active users who have FCM tokens
        const usersSnapshot = await db.collection('users')
            .where('isActive', '==', true)
            .where('fcmToken', '!=', null)
            .get();
        
        console.log(`Found ${usersSnapshot.size} users with FCM tokens`);
        
        let sentCount = 0;
        let errorCount = 0;
        
        // Get APP_URL from environment variable
        const appUrl = process.env.APP_URL || 'https://thespark-frontend.onrender.com';
        
        for (const userDoc of usersSnapshot.docs) {
            const user = userDoc.data();
            const fcmToken = user.fcmToken;
            
            // Get today's message based on user's current cycle and day
            const messageQuery = await db.collection('dailyMessages')
                .where('cycle', '==', user.currentCycle)
                .where('day', '==', user.currentDay)
                .limit(1)
                .get();
            
            if (!messageQuery.empty) {
                const messageData = messageQuery.docs[0].data();
                
                const notification = {
                    token: fcmToken,
                    notification: {
                        title: `📖 ${messageData.principle}`,
                        body: messageData.message.substring(0, 100)
                    },
                    webpush: {
                        notification: {
                            icon: '/icons/icon-192x192.png',
                            badge: '/icons/icon-72x72.png',
                            vibrate: [200, 100, 200],
                            requireInteraction: true
                        },
                        fcmOptions: {
                            link: `${appUrl}/dashboard`  // ← FIXED: Uses env variable
                        }
                    },
                    android: {
                        priority: 'high',
                        notification: {
                            icon: 'ic_notification',
                            color: '#F97316'
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: 'default',
                                badge: 1
                            }
                        }
                    }
                };
                
                try {
                    await admin.messaging().send(notification);
                    sentCount++;
                    console.log(`✅ Sent to ${user.fullName || user.phone}`);
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Failed to send to ${user.fullName || user.phone}:`, error.message);
                    
                    // Remove invalid token
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        await db.collection('users').doc(userDoc.id).update({
                            fcmToken: null
                        });
                    }
                }
            }
        }
        
        console.log(`[${new Date().toISOString()}] Daily messages complete. Sent: ${sentCount}, Errors: ${errorCount}`);
    } catch (error) {
        console.error('Error sending daily messages:', error);
    }
}

// Run if called directly
if (require.main === module) {
    sendDailyMessages()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { sendDailyMessages };