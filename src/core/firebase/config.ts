import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import type { Functions } from 'firebase/functions'
import type { FirebaseStorage } from 'firebase/storage'

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
  // Sin esto, addDoc/updateDoc lanza si CUALQUIER campo es undefined. El
  // agente persistia UIMessages del AI SDK con campos opcionales (createdAt,
  // parts, toolInvocations, etc.) y los saves fallaban silenciosamente.
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    // Cap de 50MB en IndexedDB. Default Firestore es 40MB pero crecía sin
    // limite con persistence + cache POS de 90 dias + transacciones. En
    // tablets/movil con poco storage causaba quota exceeded silencioso.
    cacheSizeBytes: 50 * 1024 * 1024,
  }),
})

// `firebase/functions` y `firebase/storage` solo los usan modulos lazy
// (agent, pos-sync, talent, logo-picker, settings). Los importamos
// dinamicamente para que NO entren al chunk firebase-vendor inicial: el
// browser solo descarga ese codigo cuando el usuario abre el modulo
// correspondiente. Ganancia ~30-40KB minified al boot.
let functionsPromise: Promise<Functions> | null = null
export function getAppFunctions(): Promise<Functions> {
  if (!functionsPromise) {
    functionsPromise = import('firebase/functions').then((mod) =>
      mod.getFunctions(app),
    )
  }
  return functionsPromise
}

let storagePromise: Promise<FirebaseStorage> | null = null
export function getAppStorage(): Promise<FirebaseStorage> {
  if (!storagePromise) {
    storagePromise = import('firebase/storage').then((mod) => mod.getStorage(app))
  }
  return storagePromise
}
