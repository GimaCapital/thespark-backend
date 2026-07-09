// scripts/fix-message-senders.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountkey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixMessages() {
    const sessionsSnapshot = await db.collection('chatSessions').get();
    
    for (const sessionDoc of sessionsSnapshot.docs) {
        const sessionData = sessionDoc.data();
        const messages = sessionData.messages || [];
        const userId = sessionData.userId;
        const agentId = sessionData.agentId;
        
        let updated = false;
        const fixedMessages = messages.map(msg => {
            // If sender is 'agent' but the message is from the user
            if (msg.sender === 'agent' && msg.senderId === userId) {
                updated = true;
                return { ...msg, sender: 'user' };
            }
            // If sender is 'user' but the message is from the agent
            if (msg.sender === 'user' && msg.senderId === agentId) {
                updated = true;
                return { ...msg, sender: 'agent' };
            }
            // If sender is missing, set based on isAgent
            if (!msg.sender) {
                updated = true;
                return { ...msg, sender: msg.isAgent ? 'agent' : 'user' };
            }
            return msg;
        });
        
        if (updated) {
            await db.collection('chatSessions').doc(sessionDoc.id).update({
                messages: fixedMessages
            });
            console.log(`✅ Fixed messages for session: ${sessionDoc.id}`);
        }
    }
    
    console.log('✅ All messages fixed!');
}

fixMessages().catch(console.error);