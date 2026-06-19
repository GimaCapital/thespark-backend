// const admin = require('firebase-admin');
// const dotenv = require('dotenv');

// dotenv.config();

// const serviceAccount = {
//     projectId: process.env.FIREBASE_PROJECT_ID,
//     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//     privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
// };

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount)
// });

// const db = admin.firestore();
// const auth = admin.auth();

// module.exports = { db, auth };


const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// ✅ FIX: Properly handle the private key for Render
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// If the key has literal \n characters, replace them
if (privateKey && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
}

// If the key is wrapped in quotes, remove them
if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
}

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey
};

// ✅ Check if already initialized (prevent multiple init)
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin initialized successfully on Render');
    } catch (error) {
        console.error('❌ Firebase Admin initialization failed:', error.message);
        process.exit(1);
    }
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth };