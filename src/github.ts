// Fetches everything the cards need from the GitHub GraphQL API in a few requests.

export interface Day {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface Streak {
  length: number;
  start: string | null;
  end: string | null;
}

export interface Language {
  name: string;
  size: number;
}

export interface Profile {
  login: string;
  firstYear: number;
  history: Day[]; // every day since the first contribution year, ascending
  lastYear: Day[][]; // the profile calendar: weeks of days, Sunday-first
  totalContributions: number;
  currentStreak: Streak;
  longestStreak: Streak;
  year: {
    contributions: number;
    activeDays: number;
  };
  stars: number;
  repositories: number;
  languages: Language[]; // sorted by size, descending
}

interface CalendarDay {
  date: string;
  contributionCount: number;
}

interface Calendar {
  weeks: { contributionDays: CalendarDay[] }[];
}

const ENDPOINT = "https://api.github.com/graphql";

async function graphql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "profile-graphs",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GitHub API responded ${response.status}: ${await response.text()}`);
  }
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) {
    throw new Error(`GitHub API error: ${body.errors.map((e) => e.message).join("; ")}`);
  }
  if (!body.data) throw new Error("GitHub API returned no data");
  return body.data;
}

const CALENDAR = "contributionCalendar { weeks { contributionDays { date contributionCount } } }";

const OVERVIEW_QUERY = `
  query ($login: String!) {
    user(login: $login) {
      login
      contributionsCollection {
        contributionYears
        ${CALENDAR}
      }
    }
  }`;

const YEAR_QUERY = `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) { ${CALENDAR} }
    }
  }`;

const REPOS_QUERY = `
  query ($login: String!, $cursor: String) {
    user(login: $login) {
      repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          stargazerCount
          languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name } }
          }
        }
      }
    }
  }`;

interface OverviewData {
  user: {
    login: string;
    contributionsCollection: {
      contributionYears: number[];
      contributionCalendar: Calendar;
    };
  } | null;
}

interface YearData {
  user: { contributionsCollection: { contributionCalendar: Calendar } };
}

interface ReposData {
  user: {
    repositories: {
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: {
        stargazerCount: number;
        languages: { edges: { size: number; node: { name: string } }[] };
      }[];
    };
  };
}

const toDay = (d: CalendarDay): Day => ({ date: d.date, count: d.contributionCount });

export function computeStreaks(days: Day[]): { current: Streak; longest: Streak } {
  const empty: Streak = { length: 0, start: null, end: null };
  let longest = empty;
  let run = empty;
  for (const day of days) {
    if (day.count > 0) {
      run = { length: run.length + 1, start: run.start ?? day.date, end: day.date };
      if (run.length > longest.length) longest = run;
    } else {
      run = empty;
    }
  }
  // Today is still in progress: a streak only breaks once a whole day passes empty.
  if (days.length > 1 && days.at(-1)!.count === 0) {
    return { current: computeStreaks(days.slice(0, -1)).current, longest };
  }
  return { current: run, longest };
}

export async function fetchProfile(token: string, login: string): Promise<Profile> {
  const overview = await graphql<OverviewData>(token, OVERVIEW_QUERY, { login });
  if (!overview.user) throw new Error(`GitHub user "${login}" not found`);
  const collection = overview.user.contributionsCollection;
  const years = [...collection.contributionYears].sort((a, b) => a - b);

  const calendars = await Promise.all(
    years.map((year) =>
      graphql<YearData>(token, YEAR_QUERY, {
        login,
        from: `${year}-01-01T00:00:00Z`,
        to: `${year}-12-31T23:59:59Z`,
      }),
    ),
  );

  const lastYear = collection.contributionCalendar.weeks.map((w) => w.contributionDays.map(toDay));
  const today = lastYear.at(-1)?.at(-1)?.date ?? "";
  const byDate = new Map<string, Day>();
  for (const { user } of calendars) {
    for (const week of user.contributionsCollection.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        if (day.date <= today) byDate.set(day.date, toDay(day));
      }
    }
  }
  const history = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const { current, longest } = computeStreaks(history);

  let stars = 0;
  let repositories = 0;
  const languageSizes = new Map<string, number>();
  let cursor: string | null = null;
  do {
    const page: ReposData = await graphql<ReposData>(token, REPOS_QUERY, { login, cursor });
    const repos = page.user.repositories;
    repositories = repos.totalCount;
    for (const repo of repos.nodes) {
      stars += repo.stargazerCount;
      for (const { size, node } of repo.languages.edges) {
        languageSizes.set(node.name, (languageSizes.get(node.name) ?? 0) + size);
      }
    }
    cursor = repos.pageInfo.hasNextPage ? repos.pageInfo.endCursor : null;
  } while (cursor);

  return {
    login: overview.user.login,
    firstYear: years[0] ?? new Date().getUTCFullYear(),
    history,
    lastYear,
    totalContributions: history.reduce((sum, d) => sum + d.count, 0),
    currentStreak: current,
    longestStreak: longest,
    // Private contributions arrive untyped (no commit/PR split), so only day totals are reliable.
    year: {
      contributions: lastYear.flat().reduce((sum, d) => sum + d.count, 0),
      activeDays: lastYear.flat().filter((d) => d.count > 0).length,
    },
    stars,
    repositories,
    languages: [...languageSizes]
      .map(([name, size]) => ({ name, size }))
      .sort((a, b) => b.size - a.size),
  };
}
