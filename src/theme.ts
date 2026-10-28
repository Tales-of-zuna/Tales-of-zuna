// Light and dark palettes. Each card is rendered once per theme and the README
// picks the right file with <picture> + prefers-color-scheme.

export interface Theme {
  mode: "light" | "dark";
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  grid: string;
  empty: string; // a day with zero contributions
  ramp: string[]; // sequential, low -> high magnitude
  accent: string; // single-series line/ring color
  series: string[]; // categorical, fixed order (validated with the dataviz palette checker)
  other: string; // the "Other" bucket
}

export const themes: Theme[] = [
  {
    mode: "light",
    surface: "#ffffff",
    border: "#d0d7de",
    textPrimary: "#1f2328",
    textSecondary: "#424a53",
    textMuted: "#656d76",
    grid: "#eaeef2",
    empty: "#ebedf0",
    ramp: ["#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"],
    accent: "#2a78d6",
    series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
    other: "#afb8c1",
  },
  {
    mode: "dark",
    surface: "#0d1117",
    border: "#30363d",
    textPrimary: "#e6edf3",
    textSecondary: "#c9d1d9",
    textMuted: "#8b949e",
    grid: "#21262d",
    empty: "#161b22",
    ramp: ["#184f95", "#1c5cab", "#2a78d6", "#3987e5", "#6da7ec", "#9ec5f4"],
    accent: "#3987e5",
    series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"],
    other: "#484f58",
  },
];
