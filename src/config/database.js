import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

const initializeFirestore = () => {
  // Return existing instance if already initialized
  if (db) {
    return db;
  }

  try {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      let initialized = false;

      // Try service account from environment variable first
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
          });
          console.log('🔥 Using service account from environment variable');
          initialized = true;
        } catch (envError) {
          console.log('⚠️ Failed to parse service account from environment:', envError.message);
        }
      }

      // Try service account file if env variable failed
      if (!initialized) {
        try {
          const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
          const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
          });
          console.log('🔥 Using service account from file');
          initialized = true;
        } catch (fileError) {
          console.log('📝 Service account file not found:', fileError.message);
        }
      }

      // Fallback to project ID only (for emulator or default credentials)
      if (!initialized) {
        console.log('📝 Using project ID only (no service account)');
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'expense-tracker-7ca1a'
        });
      }
    }

    // Get Firestore instance
    db = admin.firestore();

    console.log('🔥 Firestore Connected Successfully');
    return db;

  } catch (error) {
    console.error('❌ Error connecting to Firestore:', error.message);
    process.exit(1);
  }
};

// Initialize and export the Firestore instance
initializeFirestore();
export { db };
export default initializeFirestore;
