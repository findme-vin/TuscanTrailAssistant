/**
 * ITINERARY HOOKS
 * Save and load trip itineraries to/from Firestore.
 * Document path: /users/{uid}/itineraries/{itineraryId}
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavedItinerary {
  id: string;
  name: string;
  startDate: string;
  startTime: string;
  totalDays: number;
  units: 'metric' | 'imperial';
  townOverrides: Record<number, { name: string; kmMarker: number; coord: { lat: number; lng: number } }>;
  savedAt: string; // ISO string
}

type ItineraryPayload = Omit<SavedItinerary, 'id' | 'savedAt'>;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useItinerary() {
  const { user } = useAuth();
  const [itineraries, setItineraries] = useState<SavedItinerary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Path helper
  const itinCollection = useCallback(() => {
    if (!user) throw new Error('Not signed in');
    return collection(db, 'users', user.uid, 'itineraries');
  }, [user]);

  // Load all itineraries for current user
  const loadItineraries = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    setError(null);
    try {
      const q = query(itinCollection(), orderBy('savedAt', 'desc'));
      const snap = await getDocs(q);
      const results: SavedItinerary[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name ?? 'My Itinerary',
          startDate: data.startDate,
          startTime: data.startTime,
          totalDays: data.totalDays,
          units: data.units ?? 'metric',
          townOverrides: data.townOverrides ?? {},
          savedAt: data.savedAt instanceof Timestamp
            ? data.savedAt.toDate().toISOString()
            : data.savedAt ?? new Date().toISOString(),
        };
      });
      setItineraries(results);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load itineraries');
    } finally {
      setLoadingList(false);
    }
  }, [user, itinCollection]);

  // Save (create new) itinerary
  const saveItinerary = useCallback(async (payload: ItineraryPayload): Promise<string | null> => {
    if (!user) { setError('Sign in to save itineraries'); return null; }
    setSaving(true);
    setError(null);
    try {
      const ref = await addDoc(itinCollection(), {
        ...payload,
        savedAt: serverTimestamp(),
      });
      await loadItineraries(); // refresh list
      return ref.id;
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
      return null;
    } finally {
      setSaving(false);
    }
  }, [user, itinCollection, loadItineraries]);

  // Update existing itinerary
  const updateItinerary = useCallback(async (id: string, payload: ItineraryPayload): Promise<void> => {
    if (!user) { setError('Sign in to save itineraries'); return; }
    setSaving(true);
    setError(null);
    try {
      const ref = doc(itinCollection(), id);
      await setDoc(ref, { ...payload, savedAt: serverTimestamp() }, { merge: true });
      await loadItineraries();
    } catch (e: any) {
      setError(e.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  }, [user, itinCollection, loadItineraries]);

  // Delete itinerary
  const deleteItinerary = useCallback(async (id: string): Promise<void> => {
    if (!user) return;
    try {
      await deleteDoc(doc(itinCollection(), id));
      setItineraries((prev) => prev.filter((it) => it.id !== id));
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete');
    }
  }, [user, itinCollection]);

  // Load on mount / user change
  useEffect(() => {
    if (user) loadItineraries();
    else setItineraries([]);
  }, [user, loadItineraries]);

  return {
    itineraries,
    loadingList,
    saving,
    error,
    saveItinerary,
    updateItinerary,
    deleteItinerary,
    loadItineraries,
  };
}
