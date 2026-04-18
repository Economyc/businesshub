import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// Auto-detect long-polling: el SDK detecta proxies/firewalls que buffean
// streams HTTP y cambia de WebChannel streaming a XHR long-polling. El path
// (/Listen/channel y /Write/channel) NO cambia, solo el transporte, así que
// esto no evade adblockers que matcheen por URL pattern — pero sí evita
// timeouts en redes corporativas con proxies que rompen streaming.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
})
export const functions = getFunctions(app)
export const storage = getStorage(app)
