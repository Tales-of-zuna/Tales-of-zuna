import type { Profile } from "../github.ts";
import type { Theme } from "../theme.ts";
import { document, escape, round } from "../svg.ts";

const WIDTH = 330;
const HEIGHT = 240;
const SWEEP_MS = 1200;
const GAP = 0.6; // percent of the circumference left blank between segments (~2px)

function truncate(name: string, max = 14): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function renderLanguages(profile: Profile, theme: Theme): string {
  const total = profile.languages.reduce((sum, l) => sum + l.size, 0) || 1;
  const top = profile.languages.slice(0, theme.series.length);
  const rest = profile.languages.slice(theme.series.length).reduce((sum, l) => sum + l.size, 0);
  const slices = top.map((l, i) => ({ name: l.name, pct: (l.size / total) * 100, color: theme.series[i]! }));
  if (rest > 0) slices.push({ name: "Other", pct: (rest / total) * 100, color: theme.other });

  const cx = 92;
  const cy = 136;
  const gap = slices.length > 1 ? GAP : 0;
  let start = 0;
  const keyframes: string[] = [];
  const arcs = slices.map((s, i) => {
    const length = Math.max(s.pct - gap, 0.1);
    const delay = (start / 100) * SWEEP_MS;
    const duration = Math.max((s.pct / 100) * SWEEP_MS, 1);
    keyframes.push(`@keyframes s${i} { from { stroke-dasharray: 0 100; } }`);
    const arc = `<circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="${s.color}" stroke-width="16" pathLength="100" stroke-dasharray="${round(length)} 100" stroke-dashoffset="${round(-start)}" transform="rotate(-90 ${cx} ${cy})" style="animation: s${i} ${Math.round(duration)}ms linear ${Math.round(200 + delay)}ms both"/>`;
    start += s.pct;
    return arc;
  });

  const legend = slices.map((s, i) => {
    const y = 74 + i * 26;
    return `<g class="fade-up" style="animation-delay:${300 + i * 90}ms">
  <circle cx="190" cy="${y - 4}" r="5" fill="${s.color}"/>
  <text x="203" y="${y}" font-size="12.5" class="secondary">${escape(truncate(s.name))}</text>
  <text x="${WIDTH - 22}" y="${y}" text-anchor="end" font-size="12.5" font-weight="600">${s.pct.toFixed(1)}%</text>
</g>`;
  });

  const body = `
<text x="22" y="34" class="heading">Most used languages</text>
<circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="${theme.grid}" stroke-width="16"/>
${arcs.join("\n")}
<g class="fade" style="animation-delay:500ms">
  <text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="22" font-weight="700">${profile.languages.length}</text>
  <text x="${cx}" y="${cy + 19}" text-anchor="middle" font-size="11" class="muted">languages</text>
</g>
${legend.join("\n")}`;

  return document({
    theme,
    width: WIDTH,
    height: HEIGHT,
    title: "Most used languages",
    description: slices.map((s) => `${s.name} ${s.pct.toFixed(1)}%`).join(", "),
    style: keyframes.join("\n"),
    body,
  });
}
