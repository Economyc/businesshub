// Orígenes permitidos para callables onCall que el browser invoca con preflight
// CORS. Si un origin no está acá, el preflight no recibe el header
// `Access-Control-Allow-Origin` y el browser bloquea la llamada (síntoma:
// "No 'Access-Control-Allow-Origin' header is present" → FirebaseError internal).
//
// App1 (Oracle) + App2 admin (Hetzner/Coolify) + dev local + dominios Firebase.
export const CALLABLE_CORS_ORIGINS: (string | RegExp)[] = [
  'https://businesshub.myvnc.com', // App1 prod (Oracle)
  'https://businessadm.economyc.cc', // App2 admin prod (Hetzner/Coolify)
  'http://134.65.233.213', // App1 IP directa
  'http://localhost:5173', // dev App1
  'http://localhost:5174', // dev App2 (dev:admin)
  /empresas-bf\.web\.app$/,
  /empresas-bf\.firebaseapp\.com$/,
]
