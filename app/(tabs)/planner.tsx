/**
 * PLANNER SCREEN
 * Inputs → embedded map with overnight markers → full stage breakdown
 */
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { calculateStages } from '@/algorithm/calculateStages';
import { StageCard } from '@/components/StageCard';
import { ElevationProfile } from '@/components/ElevationProfile';
import { buildDayPlan, suggestOvernightTowns, TRAIL_TOWNS } from '@/data/towns';
import type { TrailTown } from '@/data/towns';
import type { Stage } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useItinerary } from '@/hooks/useItinerary';
import type { SavedItinerary } from '@/hooks/useItinerary';
import { useHotels, checkInForDay } from '@/hooks/useHotels';
import { HotelAvailabilitySection } from '@/components/HotelAvailabilitySection';
import type { HotelAvailability, Coord } from '@/types';

const TOTAL_KM = 454;
const TOTAL_MI = 282.1;
const TOTAL_GAIN_M = 5649;
const TOTAL_GAIN_FT = 18534;

const { MapView, Camera, MarkerView } =
  Platform.OS === 'web'
    ? require('@/mocks/rnmapbox-maps.web')
    : require('@rnmapbox/maps');

const TOTAL_DAYS_OPTIONS = [3, 4, 5, 6];

type Units = 'metric' | 'imperial';
const kmToMi = (km: number) => Math.round(km * 0.621371);
const mToFt = (m: number) => Math.round(m * 3.28084);
const fmtDist = (km: number, u: Units) => u === 'metric' ? `${km} km` : `${kmToMi(km)} mi`;
const fmtElev = (m: number, u: Units) => u === 'metric' ? `${m} m` : `${mToFt(m)} ft`;
const distUnit = (u: Units) => u === 'metric' ? 'km' : 'mi';
const distVal = (km: number, u: Units) => u === 'metric' ? km : kmToMi(km);

/** Format a date string as "Saturday May 20" */
const fmtDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

/** Format a date for day N of the ride: startDate + (dayNumber) days */
const fmtDayDate = (startDate: string, dayNumber: number) => {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + (dayNumber - 1));
  return fmtDate(d.toISOString().slice(0, 10));
};

/** Finish date: startDate + totalDays */
const fmtFinishDate = (startDate: string, totalDays: number) => {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + totalDays);
  return fmtDate(d.toISOString().slice(0, 10));
};

const KM_PER_DAY: Record<number, Record<Units, string>> = {
  3: { metric: '~151', imperial: '~94' },
  4: { metric: '~114', imperial: '~71' },
  5: { metric: '~91', imperial: '~56' },
  6: { metric: '~76', imperial: '~47' },
};

const DAY_COLORS = ['#39FF14', '#00BFFF', '#FF6B6B', '#FFB800'];

export default function PlannerScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { itineraries, loadingList, saving, saveItinerary, updateItinerary, deleteItinerary } = useItinerary();

  const [startDate, setStartDate] = useState('2026-05-20');
  const [startTime, setStartTime] = useState('07:00');
  const [totalDays, setTotalDays] = useState(4);
  const [stages, setStages]       = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [townOverrides, setTownOverrides] = useState<Record<number, TrailTown>>({});
  const [kmInterval, setKmInterval] = useState(0); // 0 = off
  const [units, setUnits] = useState<Units>('metric');
  const [splitPct, setSplitPct] = useState(50); // left pane width %
  const [activeDay, setActiveDay] = useState<number>(1); // 1-indexed day number
  const [hoverKm, setHoverKm] = useState<number | null>(null);

  // Hotel availability
  const [dayRadii, setDayRadii] = useState<Record<number, number>>({});
  const [expandedHotelDays, setExpandedHotelDays] = useState<Set<number>>(new Set());
  const [selectedHotel, setSelectedHotel] = useState<{
    hotelCode: string;
    name: string;
    coord: Coord;
    townCoord: Coord;
  } | null>(null);

  // Saved itinerary ID currently loaded (null = unsaved / new)
  const [loadedItinId, setLoadedItinId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('My Ride Plan');
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const draggingRef = useRef(false);
  const dayCardRefs = useRef<Record<number, HTMLElement | null>>({});
  const scrollRef = useRef<any>(null);

  // Listen for elevation profile hover events
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: any) => {
      const detail = (e as CustomEvent).detail;
      setHoverKm(detail ? detail.km : null);
    };
    window.addEventListener('elevation-hover', handler);
    return () => window.removeEventListener('elevation-hover', handler);
  }, []);

  // Track which day card is most visible in the scroll container
  const updateActiveDay = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const firstCard = dayCardRefs.current[1];
    if (!firstCard) return;
    // Find scrollable ancestor
    let scrollContainer: HTMLElement | null = firstCard.parentElement;
    while (scrollContainer) {
      const style = window.getComputedStyle(scrollContainer);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && scrollContainer.scrollHeight > scrollContainer.clientHeight + 50) break;
      scrollContainer = scrollContainer.parentElement;
    }
    if (!scrollContainer) return;
    const containerRect = scrollContainer.getBoundingClientRect();
    const focusY = containerRect.top + containerRect.height * 0.35;

    let closestDay = 1;
    let closestDist = Infinity;
    Object.entries(dayCardRefs.current).forEach(([dayStr, el]) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cardMid = rect.top + rect.height / 2;
      const dist = Math.abs(cardMid - focusY);
      if (dist < closestDist) {
        closestDist = dist;
        closestDay = parseInt(dayStr);
      }
    });
    setActiveDay(closestDay);
  }, []);

  // Attach native scroll listener to the actual DOM scroll element
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let scrollEl: HTMLElement | null = null;
    const timeout = setTimeout(() => {
      const firstCard = dayCardRefs.current[1];
      if (!firstCard) return;
      // Walk up to find the scrollable ancestor
      let el: HTMLElement | null = firstCard.parentElement;
      while (el) {
        if (el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 50) {
          const style = window.getComputedStyle(el);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            scrollEl = el;
            break;
          }
        }
        el = el.parentElement;
      }
      if (scrollEl) {
        scrollEl.addEventListener('scroll', updateActiveDay, { passive: true });
        updateActiveDay(); // initial call
      }
    }, 600);
    return () => {
      clearTimeout(timeout);
      if (scrollEl) scrollEl.removeEventListener('scroll', updateActiveDay);
    };
  }, [updateActiveDay, totalDays]);

  const onResizeStart = useCallback(() => {
    if (Platform.OS !== 'web') return;
    draggingRef.current = true;
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const container = document.querySelector('[data-split-row]') as HTMLElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = Math.min(75, Math.max(25, ((e.clientX - rect.left) / rect.width) * 100));
      setSplitPct(pct);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Build day plan with overrides applied
  const dayPlan = useMemo(() => {
    const suggested = suggestOvernightTowns(totalDays);
    const start = TRAIL_TOWNS[0];
    const finish: TrailTown = { ...start, kmMarker: TOTAL_KM, name: 'Campiglia Marittima (Finish)', notes: 'Finish' };

    // Apply overrides to overnight stops
    const stops = suggested.map((town, i) => townOverrides[i + 1] ?? town);
    const all = [start, ...stops, finish];

    return all.slice(0, -1).map((from, i) => ({
      dayNumber: i + 1,
      from,
      to: all[i + 1],
      distanceKm: Math.round(all[i + 1].kmMarker - from.kmMarker),
    }));
  }, [totalDays, townOverrides]);

  // Hotel availability — depends on dayPlan so must come after it
  const hotelResults = useHotels(dayPlan, startDate, dayRadii);

  function handleMarkerDrag(dayNumber: number, coord: [number, number]) {
    const [lng, lat] = coord;

    // Find km bounds: the dragged stop must stay between its neighbouring stops
    const dayIdx = dayNumber - 1;
    const prevKm = dayPlan[dayIdx]?.from.kmMarker ?? 0;
    const nextKm = dayIdx + 1 < dayPlan.length
      ? dayPlan[dayIdx + 1]?.to.kmMarker ?? TOTAL_KM
      : TOTAL_KM;

    // Find nearest trail town with accommodation within the valid km range
    const candidates = TRAIL_TOWNS
      .filter((t) => t.hasAccommodation && t.kmMarker > prevKm && t.kmMarker < nextKm);

    if (candidates.length === 0) return;

    const nearest = candidates.reduce((best, town) => {
      const d = Math.sqrt((town.coord.lat - lat) ** 2 + (town.coord.lng - lng) ** 2);
      const bd = Math.sqrt((best.coord.lat - lat) ** 2 + (best.coord.lng - lng) ** 2);
      return d < bd ? town : best;
    });

    setTownOverrides((prev) => ({ ...prev, [dayNumber]: nearest }));
  }

  function clearOverride(dayNumber: number) {
    setTownOverrides((prev) => { const next = { ...prev }; delete next[dayNumber]; return next; });
  }

  function handleGenerate() {
    setIsLoading(true);
    try {
      const [year, month, day] = startDate.split('-').map(Number);
      const [hour, min]        = startTime.split(':').map(Number);
      const startDT            = new Date(year, month - 1, day, hour, min);
      const mockPoints         = generateMockGPXPoints(454);
      setStages(calculateStages(startDT, totalDays, mockPoints));
    } finally {
      setIsLoading(false);
    }
  }

  // Save current itinerary to Firestore
  const handleSave = useCallback(async () => {
    if (!user) { router.push('/sign-in'); return; }
    const payload = {
      name: planName.trim() || `${totalDays}-day · ${startDate}`,
      startDate,
      startTime,
      totalDays,
      units,
      townOverrides: Object.fromEntries(
        Object.entries(townOverrides).map(([k, t]) => [k, { name: t.name, kmMarker: t.kmMarker, coord: t.coord }])
      ),
    };
    if (loadedItinId) {
      await updateItinerary(loadedItinId, payload);
    } else {
      const newId = await saveItinerary(payload);
      if (newId) setLoadedItinId(newId);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  }, [user, totalDays, startDate, startTime, units, townOverrides, loadedItinId, saveItinerary, updateItinerary, router]);

  // Load a saved itinerary into current state
  const handleLoad = useCallback((itin: SavedItinerary) => {
    setStartDate(itin.startDate);
    setStartTime(itin.startTime);
    setTotalDays(itin.totalDays);
    setUnits(itin.units);
    // Restore town overrides — map back to TrailTown shape
    const overrides: Record<number, TrailTown> = {};
    Object.entries(itin.townOverrides).forEach(([dayStr, t]) => {
      const match = TRAIL_TOWNS.find((tt) => tt.name === t.name) ?? {
        name: t.name, kmMarker: t.kmMarker, coord: t.coord,
        region: '', hasAccommodation: true, notes: '',
      };
      overrides[parseInt(dayStr)] = match;
    });
    setTownOverrides(overrides);
    setLoadedItinId(itin.id);
    setPlanName(itin.name);
    setShowLoadModal(false);
  }, []);

  const lateStart = parseInt(startTime.split(':')[0]) >= 12;
  const activeColor = DAY_COLORS[TOTAL_DAYS_OPTIONS.indexOf(totalDays)] ?? '#39FF14';

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* ── Top bar (header + controls) ── */}
      <View style={styles.topBar}>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <TextInput
              style={styles.planNameInput}
              value={planName}
              onChangeText={setPlanName}
              placeholder="Name your plan…"
              placeholderTextColor="#4B5563"
              selectTextOnFocus
            />
            <Text style={styles.sub}>Tuscany Trail 2026 · {units === 'metric' ? '454 km · +5,649 m' : '282.1 mi · +18,534 ft'}</Text>
          </View>

          <View style={styles.headerRight}>
            {/* New plan button */}
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => {
                setPlanName('My Ride Plan');
                setLoadedItinId(null);
                setTownOverrides({});
                setStartDate('2026-05-20');
                setStartTime('07:00');
                setTotalDays(4);
                setStages([]);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.headerActionTxt}>＋ New</Text>
            </TouchableOpacity>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.headerActionBtn, saveSuccess && { borderColor: '#39FF14' }]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator size="small" color="#39FF14" />
                : <Text style={[styles.headerActionTxt, saveSuccess && { color: '#39FF14' }]}>
                    {saveSuccess ? '✓ Saved' : '💾 Save'}
                  </Text>
              }
            </TouchableOpacity>

            {/* Load button */}
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => user ? setShowLoadModal(true) : router.push('/sign-in')}
              activeOpacity={0.8}
            >
              <Text style={styles.headerActionTxt}>📂 Load</Text>
            </TouchableOpacity>

            {/* User avatar / sign-in */}
            {user ? (
              <TouchableOpacity style={styles.avatarBtn} onPress={signOut} activeOpacity={0.8}>
                <Text style={styles.avatarTxt}>{(user.displayName ?? user.email ?? '?')[0].toUpperCase()}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/sign-in')} activeOpacity={0.8}>
                <Text style={styles.signInTxt}>Sign In</Text>
              </TouchableOpacity>
            )}

            <View style={[styles.avgChip, { borderColor: activeColor }]}>
              <Text style={[styles.avgChipNum, { color: activeColor }]}>{KM_PER_DAY[totalDays][units]}</Text>
              <Text style={styles.avgChipUnit}>{distUnit(units)}/day</Text>
            </View>
          </View>
        </View>

        {/* ── Controls bar ── */}
        <View style={styles.controlsBar}>
          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Days</Text>
            <DaysDropdown
              value={totalDays}
              onChange={(d) => { setTotalDays(d); setStages([]); setTownOverrides({}); }}
            />
          </View>

          <View style={styles.controlDivider} />

          <View style={[styles.controlItem, { flex: 1 }]}>
            <Text style={styles.controlLabel}>Start Date</Text>
            <TextInput
              style={styles.controlInput}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#4B5563"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.controlDivider} />

          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Depart</Text>
            <TextInput
              style={[styles.controlInput, { width: 60, textAlign: 'center' }]}
              value={startTime}
              onChangeText={setStartTime}
              placeholder="HH:MM"
              placeholderTextColor="#4B5563"
            />
          </View>

          <View style={styles.controlDivider} />

          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>{units === 'metric' ? 'Km' : 'Mi'} marks</Text>
            <KmIntervalPicker value={kmInterval} onChange={setKmInterval} units={units} />
          </View>

          <View style={styles.controlDivider} />

          <View style={styles.controlItem}>
            <Text style={styles.controlLabel}>Units</Text>
            <UnitToggle value={units} onChange={setUnits} />
          </View>
        </View>

        {lateStart && (
          <View style={styles.callout}>
            <Text style={styles.calloutTxt}>
              ⚡ Late start — Day 1 shortened, km redistributed automatically.
            </Text>
          </View>
        )}
      </View>

      {/* ── Map + Riding Plan side by side ── */}
      <View style={styles.splitRow} {...(Platform.OS === 'web' ? { 'data-split-row': true } as any : {})}>
        {/* Left: Map */}
        <View style={[styles.splitLeft, Platform.OS === 'web' && { width: `${splitPct}%` } as any]}>
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              logoEnabled={false}
              attributionEnabled={false}
              kmInterval={kmInterval}
              daySegments={dayPlan.map((day, i) => ({
                startKm: day.from.kmMarker,
                endKm: day.to.kmMarker,
                color: DAY_COLORS[i] ?? '#39FF14',
              }))}
              hoverKm={hoverKm}
              hotelRoute={selectedHotel ? {
                from: selectedHotel.townCoord,
                to: selectedHotel.coord,
                name: selectedHotel.name,
              } : null}
              activeSegment={activeDay != null ? {
                startKm: dayPlan[activeDay - 1]?.from.kmMarker ?? 0,
                endKm: dayPlan[activeDay - 1]?.to.kmMarker ?? 0,
                color: DAY_COLORS[activeDay - 1] ?? '#39FF14',
              } : undefined}
            >
              <Camera
                centerCoordinate={[11.13, 43.10]}
                zoomLevel={7.2}
                animationMode="none"
              />
              <MarkerView coordinate={[10.604386, 43.029945]}>
                <View style={styles.markerStart}>
                  <Text style={styles.markerStartTxt}>Start</Text>
                </View>
              </MarkerView>
              {dayPlan.map((day, i) => {
                if (day.to.kmMarker >= TOTAL_KM) return null;
                return (
                  <MarkerView
                    key={`${day.dayNumber}-${day.to.kmMarker}`}
                    coordinate={[day.to.coord.lng, day.to.coord.lat]}
                    draggable
                    onDragEnd={(coord: [number, number]) => handleMarkerDrag(day.dayNumber, coord)}
                  >
                    <View style={[styles.markerPin, { backgroundColor: DAY_COLORS[i] ?? '#39FF14' }]}>
                      <Text style={styles.markerPinTxt}>D{day.dayNumber}</Text>
                    </View>
                  </MarkerView>
                );
              })}
            </MapView>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={styles.mapResetBtn}
                onPress={() => window.dispatchEvent(new Event('map-reset'))}
                activeOpacity={0.7}
              >
                <Text style={styles.mapResetTxt}>Reset</Text>
              </TouchableOpacity>
            )}
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FFB800' }]} />
                <Text style={styles.legendTxt}>Start / Finish</Text>
              </View>
              {dayPlan.map((day, i) => (
                <View key={day.dayNumber} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: DAY_COLORS[i] ?? '#39FF14' }]} />
                  <Text style={styles.legendTxt}>{day.to.name}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Resize handle (web only) */}
        {Platform.OS === 'web' && (
          <View style={styles.resizeHandle} onTouchStart={undefined}>
            {React.createElement('div', {
              onMouseDown: onResizeStart,
              style: {
                width: '100%', height: '100%', cursor: 'col-resize',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              },
              onMouseEnter: (e: any) => { e.currentTarget.parentElement.style.backgroundColor = '#39FF14'; },
              onMouseLeave: (e: any) => { e.currentTarget.parentElement.style.backgroundColor = '#1E3322'; },
            }, React.createElement('div', {
              style: { width: 2, height: 40, backgroundColor: '#4B5563', borderRadius: 1 },
            }))}
          </View>
        )}

        {/* Right: Riding Plan (scrollable) */}
        <ScrollView
          ref={scrollRef}
          style={[styles.splitRight, Platform.OS === 'web' && { width: `${100 - splitPct}%` } as any]}
          contentContainerStyle={{ padding: 8, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={100}
        >
          <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Riding Plan</Text>

          <View style={styles.timeline}>
            {/* Start: Campiglia Marittima */}
            <View style={styles.timelineItem}>
              <View style={styles.track}>
                <View style={[styles.trackDot, { backgroundColor: '#FFB800' }]}>
                  <Text style={styles.trackDotTxt}>S</Text>
                  </View>
                  <View style={styles.trackStem} />
                </View>
                <View style={[styles.stopCard, { borderLeftColor: '#FFB800' }]}>
                  <View style={styles.stopCardContent}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stopName}>Campiglia Marittima</Text>
                      <Text style={styles.stopMeta}>Start · {fmtDate(startDate)} · {startTime}</Text>
                    </View>
                    <View style={styles.kmPill}>
                      <Text style={styles.kmPillTxt}>0</Text>
                      <Text style={styles.kmPillUnit}>{distUnit(units)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {dayPlan.map((day, i) => {
                const isOverridden = !!townOverrides[day.dayNumber];
                const suggested    = suggestOvernightTowns(totalDays)[i];
                const color        = DAY_COLORS[i] ?? '#39FF14';
                const isLast       = i === dayPlan.length - 1;

                return (
                  <View
                    key={day.dayNumber}
                    style={styles.timelineItem}
                    ref={(el: any) => {
                      if (el) {
                        const node = el as unknown as HTMLElement;
                        node.setAttribute('data-day', String(day.dayNumber));
                        dayCardRefs.current[day.dayNumber] = node;
                      }
                    }}
                  >
                    <View style={styles.track}>
                      <View style={[styles.trackDot, { backgroundColor: color }]}>
                        <Text style={styles.trackDotTxt}>D{day.dayNumber}</Text>
                      </View>
                      {!isLast && <View style={styles.trackStem} />}
                    </View>

                    <View style={[
                      styles.stopCard,
                      { borderLeftColor: color },
                      isOverridden && styles.stopCardOverride,
                    ]}>
                      {/* Elevation profile */}
                      <ElevationProfile
                        startKm={day.from.kmMarker}
                        endKm={day.to.kmMarker}
                        color={color}
                        height={48}
                        units={units}
                      />
                      <View style={styles.stopCardContent}>
                        <View style={{ flex: 1 }}>
                          {isOverridden && (
                            <View style={styles.stopNameRow}>
                              <TouchableOpacity
                                style={styles.overrideBadge}
                                onPress={() => clearOverride(day.dayNumber)}
                              >
                                <Text style={styles.overrideBadgeTxt}>✕ reset</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                          <Text style={styles.stopMeta}>
                            {fmtDayDate(startDate, day.dayNumber)} · {fmtDist(day.distanceKm, units)} from {day.from.name}
                          </Text>
                          {isOverridden && suggested
                            ? <Text style={styles.stopNote}>Suggested: {suggested.name}</Text>
                            : null
                          }
                          {!isOverridden && day.to.notes
                            ? <Text style={styles.stopNote}>{day.to.notes}</Text>
                            : null
                          }
                        </View>
                        <View style={styles.kmPill}>
                          <Text style={styles.kmPillTxt}>{distVal(day.to.kmMarker, units)}</Text>
                          <Text style={styles.kmPillUnit}>{distUnit(units)}</Text>
                        </View>
                      </View>

                      {/* Hotel availability */}
                      <HotelAvailabilitySection
                        result={hotelResults[day.dayNumber] ?? { status: 'idle', hotels: [] }}
                        checkIn={checkInForDay(startDate, day.dayNumber)}
                        color={color}
                        expanded={expandedHotelDays.has(day.dayNumber)}
                        onToggle={() => setExpandedHotelDays((prev) => {
                          const next = new Set(prev);
                          next.has(day.dayNumber) ? next.delete(day.dayNumber) : next.add(day.dayNumber);
                          return next;
                        })}
                        radiusKm={dayRadii[day.dayNumber] ?? 5}
                        onRadiusChange={(r: number) => setDayRadii((prev) => ({ ...prev, [day.dayNumber]: r }))}
                        selectedHotelCode={selectedHotel?.hotelCode ?? null}
                        onSelectHotel={(hotel: HotelAvailability | null) => {
                          if (!hotel) { setSelectedHotel(null); return; }
                          setSelectedHotel({
                            hotelCode: hotel.hotelCode,
                            name: hotel.name,
                            coord: hotel.coord,
                            townCoord: day.to.coord,
                          });
                        }}
                      />
                    </View>
                  </View>
                );
              })}

              {/* Finish */}
              <View style={styles.timelineItem}>
                <View style={styles.track}>
                  <View style={[styles.trackDot, styles.trackDotFinish]}>
                    <Text style={styles.trackDotTxt}>🏁</Text>
                  </View>
                </View>
                <View style={[styles.stopCard, { borderLeftColor: '#FFB800' }]}>
                  <View style={styles.stopCardContent}>
                    <View>
                      <Text style={styles.stopName}>Campiglia Marittima</Text>
                      <Text style={styles.stopMeta}>Finish · {fmtFinishDate(startDate, totalDays)} · {units === 'metric' ? '454 km' : '282.1 mi'}</Text>
                    </View>
                    <View style={styles.kmPill}>
                      <Text style={styles.kmPillTxt}>{units === 'metric' ? 454 : 282}</Text>
                      <Text style={styles.kmPillUnit}>{distUnit(units)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

          {/* ── Generate ── */}
          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} activeOpacity={0.85}>
            <Text style={styles.generateTxt}>{isLoading ? 'Calculating…' : 'Generate Full Breakdown'}</Text>
          </TouchableOpacity>

          {stages.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={styles.sectionTitle}>{stages.length} Stages</Text>
              {stages.map((s) => <StageCard key={s.dayNumber} stage={s} isToday={false} />)}
            </View>
          )}
        </ScrollView>
      </View>

      {/* ── Load Itinerary Modal ── */}
      <Modal
        visible={showLoadModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLoadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Saved Itineraries</Text>
              <TouchableOpacity onPress={() => setShowLoadModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingList ? (
              <ActivityIndicator color="#39FF14" style={{ marginVertical: 24 }} />
            ) : itineraries.length === 0 ? (
              <Text style={styles.modalEmpty}>No saved itineraries yet.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {itineraries.map((itin) => (
                  <View key={itin.id} style={styles.itinRow}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => handleLoad(itin)}>
                      <Text style={styles.itinName}>{itin.name}</Text>
                      <Text style={styles.itinMeta}>
                        {itin.totalDays} days · {itin.startDate} · {itin.units}
                      </Text>
                      <Text style={styles.itinDate}>
                        Saved {new Date(itin.savedAt).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.itinDeleteBtn}
                      onPress={() => {
                        deleteItinerary(itin.id);
                        if (itin.id === loadedItinId) setLoadedItinId(null);
                      }}
                    >
                      <Text style={styles.itinDeleteTxt}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ── Sub-components ── */

const KM_INTERVAL_OPTIONS = [0, 5, 10, 15, 20, 25];

function KmIntervalPicker({ value, onChange, units = 'metric' }: { value: number; onChange: (v: number) => void; units?: Units }) {
  const u = units === 'metric' ? 'km' : 'mi';
  const label = (v: number) => {
    if (v === 0) return 'Off';
    return units === 'metric' ? `${v} km` : `${Math.round(v * 0.621371)} mi`;
  };
  if (Platform.OS === 'web') {
    return React.createElement('select', {
      value,
      onChange: (e: any) => onChange(parseInt(e.target.value)),
      style: {
        backgroundColor: 'transparent',
        border: 'none',
        color: '#9CA3AF',
        fontSize: 13,
        fontWeight: '600',
        outline: 'none',
        cursor: 'pointer',
        appearance: 'auto',
        paddingRight: 4,
      } as React.CSSProperties,
    }, ...KM_INTERVAL_OPTIONS.map((v) =>
      React.createElement('option', { key: v, value: v }, label(v))
    ));
  }
  const idx = KM_INTERVAL_OPTIONS.indexOf(value);
  return (
    <TouchableOpacity onPress={() => onChange(KM_INTERVAL_OPTIONS[(idx + 1) % KM_INTERVAL_OPTIONS.length])}>
      <Text style={{ color: '#9CA3AF', fontSize: 13, fontWeight: '600' }}>{label(value)} ▾</Text>
    </TouchableOpacity>
  );
}

function UnitToggle({ value, onChange }: { value: Units; onChange: (u: Units) => void }) {
  const isMetric = value === 'metric';
  return (
    <TouchableOpacity
      onPress={() => onChange(isMetric ? 'imperial' : 'metric')}
      style={styles2.unitBtn}
    >
      <Text style={[styles2.unitTxt, isMetric && styles2.unitActive]}>km</Text>
      <Text style={styles2.unitSep}>/</Text>
      <Text style={[styles2.unitTxt, !isMetric && styles2.unitActive]}>mi</Text>
    </TouchableOpacity>
  );
}

const styles2 = StyleSheet.create({
  unitBtn:    { flexDirection: 'row', alignItems: 'center' },
  unitTxt:    { color: '#4B5563', fontSize: 13, fontWeight: '600' },
  unitActive: { color: '#F5F5F5', fontWeight: '800' },
  unitSep:    { color: '#4B5563', fontSize: 13, marginHorizontal: 2 },
});

function DaysDropdown({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  const activeColor = DAY_COLORS[TOTAL_DAYS_OPTIONS.indexOf(value)] ?? '#39FF14';
  if (Platform.OS === 'web') {
    return React.createElement('select', {
      value,
      onChange: (e: any) => onChange(parseInt(e.target.value)),
      style: {
        backgroundColor: 'transparent',
        border: 'none',
        color: activeColor,
        fontSize: 15,
        fontWeight: '800',
        outline: 'none',
        cursor: 'pointer',
        appearance: 'auto',
        paddingRight: 8,
      } as React.CSSProperties,
    }, ...TOTAL_DAYS_OPTIONS.map((d) =>
      React.createElement('option', { key: d, value: d }, `${d} days`)
    ));
  }
  const idx = TOTAL_DAYS_OPTIONS.indexOf(value);
  return (
    <TouchableOpacity
      onPress={() => onChange(TOTAL_DAYS_OPTIONS[(idx + 1) % TOTAL_DAYS_OPTIONS.length])}
    >
      <Text style={{ color: activeColor, fontSize: 15, fontWeight: '800' }}>{value} days ▾</Text>
    </TouchableOpacity>
  );
}

function generateMockGPXPoints(totalKm: number) {
  const points = [];
  for (let km = 0; km <= totalKm; km += 0.5) {
    points.push({
      lat: 43.06 + (km / totalKm) * 0.8,
      lng: 10.61 + (km / totalKm) * 1.2,
      elevationM: 200 + Math.sin(km / 15) * 180 + Math.sin(km / 5) * 60,
      cumulativeKm: km,
    });
  }
  return points;
}

/* ── Styles ── */

const styles = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: '#0D1B0F' },
  content:       { padding: 16, paddingBottom: 48 }, // used by native fallback

  // Header
  headerRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  heading:       { color: '#39FF14', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  planNameInput: { color: '#39FF14', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, padding: 0, borderBottomWidth: 1, borderBottomColor: '#1E3322' } as any,
  sub:           { color: '#6B7280', fontSize: 13, marginTop: 2 },
  avgChip:       { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  avgChipNum:    { fontSize: 18, fontWeight: '800' },
  avgChipUnit:   { color: '#6B7280', fontSize: 9, fontWeight: '600', marginTop: -1 },

  // Controls bar
  controlsBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111D13', borderRadius: 12, borderWidth: 1, borderColor: '#1E3322', paddingHorizontal: 12, paddingVertical: 8, gap: 10, marginBottom: 10 },
  controlItem:   { gap: 2 },
  controlLabel:  { color: '#4B5563', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  controlInput:  { color: '#F5F5F5', fontSize: 14, fontWeight: '600', paddingVertical: 2 },
  controlDivider:{ width: 1, height: 28, backgroundColor: '#1E3322' },

  callout:       { backgroundColor: '#1A2E1A', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#FFB800', padding: 10, marginBottom: 10 },
  calloutTxt:    { color: '#FFB800', fontSize: 12, lineHeight: 17 },

  // Top bar
  topBar:        { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },

  // Split layout
  splitRow:      { flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column', overflow: 'hidden' } as any,
  splitLeft:     { ...(Platform.OS === 'web' ? { flexShrink: 0, padding: 8 } : {}), overflow: 'hidden' } as any,
  splitRight:    { ...(Platform.OS === 'web' ? { flexShrink: 0 } : { flex: 1 }) } as any,
  resizeHandle:  { width: 6, backgroundColor: '#1E3322', flexShrink: 0 } as any,

  // Map
  mapWrapper:    { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#1E3322', flex: 1 } as any,
  map:           { flex: 1, minHeight: 300, width: '100%' } as any,
  mapResetBtn:   { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(13,27,15,0.85)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#1E3322', zIndex: 1000 },
  mapResetTxt:   { color: '#9CA3AF', fontSize: 10, fontWeight: '600' },
  mapLegend:     { backgroundColor: '#111D13', paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:     { width: 7, height: 7, borderRadius: 4 },
  legendTxt:     { color: '#6B7280', fontSize: 10 },

  // Map markers
  markerPin:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  markerPinTxt:  { color: '#0D1B0F', fontSize: 11, fontWeight: '900' },
  markerStart:   { backgroundColor: '#FFB800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 2, borderColor: '#0D1B0F' },
  markerStartTxt:{ color: '#0D1B0F', fontSize: 10, fontWeight: '900' },

  // Section title
  sectionTitle:  { color: '#F5F5F5', fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 10 },

  // Timeline
  timeline:      { gap: 0 },
  timelineItem:  { flexDirection: 'row', alignItems: 'stretch' },
  track:         { width: 36, alignItems: 'center', paddingTop: 12 },
  trackDot:      { width: 32, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  trackDotFinish:{ backgroundColor: '#FFB800' },
  trackDotTxt:   { color: '#0D1B0F', fontSize: 9, fontWeight: '900' },
  trackStem:     { width: 2, flex: 1, backgroundColor: '#1E3322', marginVertical: -2 },

  // Stop card
  stopCard:      { flex: 1, backgroundColor: '#111D13', borderRadius: 12, borderWidth: 1, borderColor: '#1A2A1D', borderLeftWidth: 3, padding: 12, marginLeft: 8, marginBottom: 6 },
  stopCardOverride: { borderColor: '#00BFFF', borderLeftColor: '#00BFFF' },
  stopCardContent:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stopNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
  stopName:      { color: '#F5F5F5', fontSize: 14, fontWeight: '700' },
  stopMeta:      { color: '#6B7280', fontSize: 11, marginTop: 1 },
  stopNote:      { color: '#9CA3AF', fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  kmPill:        { alignItems: 'center', marginLeft: 10, flexShrink: 0 },
  kmPillTxt:     { color: '#39FF14', fontSize: 16, fontWeight: '800' },
  kmPillUnit:    { color: '#4B5563', fontSize: 9, fontWeight: '600', marginTop: -2 },

  // Override
  overrideBadge:    { backgroundColor: '#2A1010', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4 },
  overrideBadgeTxt: { color: '#FF6B6B', fontSize: 9, fontWeight: '700' },

  // Generate
  generateBtn:   { backgroundColor: '#39FF14', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12, marginBottom: 24 },
  generateTxt:   { color: '#0D1B0F', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  // Auth / Save-Load header controls
  headerRight:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerActionBtn:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#1E3322', backgroundColor: '#111D13' },
  headerActionTxt:  { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  avatarBtn:        { width: 30, height: 30, borderRadius: 15, backgroundColor: '#39FF14', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:        { color: '#0D1B0F', fontSize: 13, fontWeight: '900' },
  signInBtn:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#39FF14' },
  signInTxt:        { color: '#39FF14', fontSize: 12, fontWeight: '700' },

  // Load modal
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard:        { backgroundColor: '#111D13', borderRadius: 14, borderWidth: 1, borderColor: '#1E3322', width: '90%', maxWidth: 420, padding: 20 },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle:       { color: '#F5F5F5', fontSize: 16, fontWeight: '700' },
  modalClose:       { color: '#6B7280', fontSize: 18, paddingHorizontal: 4 },
  modalEmpty:       { color: '#6B7280', textAlign: 'center', paddingVertical: 24 },
  itinRow:          { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E3322', paddingVertical: 12 },
  itinName:         { color: '#E5E7EB', fontSize: 14, fontWeight: '700' },
  itinMeta:         { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  itinDate:         { color: '#4B5563', fontSize: 11, marginTop: 2 },
  itinDeleteBtn:    { padding: 8 },
  itinDeleteTxt:    { fontSize: 16 },
});
