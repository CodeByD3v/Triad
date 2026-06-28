/**
 * Offline-first queue: stores pending issue submissions in IndexedDB.
 * FormData is NOT serializable, so we convert to a plain object with
 * base64-encoded image before storing, and reconstruct on flush.
 * Flushes to the API when connectivity is restored.
 */
import { useState, useEffect } from 'react'

const DB_NAME = 'civic_hero_offline'
const STORE   = 'pending_issues'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) =>
      e.target.result.createObjectStore(STORE, { autoIncrement: true })
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => reject(e.target.error)
  })
}

/** Convert a File/Blob to base64 string */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result) // data:mime;base64,...
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Reconstruct a FormData from our serializable snapshot */
async function snapshotToFormData(snapshot) {
  const fd = new FormData()

  // Reconstruct image File from base64
  if (snapshot.imageBase64) {
    const res   = await fetch(snapshot.imageBase64)
    const blob  = await res.blob()
    const file  = new File([blob], snapshot.imageName || 'image.jpg',
                           { type: snapshot.imageType || 'image/jpeg' })
    fd.append('image', file)
  }

  fd.append('latitude',    snapshot.latitude    ?? 0)
  fd.append('longitude',   snapshot.longitude   ?? 0)
  fd.append('description', snapshot.description ?? '')
  fd.append('reported_by', snapshot.reported_by ?? 'anonymous')

  return fd
}

export function useOfflineQueue(apiBase) {
  const [pendingCount, setPendingCount] = useState(0)

  /**
   * Accepts a FormData from Report.jsx and converts it to a
   * serializable snapshot before saving to IndexedDB.
   */
  async function queueSubmission(formData) {
    const imageFile = formData.get('image')

    let imageBase64 = null
    let imageName   = null
    let imageType   = null

    if (imageFile && imageFile instanceof File) {
      imageBase64 = await fileToBase64(imageFile)
      imageName   = imageFile.name
      imageType   = imageFile.type
    }

    const snapshot = {
      imageBase64,
      imageName,
      imageType,
      latitude:    formData.get('latitude'),
      longitude:   formData.get('longitude'),
      description: formData.get('description'),
      reported_by: formData.get('reported_by'),
      timestamp:   Date.now(),
    }

    const db = await openDB()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).add(snapshot)
    await new Promise((r) => { tx.oncomplete = r })
    refreshCount()
  }

  async function flushQueue() {
    if (!navigator.onLine) return

    const db    = await openDB()
    const tx    = db.transaction(STORE, 'readwrite')
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
        const fd = await snapshotToFormData(allVals[i])
        const res = await fetch(`${apiBase}/api/issues`, {
          method: 'POST',
          body: fd,
        })
        if (res.ok) {
          store.delete(allKeys[i])
        }
      } catch (_) {
        // Leave in queue — will retry on next online event
      }
    }
    refreshCount()
  }

  async function refreshCount() {
    try {
      const db    = await openDB()
      const count = await new Promise((r) => {
        const req = db.transaction(STORE).objectStore(STORE).count()
        req.onsuccess = (e) => r(e.target.result)
      })
      setPendingCount(count)
    } catch {
      setPendingCount(0)
    }
  }

  useEffect(() => {
    refreshCount()
    window.addEventListener('online', flushQueue)
    return () => window.removeEventListener('online', flushQueue)
  }, [])

  return { queueSubmission, flushQueue, pendingCount }
}
