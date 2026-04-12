/**
 * ElevationProfile — SVG hill profile for a route segment.
 * Town names along the bottom, end-of-day town highlighted.
 * Hover shows crosshair with distance & cumulative elevation gain.
 */
import React, { useRef, useEffect, useId } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import ROUTE_POINTS from '@/data/route.json';
import { TRAIL_TOWNS } from '@/data/towns';

const ROUTE = ROUTE_POINTS as [number, number, number, number][]; // [lat, lng, distKm, elevM]

type Units = 'metric' | 'imperial';

interface Props {
  startKm: number;
  endKm: number;
  color?: string;
  height?: number;
  units?: Units;
}

/** Interpolate elevation at a given km along the route */
function elevAtKm(km: number): number {
  for (let i = 1; i < ROUTE.length; i++) {
    const [, , d0, e0] = ROUTE[i - 1];
    const [, , d1, e1] = ROUTE[i];
    if (km >= d0 && km <= d1) {
      const t = d1 === d0 ? 0 : (km - d0) / (d1 - d0);
      return e0 + t * (e1 - e0);
    }
  }
  return ROUTE[ROUTE.length - 1][3];
}

/** Cumulative elevation gain from startKm to targetKm */
function gainToKm(startKm: number, targetKm: number): number {
  const pts = ROUTE.filter(([, , km]) => km >= startKm && km <= targetKm);
  let g = 0;
  for (let i = 1; i < pts.length; i++) {
    const diff = pts[i][3] - pts[i - 1][3];
    if (diff > 0) g += diff;
  }
  return g;
}

export function ElevationProfile({ startKm, endKm, color = '#39FF14', height = 80, units = 'metric' }: Props) {
  const points = ROUTE.filter(([, , km]) => km >= startKm && km <= endKm);
  const containerRef = useRef<any>(null);
  if (points.length < 2) return null;

  const elevations = points.map((p) => p[3]);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const elevRange = maxElev - minElev || 1;
  const distRange = endKm - startKm || 1;

  // Chart area: leave 16px bottom for town labels
  const chartBottom = 16;
  const chartH = height - chartBottom;
  const topPad = 10;

  const vbW = 600;
  const vbH = height;

  const toX = (km: number) => ((km - startKm) / distRange) * vbW;
  const toY = (elev: number) => topPad + (chartH - topPad) - ((elev - minElev) / elevRange) * (chartH - topPad);

  // SVG profile path
  const svgPoints = points.map((p) => `${toX(p[2])},${toY(p[3])}`);
  const pathD = `M0,${chartH} L${svgPoints.join(' L')} L${vbW},${chartH} Z`;
  const lineD = `M${svgPoints.join(' L')}`;

  // Total elevation gain
  let totalGain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) totalGain += diff;
  }

  // Towns in range — include start town (from) and end town (to)
  const towns = TRAIL_TOWNS.filter(
    (t) => t.kmMarker >= startKm && t.kmMarker <= endKm
  );

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.label, { color }]}>+{Math.round(totalGain)}m</Text>
      </View>
    );
  }

  // Town markers: dot on profile line + vertical tick + name at bottom
  const townSvg = towns.map((t) => {
    const x = toX(t.kmMarker);
    const elev = elevAtKm(t.kmMarker);
    const y = toY(elev);
    const isEnd = t.kmMarker === endKm;
    const isStart = t.kmMarker === startKm;
    const isEndpoint = isEnd || isStart;
    const pct = (t.kmMarker - startKm) / distRange;

    let name = t.name;
    if (!isEndpoint && name.length > 14) name = name.slice(0, 12) + '…';

    const dotR = isEndpoint ? 3.5 : 2;
    const tickColor = isEndpoint ? color : '#4B5563';
    const tickW = isEndpoint ? 1.2 : 0.5;
    const tickDash = isEndpoint ? 'none' : '3 2';
    const tickOpacity = isEndpoint ? 0.7 : 0.35;

    // Bottom label — start and end towns share the same style
    const labelY = vbH - 2;
    const fontSize = isEndpoint ? 11 : 7;
    const fontWeight = isEndpoint ? '700' : '400';
    const labelColor = isEndpoint ? color : '#6B7280';
    // Start town anchored to left edge, end town anchored to right edge
    const anchor = isStart ? 'start' : isEnd ? 'end' : (pct > 0.85 ? 'end' : pct < 0.1 ? 'start' : 'middle');

    return `
      <line x1="${x}" y1="${y}" x2="${x}" y2="${chartH}" stroke="${tickColor}" stroke-width="${tickW}" stroke-dasharray="${tickDash}" opacity="${tickOpacity}"/>
      <circle cx="${x}" cy="${y}" r="${dotR}" fill="${color}"/>
      <text x="${x}" y="${labelY}" text-anchor="${anchor}" fill="${labelColor}" font-size="${fontSize}" font-weight="${fontWeight}" font-family="system-ui, sans-serif">${name}</text>
    `;
  }).join('');

  // Unique ID for hover elements (include units so script rebinds on change)
  const uid = `ep-${startKm}-${units}`;

  const svgHtml = `
    <svg id="${uid}" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="none"
         style="width:100%;height:100%;display:block;cursor:crosshair">
      <defs>
        <linearGradient id="eg-${startKm}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <path d="${pathD}" fill="url(#eg-${startKm})" />
      <path d="${lineD}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.65" />
      ${townSvg}
      <!-- Hover elements -->
      <line id="${uid}-vline" x1="0" y1="0" x2="0" y2="${chartH}" stroke="#F5F5F5" stroke-width="0.8" opacity="0" stroke-dasharray="4 3"/>
      <circle id="${uid}-dot" cx="0" cy="0" r="3" fill="${color}" opacity="0"/>
      <rect id="${uid}-bg" x="0" y="0" width="110" height="30" rx="4" fill="#0D1B0F" stroke="#1E3322" stroke-width="0.8" opacity="0"/>
      <text id="${uid}-txt1" x="0" y="0" fill="#F5F5F5" font-size="8.5" font-weight="600" font-family="system-ui, sans-serif" opacity="0"></text>
      <text id="${uid}-txt2" x="0" y="0" fill="${color}" font-size="8.5" font-weight="700" font-family="system-ui, sans-serif" opacity="0"></text>
    </svg>`;

  // Hover script: compute km & gain from mouse position
  const hoverScript = `
    (function() {
      var svg = document.getElementById('${uid}');
      if (!svg || svg._hoverBound) return;
      svg._hoverBound = true;
      var vline = document.getElementById('${uid}-vline');
      var dot = document.getElementById('${uid}-dot');
      var bg = document.getElementById('${uid}-bg');
      var txt1 = document.getElementById('${uid}-txt1');
      var txt2 = document.getElementById('${uid}-txt2');
      var startKm = ${startKm}, endKm = ${endKm}, distRange = ${distRange};
      var vbW = ${vbW}, chartH = ${chartH}, topPad = ${topPad};
      var minElev = ${minElev}, elevRange = ${elevRange};
      var isImperial = ${units === 'imperial'};
      var routeData = ${JSON.stringify(points.map(p => [p[2], p[3]]))};

      function elevAt(km) {
        for (var i = 1; i < routeData.length; i++) {
          if (km >= routeData[i-1][0] && km <= routeData[i][0]) {
            var t = (routeData[i][0] - routeData[i-1][0]) === 0 ? 0 : (km - routeData[i-1][0]) / (routeData[i][0] - routeData[i-1][0]);
            return routeData[i-1][1] + t * (routeData[i][1] - routeData[i-1][1]);
          }
        }
        return routeData[routeData.length-1][1];
      }

      function gainTo(km) {
        var g = 0;
        for (var i = 1; i < routeData.length; i++) {
          if (routeData[i][0] > km) break;
          var d = routeData[i][1] - routeData[i-1][1];
          if (d > 0) g += d;
        }
        return g;
      }

      function toY(elev) {
        return topPad + (chartH - topPad) - ((elev - minElev) / elevRange) * (chartH - topPad);
      }

      function fmtD(km) { return isImperial ? Math.round(km * 0.621371) + ' mi' : Math.round(km) + ' km'; }
      function fmtG(m) { return isImperial ? '+' + Math.round(m * 3.28084) + ' ft' : '+' + Math.round(m) + ' m'; }

      svg.addEventListener('mousemove', function(e) {
        var rect = svg.getBoundingClientRect();
        var pct = (e.clientX - rect.left) / rect.width;
        var km = startKm + pct * distRange;
        if (km < startKm) km = startKm;
        if (km > endKm) km = endKm;
        var x = pct * vbW;
        var elev = elevAt(km);
        var y = toY(elev);
        var g = gainTo(km);
        var dayDist = km - startKm;

        vline.setAttribute('x1', x); vline.setAttribute('x2', x); vline.setAttribute('opacity', '0.5');
        dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('opacity', '1');

        var label1 = fmtD(dayDist);
        var label2 = fmtG(g);
        var tx = x + 8;
        var flipLeft = pct > 0.75;
        if (flipLeft) tx = x - 118;
        bg.setAttribute('x', tx); bg.setAttribute('y', y - 18); bg.setAttribute('opacity', '0.9');
        txt1.setAttribute('x', tx + 6); txt1.setAttribute('y', y - 5);
        txt1.textContent = label1;
        txt1.setAttribute('opacity', '1');
        txt2.setAttribute('x', tx + 60); txt2.setAttribute('y', y - 5);
        txt2.textContent = label2;
        txt2.setAttribute('opacity', '1');
        window.dispatchEvent(new CustomEvent('elevation-hover', { detail: { km: km } }));
      });

      svg.addEventListener('mouseleave', function() {
        vline.setAttribute('opacity', '0');
        dot.setAttribute('opacity', '0');
        bg.setAttribute('opacity', '0');
        txt1.setAttribute('opacity', '0');
        txt2.setAttribute('opacity', '0');
        window.dispatchEvent(new CustomEvent('elevation-hover', { detail: null }));
      });
    })();`;

  // Use useEffect to run hover script after mount
  const wrapperRef = useRef<any>(null);

  useEffect(() => {
    if (wrapperRef.current) {
      const scriptEl = document.createElement('script');
      scriptEl.textContent = hoverScript;
      document.body.appendChild(scriptEl);
      return () => { scriptEl.remove(); };
    }
  });

  return (
    <View style={[styles.container, { height }]}>
      {React.createElement('div', {
        ref: wrapperRef,
        dangerouslySetInnerHTML: { __html: svgHtml },
        style: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
      })}
      <View style={[styles.labels, { bottom: chartBottom + 2 }]}>
        <Text style={styles.elevLabel}>{units === 'metric' ? `${Math.round(minElev)}m` : `${Math.round(minElev * 3.28084)}ft`}</Text>
        <Text style={[styles.gainLabel, { color }]}>{units === 'metric' ? `+${Math.round(totalGain)}m` : `+${Math.round(totalGain * 3.28084)}ft`}</Text>
        <Text style={styles.elevLabel}>{units === 'metric' ? `${Math.round(maxElev)}m` : `${Math.round(maxElev * 3.28084)}ft`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', position: 'relative', overflow: 'hidden', borderRadius: 6 },
  labels: { position: 'absolute', left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  elevLabel: { color: '#4B5563', fontSize: 8, fontWeight: '600' },
  gainLabel: { fontSize: 9, fontWeight: '700' },
  label: { fontSize: 10, fontWeight: '700', padding: 4 },
});
