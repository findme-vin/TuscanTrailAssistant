/**
 * AUTH CONTEXT
 * Wraps the app with Firebase Auth state.
 * Provides: user, loading, signInWithGoogle, signInWithEmail, signUp, signOut
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, COLLECTIONS } from '@/lib/firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Upsert user profile in Firestore on first sign-in
      if (firebaseUser) {
        const ref = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName ?? 'Rider',
            photoURL: firebaseUser.photoURL ?? null,
            createdAt: serverTimestamp(),
          });
        }
      }
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } else {
        // Native: requires expo-auth-session or @react-native-google-signin/google-signin
        // Placeholder — implement with Expo AuthSession when building native
        throw new Error('Google Sign-In on native requires additional setup');
      }
    } catch (e: any) {
      setError(e.message ?? 'Google sign-in failed');
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError(friendlyAuthError(e.code));
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setError(null);
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(newUser, { displayName });
    } catch (e: any) {
      setError(friendlyAuthError(e.code));
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUp, signOut, error, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── Friendly error messages ─────────────────────────────────────────────────
function friendlyAuthError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/email-already-in-use':  return 'That email is already registered.';
    case 'auth/weak-password':         return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':         return 'Please enter a valid email address.';
    case 'auth/too-many-requests':     return 'Too many attempts. Please try again later.';
    default: return 'Authentication failed. Please try again.';
  }
}
