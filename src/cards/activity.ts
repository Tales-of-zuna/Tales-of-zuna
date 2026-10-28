import type { Profile } from "../github.ts";
import type { Theme } from "../theme.ts";
import { document, number, round, shortDate } from "../svg.ts";

const WIDTH = 900;
const HEIGHT = 280;
const DAYS = 90;
const PLOT = { left: 56, right: WIDTH - 28, top: 72, bottom: 236 };

type Point = { x: number; y: number };

function niceStep(max: number, ticks: number): number {
  const raw = Math.max(max, 1) / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].find((m) => m * magnitude >= raw)! * magnitude;
  return Math.max(step, 1);
}

/** Monotone cubic interpolation (Fritsch–Carlson): smooth, but never overshoots below zero. */
function monotonePath(pts: Point[]): string {
  const n = pts.length;
  if (n < 2) return pts.length ? `M${round(pts[0]!.x)},${round(pts[0]!.y)}` : "";
  const slopes = pts.slice(0, -1).map((p, i) => (pts[i + 1]!.y - p.y) / (pts[i + 1]!.x - p.x));
  const tangents = pts.map((_, i) => {
    if (i === 0) return slopes[0]!;
    if (i === n - 1) return slopes[n - 2]!;
    const a = slopes[i - 1]!;
    const b = slopes[i]!;
    return a * b <= 0 ? 0 : (a + b) / 2;
  });
  slopes.forEach((m, i) => {
    if (m === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      return;
    }
    const a = tangents[i]! / m;
    const b = tangents[i + 1]! / m;
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      tangents[i] = tau * a * m;
      tangents[i + 1] = tau * b * m;
    }
  });
  let d = `M${round(pts[0]!.x)},${round(pts[0]!.y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    const dx = (q.x - p.x) / 3;
    d += `C${round(p.x + dx)},${round(p.y + tangents[i]! * dx)} ${round(q.x - dx)},${round(q.y - tangents[i + 1]! * dx)} ${round(q.x)},${round(q.y)}`;
  }
  return d;
}

export function renderActivity(profile: Profile, theme: Theme): string {
  const days = profile.history.slice(-DAYS);
  const max = Math.max(0, ...days.map((d) => d.count));
  const step = niceStep(max, 4);
  const top = Math.max(step * Math.ceil(max / step), step);
  const x = (i: number) => PLOT.left + (i / Math.max(days.length - 1, 1)) * (PLOT.right - PLOT.left);
  const y = (v: number) => PLOT.bottom - (v / top) * (PLOT.bottom - PLOT.top);
  const pts = days.map((d, i) => ({ x: x(i), y: y(d.count) }));
  const line = monotonePath(pts);
  const area = `${line}L${round(x(days.length - 1))},${PLOT.bottom}L${round(x(0))},${PLOT.bottom}Z`;

  const grid: string[] = [];
  for (let v = 0; v <= top; v += step) {
    grid.push(`<line x1="${PLOT.left}" y1="${round(y(v))}" x2="${PLOT.right}" y2="${round(y(v))}" stroke="${theme.grid}"/>
<text x="${PLOT.left - 10}" y="${round(y(v) + 3.5)}" text-anchor="end" font-size="10.5" class="muted">${number(v)}</text>`);
  }
  const ticks = days.flatMap((d, i) =>
    (days.length - 1 - i) % 15 === 0
      ? [`<text x="${round(x(i))}" y="${PLOT.bottom + 20}" text-anchor="middle" font-size="10.5" class="muted">${shortDate(d.date)}</text>`]
      : [],
  );

  const total = days.reduce((sum, d) => sum + d.count, 0);
  const peakIndex = days.reduce((best, d, i) => (d.count > days[best]!.count ? i : best), 0);
  const peak = pts[peakIndex];
  const peakDay = days[peakIndex];
  const anchor = peak && peak.x > PLOT.right - 60 ? "end" : peak && peak.x < PLOT.left + 60 ? "start" : "middle";
  const marker =
    peak && peakDay && peakDay.count > 0
      ? `<g class="fade" style="animation-delay:1500ms">
  <circle cx="${round(peak.x)}" cy="${round(peak.y)}" r="4.5" fill="${theme.accent}" stroke="${theme.surface}" stroke-width="2"/>
  <text x="${round(peak.x)}" y="${round(peak.y - 12)}" text-anchor="${anchor}" font-size="11.5" font-weight="600">Peak ${number(peakDay.count)} · ${shortDate(peakDay.date)}</text>
</g>`
      : "";

  const body = `
<defs>
  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${theme.accent}" stop-opacity="0.32"/>
    <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
  </linearGradient>
</defs>
<g class="fade-up">
  <text x="24" y="38" class="heading">Daily contributions</text>
  <text x="${WIDTH - 28}" y="38" text-anchor="end" font-size="12.5" class="muted">Last ${days.length} days · ${number(total)} total · ${(total / Math.max(days.length, 1)).toFixed(1)} per day</text>
</g>
${grid.join("\n")}
${ticks.join("\n")}
<path class="area" d="${area}" fill="url(#area)"/>
<path class="line" d="${line}" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" pathLength="1" stroke-dasharray="1"/>
${marker}`;

  return document({
    theme,
    width: WIDTH,
    height: HEIGHT,
    title: "Daily contributions",
    description: `Contributions per day over the last ${days.length} days: ${number(total)} total, peak ${peakDay?.count ?? 0}.`,
    style: `
@keyframes draw { from { stroke-dashoffset: 1; } }
.line { animation: draw 1.6s cubic-bezier(.65,0,.35,1) .2s both; }
.area { animation: fade 1s ease-out 1s both; }`,
    body,
  });
}
