/**
 * COMMUNITY NOTICE BOARD
 * Real-time trail alerts — shared with all riders.
 */
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NoticePin, PinCategory } from '@/types';

const CATEGORIES: { key: PinCategory; emoji: string; label: string; color: string }[] = [
  { key: 'water',  emoji: '💧', label: 'Water',   color: '#3B82F6' },
  { key: 'mud',    emoji: '🟫', label: 'Mud',     color: '#92400E' },
  { key: 'hazard', emoji: '⚠️', label: 'Hazard',  color: '#FF6B00' },
  { key: 'info',   emoji: 'ℹ️', label: 'Info',    color: '#39FF14' },
  { key: 'closed', emoji: '🚫', label: 'Closed',  color: '#FF3B30' },
  { key: 'repair', emoji: '🔧', label: 'Repair',  color: '#FFB800' },
];

const AGE_LABEL = (d: Date) => {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60)  return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

function PinFeedItem({ pin, onUpvote }: { pin: NoticePin; onUpvote: () => void }) {
  const cat = CATEGORIES.find((c) => c.key === pin.category)!;
  return (
    <View style={styles.pinCard}>
      <View style={[styles.catDot, { backgroundColor: cat.color }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.pinRow}>
          <Text style={styles.pinEmoji}>{cat.emoji}</Text>
          <Text style={[styles.pinCat, { color: cat.color }]}>{cat.label}</Text>
          <Text style={styles.pinKm}>km {pin.kmMarker}</Text>
          <Text style={styles.pinAge}>{AGE_LABEL(pin.createdAt)}</Text>
        </View>
        <Text style={styles.pinMsg}>{pin.message}</Text>
        <Text style={styles.pinUser}>— {pin.displayName}</Text>
      </View>
      <TouchableOpacity style={styles.upvoteBtn} onPress={onUpvote}>
        <Text style={styles.upvoteEmoji}>👍</Text>
        <Text style={styles.upvoteCount}>{pin.upvotes}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function NoticeBoardScreen() {
  const [pins, setPins]           = useState<NoticePin[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [category, setCategory]   = useState<PinCategory>('info');
  const [message, setMessage]     = useState('');

  function handleSubmit() {
    if (!message.trim()) { Alert.alert('Add a message'); return; }
    // TODO: write to Firebase Firestore + get real GPS km marker
    const newPin: NoticePin = {
      id:          String(Date.now()),
      userId:      'local-user',
      displayName: 'You',
      category,
      message:     message.trim(),
      coord:       { lat: 43.06, lng: 10.61 },  // TODO: real GPS
      kmMarker:    0,                             // TODO: snap to route
      upvotes:     0,
      isActive:    true,
      expiresAt:   new Date(Date.now() + 48 * 3600 * 1000),
      createdAt:   new Date(),
    };
    setPins((p) => [newPin, ...p]);
    setMessage('');
    setShowForm(false);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.heading}>Trail Alerts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm((v) => !v)}>
          <Text style={styles.addTxt}>{showForm ? '✕ Cancel' : '+ Drop Pin'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── New pin form ── */}
      {showForm && (
        <View style={styles.form}>
          <View style={styles.catRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.catBtn, category === c.key && { borderColor: c.color, backgroundColor: c.color + '22' }]}
                onPress={() => setCategory(c.key)}
              >
                <Text style={styles.catEmoji}>{c.emoji}</Text>
                <Text style={[styles.catLbl, category === c.key && { color: c.color }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.msgInput}
            placeholder="Describe the trail condition… (max 120 chars)"
            placeholderTextColor="#6B7280"
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, 120))}
            multiline
            maxLength={120}
          />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitTxt}>Post Alert</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Feed ── */}
      {pins.length === 0 && !showForm ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📍</Text>
          <Text style={styles.emptyTitle}>No active alerts</Text>
          <Text style={styles.emptySub}>Be the first to drop a trail condition pin for other riders.</Text>
        </View>
      ) : (
        <FlatList
          data={pins}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PinFeedItem
              pin={item}
              onUpvote={() => setPins((prev) => prev.map((p) => p.id === item.id ? { ...p, upvotes: p.upvotes + 1 } : p))}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: '#0D1B0F' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 12 },
  heading:     { color: '#39FF14', fontSize: 26, fontWeight: '800' },
  addBtn:      { backgroundColor: '#142016', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#1E3322' },
  addTxt:      { color: '#F5F5F5', fontSize: 14, fontWeight: '600' },
  form:        { backgroundColor: '#142016', margin: 16, borderRadius: 14, borderWidth: 1, borderColor: '#1E3322', padding: 14, marginBottom: 8 },
  catRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  catBtn:      { borderRadius: 10, borderWidth: 1, borderColor: '#1E3322', paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  catEmoji:    { fontSize: 18 },
  catLbl:      { color: '#6B7280', fontSize: 10, marginTop: 2, fontWeight: '600' },
  msgInput:    { backgroundColor: '#0D1B0F', borderRadius: 10, borderWidth: 1, borderColor: '#1E3322', color: '#F5F5F5', padding: 12, minHeight: 72, textAlignVertical: 'top', marginBottom: 10 },
  submitBtn:   { backgroundColor: '#39FF14', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitTxt:   { color: '#0D1B0F', fontWeight: '800', fontSize: 14 },
  pinCard:     { backgroundColor: '#142016', borderRadius: 14, borderWidth: 1, borderColor: '#1E3322', padding: 14, marginBottom: 10, flexDirection: 'row', gap: 10 },
  catDot:      { width: 4, borderRadius: 2 },
  pinRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  pinEmoji:    { fontSize: 16 },
  pinCat:      { fontSize: 12, fontWeight: '700' },
  pinKm:       { backgroundColor: '#0D1B0F', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, color: '#9CA3AF', fontSize: 11, marginLeft: 'auto' },
  pinAge:      { color: '#6B7280', fontSize: 11 },
  pinMsg:      { color: '#F5F5F5', fontSize: 14, lineHeight: 20 },
  pinUser:     { color: '#6B7280', fontSize: 12, marginTop: 4 },
  upvoteBtn:   { alignItems: 'center', justifyContent: 'center', gap: 2 },
  upvoteEmoji: { fontSize: 18 },
  upvoteCount: { color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  emptyEmoji:  { fontSize: 52 },
  emptyTitle:  { color: '#F5F5F5', fontSize: 18, fontWeight: '700' },
  emptySub:    { color: '#6B7280', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
