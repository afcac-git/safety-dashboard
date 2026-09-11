import fs from "fs";
import path from "path";
import { kvGet, kvSet } from "./db";
import type { KpiData, ActionRow, ActionStatus, CountryRow, TargetRow, DashboardData, UpdateLog, ExpertStat, AppUser } from "./types";

// JSON files are read-only seeds (bundled at build time — readable on Vercel too)
const SOURCE_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");

function readJsonFile<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, filename), "utf-8")) as T;
}

// DB keys
const K = {
  kpis:           "kpis",
  actions:        "actions",
  countries:      "countries",
  targets:        "targets",
  countryTargets: "country_targets",
  updates:        "updates",
} as const;

/** Read from DB; if missing, seed from the bundled JSON file and return. */
async function dbGetOrSeed<T>(key: string, filename: string): Promise<T> {
  const cached = await kvGet<T>(key);
  if (cached !== null) return cached;
  const data = readJsonFile<T>(filename);
  await kvSet(key, data);
  return data;
}

/* ── Readers ─────────────────────────────────────── */

export async function getKpis(): Promise<KpiData> {
  const kpis = await dbGetOrSeed<KpiData>(K.kpis, "kpis.json");
  // Migrate stale dates: update lastUpdated/reportPeriod if still showing pre-2026 values
  if (kpis.lastUpdated < "2026-01-01") {
    const fixed = { ...kpis, lastUpdated: "2026-05-20", reportPeriod: "Q2 2026" };
    await kvSet(K.kpis, fixed);
    return fixed;
  }
  return kpis;
}

const COUNTRY_RENAMES: Record<string, string> = { "Ivory Coast": "Cote D'Ivoire" };
const USER_RENAMES: Record<string, string> = { "mbaioulem": "Djekilamber.mbaioulem", "Djekilamber.mbaioulem.": "Djekilamber.mbaioulem" };

// Forced role/countries overrides applied on every read (overrides KV)
const USER_UPDATES: Record<string, Partial<Pick<AppUser, "role" | "countries">>> = {
  "oche.victor-elias": {
    role: "rsoo",
    countries: ["Cabo Verde", "Gambia", "Ghana", "Guinea", "Liberia", "Nigeria", "Sierra Leone"],
  },
  "uae.expert": {
    role: "observer",
    countries: undefined,
  },
  "paul.rwegasha": {
    role: "rsoo",
    countries: ["Burundi", "DR Congo", "Kenya", "Rwanda", "Somalia", "South Sudan", "Tanzania", "Uganda"],
  },
  "jackline.kwagala": {
    role: "rsoo",
    countries: ["Burundi", "DR Congo", "Kenya", "Rwanda", "Somalia", "South Sudan", "Tanzania", "Uganda"],
  },
  "sylvestre.sinarinzi": {
    role: "rsoo",
    countries: ["Burundi", "DR Congo", "Kenya", "Rwanda", "Somalia", "South Sudan", "Tanzania", "Uganda"],
  },
  "katchienne.silue": {
    role: "rsoo",
    countries: ["Benin", "Burkina Faso", "Cote D'Ivoire", "Guinea-Bissau", "Mali", "Mauritania", "Niger", "Senegal", "Togo"],
  },
  "beloved.mupfurururwa": {
    role: "rsoo",
    countries: ["Angola", "Botswana", "DR Congo", "Lesotho", "Madagascar", "Malawi", "Mauritius", "Mozambique", "Namibia", "Seychelles", "South Africa", "Eswatini", "Tanzania", "Zambia", "Zimbabwe"],
  },
  "edgar.dupont": {
    role: "rsoo",
    countries: ["Angola", "Botswana", "DR Congo", "Lesotho", "Madagascar", "Malawi", "Mauritius", "Mozambique", "Namibia", "Seychelles", "South Africa", "Eswatini", "Tanzania", "Zambia", "Zimbabwe"],
  },
};

function renameCountry(name: string): string {
  return COUNTRY_RENAMES[name] ?? name;
}

// Countries confirmed with 0 questionnaire submissions as of June 25, 2026 (PDF report)
const COUNTRIES_ZERO_V1 = new Set([
  "Algeria", "Botswana", "Cabo Verde", "Cameroon", "Central African Republic",
  "Chad", "Comoros", "DR Congo", "Djibouti", "Eritrea", "Gambia", "Guinea",
  "Guinea-Bissau", "Lesotho", "Libya", "Mauritius", "Morocco", "Rwanda",
  "Seychelles", "Somalia", "Sudan", "Tunisia",
]);

// Recompute global KPI percentages from countries that have submitted data (actions > 0)
async function recomputeKpisFromCountries(countries: CountryRow[]): Promise<void> {
  const active = countries.filter(c => c.actions > 0);
  if (active.length === 0) return;
  const n = active.length;
  const avg = (field: keyof Pick<CountryRow, "completed" | "inprogress" | "delayed" | "notstarted">) =>
    Math.round(active.reduce((s, c) => s + c[field], 0) / n);
  const totalBudget = active.reduce((s, c) => s + (c.budget ?? 0), 0);
  const current = await kvGet<KpiData>(K.kpis);
  if (!current) return;
  await kvSet(K.kpis, {
    ...current,
    pctCompleted:  avg("completed"),
    pctInProgress: avg("inprogress"),
    pctDelayed:    avg("delayed"),
    pctNotStarted: avg("notstarted"),
    totalBudget,
  });
}

// Largest-remainder method: distributes integer percentages that always sum to 100.
function pctLargestRemainder(counts: number[], total: number): number[] {
  if (total === 0) return counts.map(() => 0);
  const raws    = counts.map(c => c / total * 100);
  const floored = raws.map(v => Math.floor(v));
  const rems    = raws.map((v, i) => v - floored[i]);
  let leftover  = 100 - floored.reduce((a, b) => a + b, 0);
  const order   = rems.map((_, i) => i).sort((a, b) => rems[b] - rems[a]);
  for (const i of order) { if (leftover-- <= 0) break; floored[i]++; }
  return floored;
}

// Normalize stored country row so the 4 PCT fields always sum to 100.
function normalizeCountryPcts(r: CountryRow): CountryRow {
  const vals = [r.completed, r.inprogress, r.delayed, r.notstarted];
  const sum  = vals.reduce((a, b) => a + b, 0);
  if (sum === 100 || sum === 0) return r;
  const [completed, inprogress, delayed, notstarted] = pctLargestRemainder(vals, sum);
  return { ...r, completed, inprogress, delayed, notstarted };
}

export async function getCountries(): Promise<CountryRow[]> {
  const rows = await dbGetOrSeed<CountryRow[]>(K.countries, "countries.json");
  const zeroV1Done = await kvGet<boolean>("countriesZeroV1");
  let dirty = false;
  const fixed = rows.map(r => {
    const country = renameCountry(r.country);
    let row: CountryRow = country !== r.country ? { ...r, country } : r;
    if (!zeroV1Done && COUNTRIES_ZERO_V1.has(row.country)) {
      row = { ...row, actions: 0, completed: 0, inprogress: 0, delayed: 0, notstarted: 0, budget: 0 };
    }
    // Fix any stored row whose 4 PCT fields don't sum to 100
    const norm = normalizeCountryPcts(row);
    if (norm !== row) { row = norm; dirty = true; }
    if (row !== r) dirty = true;
    return row;
  });
  if (!zeroV1Done) {
    await kvSet("countriesZeroV1", true);
    dirty = true;
    await recomputeKpisFromCountries(fixed);
  }
  if (dirty) await kvSet(K.countries, fixed);
  return fixed;
}

export async function getActions(): Promise<ActionRow[]> {
  const rows = await dbGetOrSeed<ActionRow[]>(K.actions, "actions.json");
  const actZeroV1Done = await kvGet<boolean>("actZeroV1");
  let dirty = false;
  const fixed = rows.map(r => {
    let row: ActionRow =
      (r.status as string) === "onhold"  ? { ...r, status: "notstarted" as const } :
      (r.status as string) === "delayed" ? { ...r, status: "inprogress" as const } : r;
    const country = renameCountry(row.country);
    if (country !== row.country) row = { ...row, country };
    if (!actZeroV1Done && COUNTRIES_ZERO_V1.has(row.country)) {
      row = { ...row, status: "notstarted" as const, budget: 0 };
    }
    if (row !== r) dirty = true;
    return row;
  });
  if (!actZeroV1Done) { await kvSet("actZeroV1", true); dirty = true; }
  if (dirty) await kvSet(K.actions, fixed);
  return fixed;
}

// Replace any deadline year ≤ 2025 with 2026 (covers stale KV data like "2024", "Dec 2024", "Dec 2025", etc.)
function fixDeadlines<T extends { deadline?: string }>(rows: T[]): T[] {
  return rows.map(r => {
    if (!r.deadline) return r;
    const fixed = r.deadline.replace(/\b(20(?:0\d|1\d|2[0-5]))\b/g, "2026");
    return fixed !== r.deadline ? { ...r, deadline: fixed } : r;
  });
}

export async function getTargets(): Promise<TargetRow[]> {
  const rows = await dbGetOrSeed<TargetRow[]>(K.targets, "targets.json");
  const fixed = fixDeadlines(rows).map((r) =>
    (r.status as string) === "delayed" ? { ...r, status: "inprogress" as const } : r
  );
  if (fixed.some((r, i) => r.deadline !== rows[i].deadline || r.status !== rows[i].status)) await kvSet(K.targets, fixed);
  return fixed;
}

export async function getDashboardData(): Promise<DashboardData> {
  const [kpis, actions, countries, targets, countryTargets] = await Promise.all([
    getKpis(), getActions(), getCountries(), getTargets(), getAllCountryTargets(),
  ]);

  // Reconcile: a country's Status / breakdown must always match what was actually
  // submitted. If the write-path sync (saveCountryTargets -> syncActionRow /
  // syncCountryStats) ever failed to persist after a real submission, the stored
  // actions/countries rows can go stale (e.g. frozen on "Not Started") even though
  // country_targets already has the focal point's real answers. Recompute from the
  // submitted targets whenever a country has them, on every read, so it self-heals.
  const reconciledActions = actions.map((a) => {
    const ct = countryTargets[a.country];
    if (!ct || ct.length === 0) return a;
    const status = computeActionStatus(ct);
    return status !== a.status ? { ...a, status } : a;
  });
  const reconciledCountries = countries.map((c) => {
    const ct = countryTargets[c.country];
    if (!ct || ct.length === 0) return c;
    const pcts = computeCountryPcts(ct);
    return (pcts.completed !== c.completed || pcts.inprogress !== c.inprogress || pcts.notstarted !== c.notstarted)
      ? { ...c, ...pcts }
      : c;
  });

  return { kpis, actions: reconciledActions, countries: reconciledCountries, targets };
}

/* ── Writers ─────────────────────────────────────── */

export async function saveKpis(data: KpiData): Promise<void> {
  await kvSet(K.kpis, data);
}

export async function saveActions(data: ActionRow[]): Promise<void> {
  await kvSet(K.actions, data);
}

export async function saveCountries(data: CountryRow[]): Promise<void> {
  await kvSet(K.countries, data);
}

export async function saveTargets(data: TargetRow[]): Promise<void> {
  await kvSet(K.targets, data);
}

export async function saveDashboardData(data: DashboardData): Promise<void> {
  await Promise.all([
    saveKpis(data.kpis),
    saveActions(data.actions),
    saveCountries(data.countries),
    saveTargets(data.targets),
  ]);
}

/* ── Country-specific targets ───────────────────── */

const COUNTRY_REGIONS: Record<string, string> = {
  "Algeria": "North Africa",     "Angola": "Southern Africa",   "Benin": "West Africa",
  "Botswana": "Southern Africa", "Burkina Faso": "West Africa", "Burundi": "East Africa",
  "Cabo Verde": "West Africa",   "Cameroon": "Central Africa",  "Central African Republic": "Central Africa",
  "Chad": "Central Africa",      "Comoros": "East Africa",      "Congo (Republic)": "Central Africa",
  "DR Congo": "Central Africa",  "Djibouti": "East Africa",     "Egypt": "North Africa",
  "Equatorial Guinea": "Central Africa", "Eritrea": "East Africa", "Eswatini": "Southern Africa",
  "Ethiopia": "East Africa",     "Gabon": "Central Africa",     "Gambia": "West Africa",
  "Ghana": "West Africa",        "Guinea": "West Africa",       "Guinea-Bissau": "West Africa",
  "Cote D'Ivoire": "West Africa",  "Kenya": "East Africa",        "Lesotho": "Southern Africa",
  "Liberia": "West Africa",      "Libya": "North Africa",       "Madagascar": "East Africa",
  "Malawi": "East Africa",       "Mali": "West Africa",         "Mauritania": "North Africa",
  "Mauritius": "East Africa",    "Morocco": "North Africa",     "Mozambique": "Southern Africa",
  "Namibia": "Southern Africa",  "Niger": "West Africa",        "Nigeria": "West Africa",
  "Rwanda": "East Africa",       "São Tomé & Príncipe": "Central Africa", "Senegal": "West Africa",
  "Seychelles": "East Africa",   "Sierra Leone": "West Africa", "Somalia": "East Africa",
  "South Africa": "Southern Africa", "South Sudan": "East Africa", "Sudan": "North Africa",
  "Tanzania": "East Africa",     "Togo": "West Africa",         "Tunisia": "North Africa",
  "Uganda": "East Africa",       "Zambia": "Southern Africa",   "Zimbabwe": "Southern Africa",
};

export async function getAllCountryTargets(): Promise<Record<string, TargetRow[]>> {
  const raw = (await kvGet<Record<string, TargetRow[]>>(K.countryTargets)) ?? {};
  const ctZeroV1Done = await kvGet<boolean>("ctZeroV1");
  let dirty = false;
  const all: Record<string, TargetRow[]> = {};
  for (const country of Object.keys(raw)) {
    const newKey = renameCountry(country);
    if (newKey !== country) dirty = true;
    // One-time purge: drop stale/test submissions for countries that have no real data
    if (!ctZeroV1Done && COUNTRIES_ZERO_V1.has(newKey)) { dirty = true; continue; }
    const original = raw[country];
    all[newKey] = fixDeadlines(original.map((t) =>
      (t.status as string) === "onhold"  ? { ...t, status: "notstarted" as const } :
      (t.status as string) === "delayed" ? { ...t, status: "inprogress" as const } : t
    ));
    if (all[newKey].some((r, i) => r.deadline !== original[i]?.deadline || r.status !== original[i]?.status)) dirty = true;
  }
  if (!ctZeroV1Done) { await kvSet("ctZeroV1", true); dirty = true; }
  if (dirty) await kvSet(K.countryTargets, all);
  return all;
}

export async function getCountryTargets(country: string): Promise<TargetRow[]> {
  const all = await getAllCountryTargets();
  if (all[country]?.length > 0) return all[country];
  // First visit: blank template (pct=0)
  const base = await getTargets();
  return base.map((t) => ({ ...t, pct: 0, status: "notstarted" as const }));
}

export async function saveCountryTargets(country: string, targets: TargetRow[]): Promise<void> {
  // 1. Persist per-country answers
  const all = await getAllCountryTargets();
  all[country] = targets;
  await kvSet(K.countryTargets, all);

  // 2–4. Update all derived data in parallel where possible
  await Promise.all([
    syncCountryStats(country, targets),
    syncActionRow(country, targets),
  ]);
  await recomputeAggregateTargets(all);
}

async function recomputeAggregateTargets(all: Record<string, TargetRow[]>): Promise<void> {
  const submissions = Object.values(all).filter((s) => s.length > 0);
  if (submissions.length === 0) return;

  const base = await getTargets();
  const VALID = [0, 25, 50, 75, 100] as const;
  const statusMap: Record<number, TargetRow["status"]> = {
    0: "notstarted", 25: "inprogress", 50: "inprogress", 75: "inprogress", 100: "completed",
  };

  const aggregate = base.map((t) => {
    const pcts = submissions.map((s) => s.find((x) => x.id === t.id)?.pct ?? 0);
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const rounded = VALID.reduce((prev, curr) =>
      Math.abs(curr - avg) < Math.abs(prev - avg) ? curr : prev
    );
    return { ...t, pct: rounded, status: statusMap[rounded] };
  });

  await saveTargets(aggregate);
}

// Pure: derive an action's status from its country's actual submitted targets.
// Shared by the write path (syncActionRow) and the read-path reconciliation in
// getDashboardData, so a country's Status can never drift from what was submitted.
function computeActionStatus(targets: TargetRow[]): ActionStatus {
  const total = targets.length;
  if (total === 0) return "notstarted";

  const completed  = targets.filter((t) => t.pct === 100).length;
  const inprogress = targets.filter((t) => t.pct === 25 || t.pct === 50 || t.pct === 75).length;
  const notstarted = targets.filter((t) => t.pct === 0).length;

  if (completed === total)           return "completed";
  if (notstarted === total)          return "notstarted";
  if (inprogress >= notstarted)      return "inprogress";
  return "notstarted";
}

// Pure: derive a country's completed/inprogress/notstarted % breakdown from its
// actual submitted targets. Shared with the read-path reconciliation, same reason.
function computeCountryPcts(targets: TargetRow[]): Pick<CountryRow, "completed" | "inprogress" | "delayed" | "notstarted"> {
  const total = targets.length;
  if (total === 0) return { completed: 0, inprogress: 0, delayed: 0, notstarted: 0 };

  const c100    = targets.filter((t) => t.pct === 100).length;
  const c255075 = targets.filter((t) => t.pct === 25 || t.pct === 50 || t.pct === 75).length;
  const c0      = total - c100 - c255075;
  const [completed, inprogress, notstarted] = pctLargestRemainder([c100, c255075, c0], total);
  return { completed, inprogress, delayed: 0, notstarted };
}

async function syncActionRow(country: string, targets: TargetRow[]): Promise<void> {
  if (targets.length === 0) return;
  const status = computeActionStatus(targets);

  const actions = await getActions();
  const idx = actions.findIndex((a) => a.country === country);
  if (idx >= 0) {
    actions[idx] = { ...actions[idx], status };
  } else {
    actions.push({ country, action: "AST", section: "Safety Targets Questionnaire", status, start: 2024, end: 2025, duration: 1, budget: 0 });
  }
  await saveActions(actions);
}

async function syncCountryStats(country: string, targets: TargetRow[]): Promise<void> {
  const total = targets.length;
  if (total === 0) return;
  const pcts = computeCountryPcts(targets);

  const countries = await getCountries();
  const idx = countries.findIndex((c) => c.country === country);
  if (idx >= 0) {
    countries[idx] = { ...countries[idx], actions: total, ...pcts };
  } else {
    countries.push({ country, region: COUNTRY_REGIONS[country] ?? "Africa", actions: total, ...pcts, budget: 0, entity: "CAA" });
  }
  await saveCountries(countries);
}

/* ── Country-filtered dashboard ─────────────────── */

export function filterDashboardForCountry(
  data: DashboardData,
  countryTargets: Record<string, TargetRow[]>,
  country: string
): DashboardData & { countryTargets: Record<string, TargetRow[]> } {
  const actions   = data.actions.filter((a) => a.country === country);
  const countries = data.countries.filter((c) => c.country === country);
  const targets   = countryTargets[country] ?? data.targets.map((t) => ({ ...t, pct: 0, status: "notstarted" as const }));

  // All KPI percentages derived from targets (questionnaire objectives) for the country
  // profile — a single synthetic action row per country is not granular enough.
  const tTotal = targets.length || 1;
  const tPct = (fn: (t: TargetRow) => boolean) => Math.round(targets.filter(fn).length / tTotal * 100);

  const kpis: KpiData = {
    ...data.kpis,
    totalCountries:      1,
    totalCountriesTrend: "",
    totalActions:        targets.filter((t) => t.pct > 0).length,
    totalActionsTrend:   "",
    pctCompleted:        tPct((t) => t.pct === 100),
    pctInProgress:       tPct((t) => t.pct > 0 && t.pct < 100),
    pctDelayed:      0,
    pctNotStarted:   tPct((t) => t.pct === 0),
  };

  return {
    kpis,
    actions,
    countries,
    targets,
    countryTargets: { [country]: targets },
  };
}

/* ── RSOO multi-country filtered dashboard ──────── */

export function filterDashboardForCountries(
  data: DashboardData,
  allCountryTargets: Record<string, TargetRow[]>,
  countriesList: string[]
): DashboardData & { countryTargets: Record<string, TargetRow[]> } {
  const countrySet = new Set(countriesList);
  const filteredCountries = data.countries.filter((c) => countrySet.has(c.country));
  const filteredActions   = data.actions.filter((a) => countrySet.has(a.country));

  const filteredCountryTargets: Record<string, TargetRow[]> = {};
  const filteredTargets: TargetRow[] = [];
  for (const c of countriesList) {
    const ct = allCountryTargets[c] ?? [];
    filteredCountryTargets[c] = ct;
    filteredTargets.push(...ct);
  }

  const active = filteredCountries.filter((c) => c.actions > 0);
  const n = active.length || 1;
  const avg = (field: keyof Pick<CountryRow, "completed" | "inprogress" | "delayed" | "notstarted">) =>
    Math.round(active.reduce((s, c) => s + c[field], 0) / n);

  const kpis: KpiData = {
    ...data.kpis,
    totalCountries:      active.length,
    totalCountriesTrend: "",
    totalActions:        filteredActions.length,
    totalActionsTrend:   "",
    pctCompleted:        active.length > 0 ? avg("completed")  : 0,
    pctInProgress:       active.length > 0 ? avg("inprogress") : 0,
    pctDelayed:          active.length > 0 ? avg("delayed")    : 0,
    pctNotStarted:       active.length > 0 ? avg("notstarted") : 0,
  };

  return { kpis, actions: filteredActions, countries: filteredCountries, targets: filteredTargets, countryTargets: filteredCountryTargets };
}

/* ── Users (Neon DB primary, JSON file fallback) ─── */

export async function getUsers(): Promise<AppUser[]> {
  let kvUsers: AppUser[] | null = null;
  try { kvUsers = await kvGet<AppUser[]>("users"); } catch { /* ignore */ }

  let fileUsers: AppUser[] = [];
  try { fileUsers = readJsonFile<AppUser[]>("users.json"); } catch { /* ignore */ }

  if (!kvUsers || kvUsers.length === 0) return fileUsers;

  // Migrate country and username renames in KV, then apply forced role/countries overrides
  const renamed = kvUsers.map(u => {
    const newUsername = USER_RENAMES[u.username] ?? u.username;
    const newCountry = u.country ? renameCountry(u.country) : u.country;
    const upd = USER_UPDATES[newUsername];
    const base = (newUsername !== u.username || newCountry !== u.country)
      ? { ...u, username: newUsername, country: newCountry }
      : u;
    return upd ? { ...base, ...upd } : base;
  });
  const needsRename = renamed.some((u, i) => {
    const orig = kvUsers![i];
    return u.username !== orig.username || u.country !== orig.country
      || u.role !== orig.role || JSON.stringify(u.countries) !== JSON.stringify((orig as AppUser).countries);
  });

  // Auto-sync: add any new user from users.json not yet in KV
  const kvUsernames = new Set(renamed.map((u) => u.username.toLowerCase()));
  const missing = fileUsers.filter((u) => !kvUsernames.has(u.username.toLowerCase()));

  if (needsRename || missing.length > 0) {
    const merged = [...renamed, ...missing];
    try { await kvSet("users", merged); } catch { /* ignore */ }
    return merged;
  }
  return renamed;
}

export async function findUser(username: string): Promise<AppUser | null> {
  const normalized = username.trim().toLowerCase();
  const users = await getUsers();
  return users.find((u) => u.username.toLowerCase() === normalized) ?? null;
}

/* ── Update logs ─────────────────────────────────── */

export async function getUpdateLogs(): Promise<UpdateLog[]> {
  return (await kvGet<UpdateLog[]>(K.updates)) ?? [];
}

export async function appendUpdateLog(log: UpdateLog): Promise<void> {
  const logs = await getUpdateLogs();
  logs.push(log);
  await kvSet(K.updates, logs);
}

export async function getTopExperts(limit = 3, country?: string | null): Promise<ExpertStat[]> {
  const allLogs = await getUpdateLogs();
  const logs = country ? allLogs.filter(l => l.country === country) : allLogs;
  const map: Record<string, { total: number; targetsSum: number; lastDate: string; fullName?: string }> = {};

  for (const log of logs) {
    if (!map[log.username]) map[log.username] = { total: 0, targetsSum: 0, lastDate: log.date };
    map[log.username].total += 1;
    map[log.username].targetsSum += log.targetsUpdated;
    if (log.date > map[log.username].lastDate) {
      map[log.username].lastDate = log.date;
      if (log.fullName) map[log.username].fullName = log.fullName;
    }
  }

  return Object.entries(map)
    .map(([username, s]) => ({
      username,
      fullName: s.fullName,
      totalUpdates: s.total,
      lastUpdate: s.lastDate,
      avgTargetsPerUpdate: Math.round(s.targetsSum / s.total),
    }))
    .sort((a, b) => b.totalUpdates - a.totalUpdates)
    .slice(0, limit);
}

export async function getLastCountryUpdate(country?: string | null): Promise<UpdateLog | null> {
  const logs = await getUpdateLogs();
  const filtered = country ? logs.filter(l => l.country === country) : logs;
  if (filtered.length === 0) return null;
  return filtered.reduce((latest, log) => log.date > latest.date ? log : latest);
}
