import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db } from '@/core/firebase/config'
import { storage } from '@/core/firebase/config'
import { fetchCollection, fetchDocument, createDocument, updateDocument, removeDocument } from '@/core/firebase/helpers'
import type { Employee, EmployeeFormData, EmployeeDocument, DocumentCategory } from './types'

const COLLECTION = 'employees'

function docsCollection(companyId: string, employeeId: string) {
  return collection(db, 'companies', companyId, COLLECTION, employeeId, 'documents')
}

export const talentService = {
  getAll: (companyId: string) => fetchCollection<Employee>(companyId, COLLECTION),
  getById: (companyId: string, id: string) => fetchDocument<Employee>(companyId, COLLECTION, id),
  create: (companyId: string, data: EmployeeFormData) => createDocument(companyId, COLLECTION, data),
  update: (companyId: string, id: string, data: Partial<EmployeeFormData>) => updateDocument(companyId, COLLECTION, id, data),
  remove: (companyId: string, id: string) => removeDocument(companyId, COLLECTION, id),

  async getDocuments(companyId: string, employeeId: string): Promise<EmployeeDocument[]> {
    const ref = docsCollection(companyId, employeeId)
    const q = query(ref, orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as EmployeeDocument[]
  },

  async uploadDocument(
    companyId: string,
    employeeId: string,
    file: File,
    category: DocumentCategory,
  ): Promise<string> {
    const path = `employees/${companyId}/${employeeId}/${Date.now()}_${file.name}`
    const fileRef = storageRef(storage, path)
    await uploadBytes(fileRef, file)
    const url = await getDownloadURL(fileRef)

    const now = Timestamp.now()
    const ref = docsCollection(companyId, employeeId)
    const docRef = await addDoc(ref, {
      name: file.name,
      category,
      url,
      storagePath: path,
      size: file.size,
      contentType: file.type,
      createdAt: now,
      updatedAt: now,
    })
    return docRef.id
  },

  async uploadContractDocument(
    companyId: string,
    employeeId: string,
    blob: Blob,
    contractName: string,
  ): Promise<string> {
    const safeName = contractName.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9\s]/g, '').trim().replace(/\s+/g, '_')
    const path = `employees/${companyId}/${employeeId}/${Date.now()}_Contrato_${safeName}.pdf`
    const fileRef = storageRef(storage, path)
    await uploadBytes(fileRef, blob)
    const url = await getDownloadURL(fileRef)

    const now = Timestamp.now()
    const ref = docsCollection(companyId, employeeId)
    const docRef = await addDoc(ref, {
      name: `Contrato_${safeName}.pdf`,
      category: 'contrato',
      url,
      storagePath: path,
      size: blob.size,
      contentType: 'application/pdf',
      createdAt: now,
      updatedAt: now,
    })
    return docRef.id
  },

  async deleteDocument(
    companyId: string,
    employeeId: string,
    docId: string,
    storagePath: string,
  ): Promise<void> {
    try {
      await deleteObject(storageRef(storage, storagePath))
    } catch {
      // File may already be deleted from storage
    }
    const ref = doc(db, 'companies', companyId, COLLECTION, employeeId, 'documents', docId)
    await deleteDoc(ref)
  },
}
