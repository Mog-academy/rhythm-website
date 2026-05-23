import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyBfkNx-4HPpzYSALJlW_iHhsbRT8S2_9uQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'app-rhythm.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'app-rhythm',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'app-rhythm.firebasestorage.app',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ??
    '1:948271529714:android:c24f68cf51cb2bac22da6b',
}

const hasRequiredConfig =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId)

export const firebaseEnabled = hasRequiredConfig

export const firebaseSharedSyncDocId =
  import.meta.env.VITE_FIREBASE_SHARED_SYNC_DOC_ID ?? 'rhythm_primary'

export const firebaseApp = hasRequiredConfig ? initializeApp(firebaseConfig) : null
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null
export const firebaseDb = firebaseApp ? getFirestore(firebaseApp) : null
