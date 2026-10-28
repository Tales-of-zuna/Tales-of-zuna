import type { Day, Profile } from "../github.ts";
import type { Theme } from "../theme.ts";
import { document, mix, monthName, number, parseDate, rampAt, round, shortDate } from "../svg.ts";

const WIDTH = 900;
const HEIGHT = 460;
// Isometric basis: one week steps right-down, one weekday steps left-down.
const WEEK = { x: 14, y: 5.6 };
const DAY = { x: -14, y: 5.6 };
const ORIGIN = { x: 128, y: 104 };
const MAX_HEIGHT = 80;
const INSET = 0.1; // gap around each tower, as a fraction of a cell
const WAVE_MS = 16; // animation delay per diagonal step
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Point = { x: number; y: number };

const project = (w: number, d: number): Point => ({
  x: ORIGIN.x + w * WEEK.x + d * DAY.x,
  y: ORIGIN.y + w * WEEK.y + d * DAY.y,
});

const points = (...ps: Point[]) => ps.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");

const lift = (p: Point, h: number): Point => ({ x: p.x, y: p.y - h });

function tower(w: number, d: number, height: number, color: string): string {
  const back = project(w + INSET, d + INSET);
  const right = project(w + 1 - INSET, d + INSET);
  const front = project(w + 1 - INSET, d + 1 - INSET);
  const left = project(w + INSET, d + 1 - INSET);
  return `<g class="t" style="animation-delay:${(w + d) * WAVE_MS}ms">
<polygon points="${points(left, front, lift(front, height), lift(left, height))}" fill="${mix(color, "#000000", 0.2)}"/>
<polygon points="${points(front, right, lift(right, height), lift(front, height))}" fill="${mix(color, "#000000", 0.36)}"/>
<polygon points="${points(lift(back, height), lift(right, height), lift(front, height), lift(left, height))}" fill="${color}"/>
</g>`;
}

function highlights(days: Day[]) {
  const best = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]!);
  const byWeekday = new Array<number>(7).fill(0);
  for (const day of days) byWeekday[parseDate(day.date).getUTCDay()]! += day.count;
  const busiest = byWeekday.indexOf(Math.max(...byWeekday));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  return {
    total,
    best,
    weekday: WEEKDAYS[busiest]!,
    average: total / days.length,
    activeDays: days.filter((d) => d.count > 0).length,
  };
}

export function renderSkyline(profile: Profile, theme: Theme): string {
  const days = profile.lastYear.flat();
  const max = Math.max(1, ...days.map((d) => d.count));
  // sqrt keeps light days visible next to a few huge ones.
  const scale = (count: number) => Math.sqrt(count / max);

  const cells = profile.lastYear.flatMap((week, w) =>
    week.map((day) => ({ w, d: parseDate(day.date).getUTCDay(), count: day.count })),
  );
  // Painter's algorithm: draw back-to-front so nearer towers cover farther ones.
  cells.sort((a, b) => a.w + a.d - (b.w + b.d));
  const towers = cells.map(({ w, d, count }) =>
    count > 0
      ? tower(w, d, 3 + scale(count) * (MAX_HEIGHT - 3), rampAt(theme.ramp, scale(count)))
      : tower(w, d, 1.5, theme.empty),
  );

  const slope = (Math.atan2(WEEK.y, WEEK.x) * 180) / Math.PI;
  const months = profile.lastYear.flatMap((week, w) => {
    const first = week[0]!;
    if (w === 0 || parseDate(first.date).getUTCDate() > 7) return [];
    const p = project(w + 0.5, 7);
    const x = round(p.x - 4);
    const y = round(p.y + 16);
    return [`<text x="${x}" y="${y}" font-size="10.5" class="muted" transform="rotate(${round(slope)} ${x} ${y})">${monthName(first.date)}</text>`];
  });

  const h = highlights(days);
  const facts = [
    ["Best day", `${number(h.best.count)} on ${shortDate(h.best.date)}`],
    ["Busiest weekday", h.weekday],
    ["Daily average", h.average.toFixed(1)],
    ["Active days", `${h.activeDays} of ${days.length}`],
  ];
  const legend = [0, 0.25, 0.5, 0.75, 1].map(
    (t, i) => `<rect x="${64 + i * 16}" y="427" width="12" height="12" rx="3" fill="${t === 0 ? theme.empty : rampAt(theme.ramp, t)}"/>`,
  );

  const body = `
<g class="fade-up">
  <text x="${WIDTH - 26}" y="40" text-anchor="end" class="heading" font-size="17">Contribution skyline</text>
  <text x="${WIDTH - 26}" y="62" text-anchor="end" font-size="13" class="secondary"><tspan font-weight="700" class="primary">${number(h.total)}</tspan> contributions in the last year</text>
</g>
${towers.join("\n")}
${months.join("\n")}
<g class="fade" style="animation-delay:900ms">
${facts
  .map(
    ([label, value], i) => `  <text x="26" y="${280 + i * 36}" font-size="11" class="muted">${label}</text>
  <text x="26" y="${280 + i * 36 + 16}" font-size="13" font-weight="600">${value}</text>`,
  )
  .join("\n")}
  <text x="26" y="437" font-size="10.5" class="muted">Less</text>
  ${legend.join("")}
  <text x="148" y="437" font-size="10.5" class="muted">More</text>
</g>`;

  return document({
    theme,
    width: WIDTH,
    height: HEIGHT,
    title: "Contribution skyline",
    description: `Isometric contribution calendar: ${number(h.total)} contributions in the last year, best day ${h.best.count} on ${shortDate(h.best.date, true)}.`,
    style: `
.primary { fill: ${theme.textPrimary}; }
@keyframes grow { from { transform: scaleY(0); } }
.t { transform-box: fill-box; transform-origin: 50% 100%; animation: grow .8s cubic-bezier(.34,1.45,.64,1) both; }`,
    body,
  });
}
