const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

// ✅ FIX: Properly handle the private key
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Remove quotes if present
if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
}

// Replace literal \n with actual newlines
if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
}

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function isTodayTheirMessageDay(user) {
    if (!user.cycleStartDate) return false;
    
    const today = new Date();
    const cycleStart = user.cycleStartDate.toDate ? user.cycleStartDate.toDate() : new Date(user.cycleStartDate);
    const daysSinceStart = Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24));
    
    return daysSinceStart === (user.currentDay - 1);
}

async function sendDailyMessages() {
    console.log(`[${new Date().toISOString()}] Sending daily messages...`);
    
    try {
        const usersSnapshot = await db.collection('users')
            .where('isActive', '==', true)
            .where('fcmToken', '!=', null)
            .get();
        
        console.log(`Found ${usersSnapshot.size} users with FCM tokens`);
        
        let sentCount = 0;
        let errorCount = 0;
        let invalidTokensRemoved = 0;
        let day1PlusSent = 0;
        let skippedUsers = 0;
        
        const appUrl = process.env.APP_URL || 'https://thespark-frontend.onrender.com';
        
        for (const userDoc of usersSnapshot.docs) {
            const user = userDoc.data();
            const fcmToken = user.fcmToken;
            const userId = userDoc.id;
            
            let messageData = null;
            let messageType = '';
            let shouldSend = false;
            
            // ✅ FIX: For old users without hasStartedCycle, check if currentDay > 0
            const hasStarted = user.hasStartedCycle === true || user.currentDay > 0;
            
            // ✅ CASE 1: User hasn't started cycle yet (Day 0)
            if (!hasStarted) {
                // Day 0 message is already shown via API (/users/me)
                // So we skip it in cron job
                console.log(`⏳ Skipping ${user.fullName || userId} - Day 0 message already shown via API`);
                skippedUsers++;
                continue;
            } 
            // ✅ CASE 2: User has started cycle (Day 1+)
            else if (hasStarted && user.currentDay > 0) {
                // Check if today is their message day
                if (!isTodayTheirMessageDay(user)) {
                    console.log(`⏳ Skipping ${user.fullName || userId} - Day ${user.currentDay} message not scheduled for today`);
                    skippedUsers++;
                    continue;
                }
                
                // Get message for their cycle and day
                const messageQuery = await db.collection('dailyMessages')
                    .where('cycle', '==', user.currentCycle)
                    .where('day', '==', user.currentDay)
                    .limit(1)
                    .get();
                
                if (!messageQuery.empty) {
                    messageData = messageQuery.docs[0].data();
                    messageType = `Day ${user.currentDay}, Cycle ${user.currentCycle}`;
                    shouldSend = true;
                } else {
                    console.log(`⚠️ No message found for ${user.fullName || userId} - Day ${user.currentDay}, Cycle ${user.currentCycle}`);
                    skippedUsers++;
                    continue;
                }
            }
            
            // ✅ If we have a message, send it
            if (shouldSend && messageData) {
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
                            link: `${appUrl}/dashboard`
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
                    day1PlusSent++;
                    console.log(`✅ ${messageType} sent to ${user.fullName || userId}`);
                } catch (error) {
                    errorCount++;
                    console.error(`❌ Failed to send to ${user.fullName || userId}:`, error.message);
                    
                    // ✅ Remove invalid token
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        await db.collection('users').doc(userId).update({
                            fcmToken: null
                        });
                        invalidTokensRemoved++;
                        console.log(`🗑️ Removed invalid token for ${user.fullName || userId}`);
                    }
                }
            }
        }
        
        console.log(`[${new Date().toISOString()}] Daily messages complete.`);
        console.log(`📊 Sent: ${sentCount} (Day 1+: ${day1PlusSent}), Errors: ${errorCount}, Skipped: ${skippedUsers}, Invalid tokens removed: ${invalidTokensRemoved}`);
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