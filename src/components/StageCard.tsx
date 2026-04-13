import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Stage } from '@/types';

const DIFFICULTY_LABEL: Record<string, string> = {
  easy:     '●  Easy',
  moderate: '●●  Moderate',
  hard:     '●●●  Hard',
};

function getDifficulty(m: number): 'easy' | 'moderate' | 'hard' {
  if (m < 1.2) return 'easy';
  if (m < 1.5) return 'moderate';
  return 'hard';
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:     '#39FF14',
  moderate: '#FFB800',
  hard:     '#FF6B00',
};

interface Props {
  stage: Stage;
  isToday?: boolean;
}

export function StageCard({ stage, isToday }: Props) {
  const diff = getDifficulty(stage.difficultyMultiplier);

  return (
    <View style={[styles.card, isToday && styles.todayBorder]}>
      {/* Day header */}
      <View style={styles.row}>
        <View>
          <Text style={styles.dayLabel}>DAY {stage.dayNumber}</Text>
          <Text style={styles.date}>
            {stage.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
        </View>
        <Text style={[styles.diffBadge, { color: DIFFICULTY_COLOR[diff] }]}>
          {DIFFICULTY_LABEL[diff]}
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.stats}>
        <Stat label="Distance" value={`${stage.distanceKm} km`} />
        <Stat label="Climb"    value={`${stage.elevationGainM} m`} />
        <Stat label="Eff. km"  value={`${stage.effectiveKm} km`} accent />
      </View>

      {/* Town */}
      {stage.targetTown ? (
        <Text style={styles.town}>🏘  {stage.targetTown}</Text>
      ) : null}
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent && styles.accentValue]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card:        { backgroundColor: '#142016', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1E3322' },
  todayBorder: { borderColor: '#39FF14', borderWidth: 2 },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  dayLabel:    { color: '#39FF14', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  date:        { color: '#F5F5F5', fontSize: 15, fontWeight: '600', marginTop: 2 },
  diffBadge:   { fontSize: 12, fontWeight: '600' },
  stats:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat:        { flex: 1, backgroundColor: '#0D1B0F', borderRadius: 10, padding: 10, alignItems: 'center' },
  statValue:   { color: '#F5F5F5', fontSize: 16, fontWeight: '700' },
  accentValue: { color: '#39FF14' },
  statLabel:   { color: '#6B7280', fontSize: 11, marginTop: 2 },
  town:        { color: '#9CA3AF', fontSize: 13 },
});
