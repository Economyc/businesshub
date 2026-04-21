import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
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
// Persistence local (IndexedDB): lecturas repetidas sirven desde el browser
// sin red. Home antes hacía 4 `getDocs` paralelos a Firestore por red para
// leer el cache de ventas POS — con miles de docs tardaba segundos. Con
// persistence, la segunda carga es instantánea y la red solo trae deltas.
// `persistentMultipleTabManager` evita conflicto si el usuario abre varias
// pestañas del Hub a la vez.
// Auto-detect long-polling: el SDK detecta proxies/firewalls que buffean
// streams HTTP y cambia de WebChannel streaming a XHR long-polling.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
export const functions = getFunctions(app)
export const storage = getStorage(app)
