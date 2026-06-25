import { createContext, useContext, useEffect, useState } from 'react'
import { auth, onAuthStateChanged, signInAnonymously } from '../firebase'
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)

        // Sync Google user profile to Firestore on every sign-in
        if (!firebaseUser.isAnonymous) {
          try {
            const db = getFirestore()
            await setDoc(
              doc(db, 'users', firebaseUser.uid),
              {
                display_name: firebaseUser.displayName || '',
                email:        firebaseUser.email       || '',
                photo_url:    firebaseUser.photoURL    || '',
                last_seen:    serverTimestamp(),
              },
              { merge: true }   // don't overwrite xp / badges
            )
          } catch (e) {
            console.warn('Profile sync failed:', e)
          }
        }
      } else {
        // Auto sign-in anonymously so every session has a UID
        try {
          await signInAnonymously(auth)
        } catch (e) {
          console.error('Anonymous sign-in failed:', e)
          setUser(null)
          setLoading(false)
        }
      }
      setLoading(false)
    })

    return () => unsub()
  }, [])

  // Helpers consumed by child components
  const uid         = user?.uid         ?? 'anonymous'
  const displayName = user?.displayName ?? (user?.isAnonymous ? 'Guest' : 'Anonymous')
  const isAnonymous = user?.isAnonymous ?? true
  const photoURL    = user?.photoURL    ?? null

  return (
    <AuthContext.Provider value={{ user, uid, displayName, isAnonymous, photoURL, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
