// Generates the profile cards into dist/: <card>-light.svg and <card>-dark.svg.
// Usage: GH_TOKEN=... GH_LOGIN=<user> node src/main.ts

import { mkdir, writeFile } from "node:fs/promises";
import { fetchProfile } from "./github.ts";
import { themes } from "./theme.ts";
import { renderActivity } from "./cards/activity.ts";
import { renderLanguages } from "./cards/languages.ts";
import { renderSkyline } from "./cards/skyline.ts";
import { renderStats } from "./cards/stats.ts";

const token = process.env.GH_TOKEN;
const login = process.env.GH_LOGIN;
if (!token || !login) {
  console.error("GH_TOKEN and GH_LOGIN must be set");
  process.exit(1);
}

const cards = {
  stats: renderStats,
  languages: renderLanguages,
  skyline: renderSkyline,
  activity: renderActivity,
};

const profile = await fetchProfile(token, login);
const outDir = new URL("../dist/", import.meta.url);
await mkdir(outDir, { recursive: true });
for (const theme of themes) {
  for (const [name, render] of Object.entries(cards)) {
    await writeFile(new URL(`${name}-${theme.mode}.svg`, outDir), render(profile, theme));
  }
}
console.log(
  `Rendered ${Object.keys(cards).length * themes.length} cards for ${profile.login}: ` +
    `${profile.totalContributions} contributions, streak ${profile.currentStreak.length}/${profile.longestStreak.length}, ` +
    `${profile.languages.length} languages`,
);
