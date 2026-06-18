const admin = require('firebase-admin');

const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_CLIENT_CERT_URL'
];

const missingVars = requiredEnvVars.filter(key => !process.env[key]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  throw new Error(`Missing Firebase config: ${missingVars.join(', ')}`);
}

let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim()
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\r\n?/g, '\n');

const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: 'googleapis.com'
};

let firebaseApp;
let db;
let auth;

try {
  if (admin.apps.length === 0) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
    });

    console.log('Firebase Admin initialized successfully');
    console.log('Project:', process.env.FIREBASE_PROJECT_ID);
  } else {
    firebaseApp = admin.apps[0];
    console.log('Firebase Admin already initialized');
  }

  db = admin.firestore();
  auth = admin.auth();

  db.settings({
    ignoreUndefinedProperties: true,
    ...(process.env.NODE_ENV === 'production' && { preferRest: true })
  });

} catch (error) {
  console.error('Firebase initialization failed:', error.message);
  if (error.message.includes('private_key')) {
    console.error('Check your FIREBASE_PRIVATE_KEY format (should contain real newlines)');
  }
  throw error;
}

const testConnection = async () => {
  try {
    const testRef = db.collection('_health_check_').doc('ping');
    await testRef.set({
      status: 'ok',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      env: process.env.NODE_ENV
    });
    await testRef.delete();
    console.log('Firestore connection test successful');
    return true;
  } catch (err) {
    console.error('Firestore connection test failed:', err.message);
    return false;
  }
};

const connectionTestPromise = testConnection();

module.exports = {
  db,
  auth,
  admin,
  firebaseApp,
  connectionTest: connectionTestPromise,

  isFirestoreConnected: async () => {
    try {
      await db.collection('_health_check_').doc('health').set({
        status: 'ok',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return true;
    } catch (e) {
      console.error('Health check failed:', e.message);
      return false;
    }
  },

  getFirebaseInfo: () => ({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL?.replace(/(.{4}).*(@.*)/, '$1****$2'),
    environment: process.env.NODE_ENV || 'development',
    initializedApps: admin.apps.length,
  }),

  FieldValue: admin.firestore.FieldValue,
  Timestamp: admin.firestore.Timestamp,
  batch: () => db.batch(),
  runTransaction: (callback) => db.runTransaction(callback),
  generateId: () => db.collection('_temp_').doc().id,
};

console.log('Firebase module exported successfully');