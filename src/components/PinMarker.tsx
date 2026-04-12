import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { PinCategory } from '@/types';

const PIN_CONFIG: Record<PinCategory, { emoji: string; color: string }> = {
  water:   { emoji: '💧', color: '#3B82F6' },
  mud:     { emoji: '🟫', color: '#92400E' },
  hazard:  { emoji: '⚠️', color: '#FF6B00' },
  info:    { emoji: 'ℹ️', color: '#39FF14' },
  closed:  { emoji: '🚫', color: '#FF3B30' },
  repair:  { emoji: '🔧', color: '#FFB800' },
};

interface Props {
  category: PinCategory;
  message?: string;
  onPress?: () => void;
}

export function PinMarker({ category, message, onPress }: Props) {
  const { emoji, color } = PIN_CONFIG[category];
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.bubble, { borderColor: color }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={[styles.tail, { borderTopColor: color }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#142016', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  emoji:  { fontSize: 18 },
  tail:   { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', alignSelf: 'center' },
});
