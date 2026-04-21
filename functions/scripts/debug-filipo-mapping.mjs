import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ credential: applicationDefault(), projectId: 'empresas-bf' })
const db = getFirestore()

const filipoId = 'C06xQypKRqtVenO4ZLfy'

// 1. Qué tiene el doc de Filipo
const docSnap = await db.collection('companies').doc(filipoId).get()
console.log(`Filipo doc data:`, JSON.stringify(docSnap.data(), null, 2))

// 2. Query por posTenantId - ¿devuelve Filipo?
const q = await db.collection('companies').where('posTenantId', '==', 'filipo').get()
console.log(`\nQuery posTenantId==filipo: ${q.size} docs`)
q.docs.forEach((d) => console.log(`  ${d.id} name="${d.data().name}" location="${d.data().location}"`))

process.exit(0)
