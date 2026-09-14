// Generic collection store: uses Firestore when configured, else localStorage.
// Keeps calling code simple and identical regardless of backend.
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc, query, where,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebase'

function isDemoMode() {
  return localStorage.getItem('sat_demo_mode') === '1'
}

function lsKey(col: string) {
  return `sat_${col}`
}

function lsRead<T>(col: string): T[] {
  const raw = localStorage.getItem(lsKey(col))
  return raw ? JSON.parse(raw) : []
}

function lsWrite<T>(col: string, items: T[]) {
  localStorage.setItem(lsKey(col), JSON.stringify(items))
}

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => withoutUndefined(item)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)])
    ) as T
  }

  return value
}

export function seedIfEmpty<T extends { id: string }>(col: string, seed: T[]) {
  if (isFirebaseConfigured && !isDemoMode()) return
  const existing = lsRead<T>(col)
  if (existing.length === 0) lsWrite(col, seed)
}

export async function getAll<T>(col: string): Promise<T[]> {
  if (isFirebaseConfigured && db && !isDemoMode()) {
    const snap = await getDocs(collection(db, col))
    return snap.docs.map((d) => ({ ...d.data(), id: d.id })) as T[]
  }
  return lsRead<T>(col)
}

export async function getWhere<T>(col: string, field: string, value: unknown): Promise<T[]> {
  if (isFirebaseConfigured && db && !isDemoMode()) {
    const snap = await getDocs(query(collection(db, col), where(field, '==', value)))
    return snap.docs.map((d) => ({ ...d.data(), id: d.id })) as T[]
  }
  const all = lsRead<any>(col)
  return all.filter((item: any) => item[field] === value)
}

export async function getById<T>(col: string, id: string): Promise<T | null> {
  if (isFirebaseConfigured && db && !isDemoMode()) {
    const snap = await getDoc(doc(db, col, id))
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as T) : null
  }
  const all = lsRead<any>(col)
  return all.find((i: any) => i.id === id) ?? null
}

export async function create<T extends { id?: string }>(col: string, data: T): Promise<string> {
  if (isFirebaseConfigured && db && !isDemoMode()) {
    const ref = await addDoc(collection(db, col), withoutUndefined(data))
    return ref.id
  }
  const all = lsRead<any>(col)
  const id = data.id || `${col}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  all.push({ ...data, id })
  lsWrite(col, all)
  return id
}

export async function update<T extends object>(
  col: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  if (isFirebaseConfigured && db && !isDemoMode()) {
    await updateDoc(doc(db, col, id), withoutUndefined(data) as any)
    return
  }
  const all = lsRead<any>(col)
  const idx = all.findIndex((i: any) => i.id === id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...data }
    lsWrite(col, all)
  }
}

export async function put<T extends { id: string }>(col: string, item: T): Promise<void> {
  if (isFirebaseConfigured && db && !isDemoMode()) {
    await setDoc(doc(db, col, item.id), withoutUndefined(item))
    return
  }
  const all = lsRead<any>(col)
  const idx = all.findIndex((i: any) => i.id === item.id)
  if (idx >= 0) all[idx] = item
  else all.push(item)
  lsWrite(col, all)
}

export async function remove(col: string, id: string): Promise<void> {
  if (isFirebaseConfigured && db && !isDemoMode()) {
    await deleteDoc(doc(db, col, id))
    return
  }
  const all = lsRead<any>(col)
  lsWrite(col, all.filter((i: any) => i.id !== id))
}