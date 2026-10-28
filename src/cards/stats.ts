import type { Profile } from "../github.ts";
import type { Theme } from "../theme.ts";
import { dateRange, document, escape, number } from "../svg.ts";

const WIDTH = 560;
const HEIGHT = 240;
const COLUMN = WIDTH / 3;

function column(index: number, value: string, label: string, detail: string, valueY: number): string {
  const x = COLUMN * index + COLUMN / 2;
  return `<g class="fade-up" style="animation-delay:${150 + index * 120}ms">
  <text x="${x}" y="${valueY}" text-anchor="middle" font-size="30" font-weight="700">${escape(value)}</text>
  <text x="${x}" y="152" text-anchor="middle" font-size="13" font-weight="600" class="secondary">${escape(label)}</text>
  <text x="${x}" y="171" text-anchor="middle" font-size="11.5" class="muted">${escape(detail)}</text>
</g>`;
}

export function renderStats(profile: Profile, theme: Theme): string {
  const { currentStreak: current, longestStreak: longest } = profile;
  // The ring shows how close the current streak is to the personal best.
  const progress = longest.length ? (current.length / longest.length) * 100 : 0;
  const ringX = COLUMN * 1.5;
  const ringY = 88;

  const strip = (
    [
      ["Contributions · 12mo", profile.year.contributions],
      ["Active days · 12mo", profile.year.activeDays],
      ["Repositories", profile.repositories],
      ["Stars", profile.stars],
    ] as const
  ).filter(([, value]) => value > 0);
  const slot = WIDTH / strip.length;

  const body = `
<line x1="${COLUMN}" y1="48" x2="${COLUMN}" y2="172" stroke="${theme.grid}"/>
<line x1="${COLUMN * 2}" y1="48" x2="${COLUMN * 2}" y2="172" stroke="${theme.grid}"/>
<circle cx="${ringX}" cy="${ringY}" r="38" fill="none" stroke="${theme.grid}" stroke-width="6"/>
${progress > 0 ? `<circle class="ring" cx="${ringX}" cy="${ringY}" r="38" fill="none" stroke="${theme.accent}" stroke-width="6" stroke-linecap="round" pathLength="100" stroke-dasharray="${progress.toFixed(2)} 100" transform="rotate(-90 ${ringX} ${ringY})"/>` : ""}
${column(0, number(profile.totalContributions), "Total contributions", `${profile.firstYear} – Present`, 100)}
${column(1, number(current.length), "Current streak", dateRange(current.start, current.end), 99)}
${column(2, number(longest.length), "Longest streak", dateRange(longest.start, longest.end), 100)}
<line x1="24" y1="192" x2="${WIDTH - 24}" y2="192" stroke="${theme.grid}"/>
${strip
  .map(
    ([label, value], i) => `<g class="fade" style="animation-delay:${600 + i * 80}ms">
  <text x="${slot * i + slot / 2}" y="212" text-anchor="middle" font-size="15" font-weight="700">${number(value)}</text>
  <text x="${slot * i + slot / 2}" y="228" text-anchor="middle" font-size="10.5" class="muted">${label}</text>
</g>`,
  )
  .join("\n")}`;

  return document({
    theme,
    width: WIDTH,
    height: HEIGHT,
    title: `${profile.login}'s GitHub stats`,
    description: `${number(profile.totalContributions)} total contributions since ${profile.firstYear}. Current streak ${current.length} days, longest streak ${longest.length} days.`,
    style: `
@keyframes ring { from { stroke-dasharray: 0 100; } }
.ring { animation: ring 1.4s cubic-bezier(.33,1,.68,1) .3s both; }`,
    body,
  });
}
