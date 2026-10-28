import type { Theme } from "./theme.ts";

export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";

export const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const number = (n: number) => n.toLocaleString("en-US");

export const round = (n: number) => Math.round(n * 100) / 100;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const parseDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const monthName = (iso: string) => MONTHS[parseDate(iso).getUTCMonth()]!;

export function shortDate(iso: string, withYear = false): string {
  const d = parseDate(iso);
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${base}, ${d.getUTCFullYear()}` : base;
}

export function dateRange(start: string | null, end: string | null): string {
  if (!start || !end) return "No activity yet";
  if (start === end) return shortDate(start, true);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${shortDate(start, !sameYear)} – ${shortDate(end, true)}`;
}

function channels(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function mix(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return `#${ca
    .map((c, i) => Math.round(c + (cb[i]! - c) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Continuous lookup into a ramp, t in [0, 1]. */
export function rampAt(ramp: string[], t: number): string {
  const x = Math.min(Math.max(t, 0), 1) * (ramp.length - 1);
  const i = Math.min(Math.floor(x), ramp.length - 2);
  return mix(ramp[i]!, ramp[i + 1]!, x - i);
}

/**
 * Places rendered cards side by side in one SVG so the row scales as a unit
 * instead of wrapping when the README column is narrower than the cards.
 */
export function row(title: string, gap: number, cards: string[]): string {
  const sizes = cards.map((svg) => {
    const match = /<svg[^>]*\swidth="([\d.]+)"\s+height="([\d.]+)"/.exec(svg);
    if (!match) throw new Error("row() expects cards rendered by document()");
    return { width: Number(match[1]), height: Number(match[2]) };
  });
  const width = sizes.reduce((sum, s) => sum + s.width, 0) + gap * (cards.length - 1);
  const height = Math.max(...sizes.map((s) => s.height));
  let x = 0;
  const placed = cards.map((svg, i) => {
    const g = `<g transform="translate(${x} 0)">${svg}</g>`;
    x += sizes[i]!.width + gap;
    return g;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(title)}">
${placed.join("\n")}
</svg>
`;
}

/** Wraps card content in a themed, accessible SVG document with a rounded surface. */
export function document(opts: {
  theme: Theme;
  width: number;
  height: number;
  title: string;
  description: string;
  style: string;
  body: string;
}): string {
  const { theme, width, height } = opts;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escape(opts.title)}</title>
<desc id="desc">${escape(opts.description)}</desc>
<style>
text { font-family: ${FONT}; fill: ${theme.textPrimary}; }
.secondary { fill: ${theme.textSecondary}; }
.muted { fill: ${theme.textMuted}; }
.heading { font-size: 15px; font-weight: 600; }
@keyframes fade-up { from { opacity: 0; transform: translateY(6px); } }
@keyframes fade { from { opacity: 0; } }
.fade-up { animation: fade-up .6s ease-out both; }
.fade { animation: fade .8s ease-out both; }
${opts.style}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
</style>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="${theme.surface}" stroke="${theme.border}"/>
${opts.body}
</svg>
`;
}
