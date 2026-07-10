// delete-user.js
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
});

const db = admin.firestore();

const USER_ID = '7vP7uDPKJNVuplVJR3LFde9INbi1';

async function deleteUser() {
    console.log(`🗑️ Deleting user: ${USER_ID}`);
    
    try {
        // 1. Delete main user document
        console.log('📄 Deleting user document...');
        await db.collection('users').doc(USER_ID).delete();
        console.log('✅ User document deleted');
        
        // 2. ✅ DYNAMIC: Scan ALL collections and delete user data
        console.log('\n🔍 Scanning all collections for user data...');
        
        const collections = await db.listCollections();
        let totalDeleted = 0;
        let collectionsWithData = [];
        
        for (const collection of collections) {
            console.log(`📂 Checking collection: ${collection.id}`);
            
            try {
                // ✅ Check for userId field
                const snapshot = await collection
                    .where('userId', '==', USER_ID)
                    .get();
                
                if (snapshot.empty) {
                    // ✅ Try alternative field names
                    const altSnapshot = await collection
                        .where('uid', '==', USER_ID)
                        .get();
                    
                    if (!altSnapshot.empty) {
                        const batch = db.batch();
                        altSnapshot.forEach(doc => {
                            batch.delete(doc.ref);
                            totalDeleted++;
                        });
                        await batch.commit();
                        collectionsWithData.push({ 
                            name: collection.id, 
                            count: altSnapshot.size, 
                            field: 'uid' 
                        });
                        console.log(`   ✅ Deleted ${altSnapshot.size} documents (using 'uid' field)`);
                    }
                    continue;
                }
                
                const batch = db.batch();
                snapshot.forEach(doc => {
                    batch.delete(doc.ref);
                    totalDeleted++;
                });
                
                await batch.commit();
                collectionsWithData.push({ 
                    name: collection.id, 
                    count: snapshot.size, 
                    field: 'userId' 
                });
                console.log(`   ✅ Deleted ${snapshot.size} documents from ${collection.id}`);
                
            } catch (error) {
                // Some collections may not have a userId field - skip them
                console.log(`   ⏭️ Skipping ${collection.id} (no userId field)`);
            }
        }
        
        // 3. Summary
        console.log('\n📊 Summary:');
        console.log(`   User ID: ${USER_ID}`);
        console.log(`   Collections with data: ${collectionsWithData.length}`);
        console.log(`   Total documents deleted: ${totalDeleted}`);
        
        if (collectionsWithData.length > 0) {
            console.log('\n   Details:');
            collectionsWithData.forEach(c => {
                console.log(`   - ${c.name}: ${c.count} documents (field: ${c.field})`);
            });
        }
        
        console.log('\n✅ Done!');
        
    } catch (error) {
        console.error('❌ Error deleting user:', error);
    }
}

deleteUser();