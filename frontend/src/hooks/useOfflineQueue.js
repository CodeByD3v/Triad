/**
 * Offline-first queue: stores pending issue submissions in IndexedDB.
 * Flushes to the API when connectivity is restored.
 */
import { useState, useEffect } from 'react'

const DB_NAME = 'civic_hero_offline'
const STORE = 'pending_issues'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) =>
      e.target.result.createObjectStore(STORE, { autoIncrement: true })
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

export function useOfflineQueue(apiBase) {
  const [pendingCount, setPendingCount] = useState(0)

  async function queueSubmission(formData) {
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add({ formData, timestamp: Date.now() })
    await new Promise((r) => {
      tx.oncomplete = r
    })
    refreshCount()
  }

  async function flushQueue() {
    if (!navigator.onLine) return
    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const allKeys = await new Promise((r) => {
      const req = store.getAllKeys()
      req.onsuccess = (e) => r(e.target.result)
    })
    const allVals = await new Promise((r) => {
      const req = store.getAll()
      req.onsuccess = (e) => r(e.target.result)
    })

    for (let i = 0; i < allKeys.length; i++) {
      try {
        await fetch(`${apiBase}/api/issues`, {
          method: 'POST',
          body: allVals[i].formData,
        })
        store.delete(allKeys[i])
      } catch (_) {
        /* leave in queue */
      }
    }
    refreshCount()
  }

  async function refreshCount() {
    const db = await openDB()
    const count = await new Promise((r) => {
      const req = db.transaction(STORE).objectStore(STORE).count()
      req.onsuccess = (e) => r(e.target.result)
    })
    setPendingCount(count)
  }

  useEffect(() => {
    refreshCount()
    window.addEventListener('online', flushQueue)
    return () => window.removeEventListener('online', flushQueue)
  }, [])

  return { queueSubmission, flushQueue, pendingCount }
}
