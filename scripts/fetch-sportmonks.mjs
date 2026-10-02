// Pull team season statistics from Sportmonks and publish what the model uses.
//
// Built for one way of using a subscription: pay for a month (or take the
// 14-day trial), pull everything the plan allows while it is live, and keep
// using it afterwards. Two things come out of a run:
//
//   1. Per-match team figures - matches, goals, xG, shots, shots on target,
//      fouls, tackles, cards - merged into data/moneyball-fixtures.json for
//      every team on the board. These are what the engine reads, they are
//      committed, and they stay after the subscription ends.
//   2. The raw responses, written to SPORTMONKS_RAW_DIR. The workflow keeps
//      those as a private Actions artifact and NEVER commits them: this
//      repository is public, and republishing a data provider's raw feed is
//      the one thing its licence is near-certain to forbid.
//
// Run by .github/workflows/update-sportmonks.yml. The token comes from the
// SPORTMONKS_TOKEN secret, is sent only as a request header, and is checked
// for and refused in anything written to disk.
//
//   SPORTMONKS_TOKEN=... node scripts/fetch-sportmonks.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://api.sportmonks.com/v3/football";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Same per-shot values the engine uses (XG_PER_SHOT in moneyball-engine.js),
   for the plans that carry shots but no xG. */
const XG_ON_TARGET = 0.185, XG_OFF_TARGET = 0.050;

/* ------------------------------------------------------------ mapping --- */

/* Sportmonks labels each statistic with a developer_name. Matched by name,
   not by numeric type id, so a renumbering or a plan with a different set of
   types does not silently write one statistic into another's column. Every
   name seen is reported in last-run.json, so the first real run shows exactly
   what this plan delivers and any name not listed here can be added. */
export const FIELD_NAMES = {
  goals:   /^(GOALS|GOALS_SCORED|GOALS_FOR|TEAM_GOALS)$/,
  xgF:     /^(EXPECTED_GOALS|XG|EXPECTED_GOALS_FOR|XG_FOR)$/,
  xgA:     /^(EXPECTED_GOALS_AGAINST|EXPECTED_GOALS_CONCEDED|XG_AGAINST|XGA)$/,
  shots:   /^(SHOTS|SHOTS_TOTAL|TOTAL_SHOTS)$/,
  sot:     /^(SHOTS_ON_TARGET|ON_TARGET)$/,
  fouls:   /^(FOULS|FOULS_COMMITTED)$/,
  tackles: /^(TACKLES|TOTAL_TACKLES)$/,
  yellow:  /^(YELLOWCARDS|YELLOW_CARDS)$/,
  red:     /^(REDCARDS|RED_CARDS)$/
};
const RESULT_NAMES = {
  win:  /^(WIN|WINS|TEAM_WINS)$/,
  draw: /^(DRAW|DRAWS|TEAM_DRAWS)$/,
  lost: /^(LOST|LOSS|LOSSES|TEAM_LOST|DEFEATS)$/
};

export function devName(detail) {
  const t = (detail && detail.type) || {};
  const raw = t.developer_name || t.code || t.name || "";
  return String(raw).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function num(x) {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/* The total-for-the-season part of a value. Sportmonks splits most team
   statistics into all / home / away; "all" is the one that matches the
   season's match count. */
function seasonPart(v) {
  if (v == null) return null;
  if (typeof v !== "object") return v;
  if (v.all != null) return v.all;
  if (v.overall != null) return v.overall;
  return v;
}

/** A statistic's per-match value, whichever shape it arrives in. */
export function perMatch(value, matches) {
  const v = seasonPart(value);
  if (v == null) return null;
  if (typeof v !== "object") {
    const n = num(v);
    return n != null && matches ? n / matches : null;
  }
  const avg = num(v.average ?? v.avg ?? v.per_game ?? v.per_match);
  if (avg != null) return avg;
  const total = num(v.count ?? v.total ?? v.value);
  return total != null && matches ? total / matches : null;
}

function countOf(value) {
  const v = seasonPart(value);
  if (v == null) return null;
  if (typeof v !== "object") return num(v);
  return num(v.count ?? v.total ?? v.value);
}

/**
 * One team's season statistics, as the engine wants them: per match.
 * Returns the figures plus which developer names were seen and which of them
 * were used, so a run can say plainly what the plan does and does not carry.
 */
export function teamStats(team, seasonId) {
  const blocks = (team.statistics || []).filter((s) =>
    seasonId == null || s.season_id == null || Number(s.season_id) === Number(seasonId));
  const details = blocks.flatMap((s) => s.details || []);
  const seen = [], used = {};
  const byName = new Map();
  for (const d of details) {
    const n = devName(d);
    if (!n) continue;
    seen.push(n);
    if (!byName.has(n)) byName.set(n, d.value);
  }

  /* Matches played. Results first (wins + draws + losses); failing that, the
     goals line, whose count divided by its average is the match count. */
  let matches = null;
  const res = { win: null, draw: null, lost: null };
  for (const [k, re] of Object.entries(RESULT_NAMES)) {
    for (const [n, v] of byName) if (re.test(n)) { res[k] = countOf(v); used[n] = "matches"; break; }
  }
  if (res.win != null && res.draw != null && res.lost != null) {
    matches = res.win + res.draw + res.lost;
  }
  if (!matches) {
    for (const [n, v] of byName) {
      if (!FIELD_NAMES.goals.test(n)) continue;
      const p = seasonPart(v) || {};
      const c = num(p.count), a = num(p.average);
      if (c != null && a) { matches = Math.round(c / a); used[n] = used[n] || "matches"; }
      break;
    }
  }

  const out = { matches: matches || null };
  for (const [field, re] of Object.entries(FIELD_NAMES)) {
    for (const [n, v] of byName) {
      if (!re.test(n)) continue;
      const pm = perMatch(v, matches);
      if (pm != null) { out[field] = round(pm); used[n] = field; }
      /* A SHOTS value often carries its on-target split inside it. */
      if (field === "shots" && out.sot == null && v && typeof v === "object") {
        const on = num((seasonPart(v) || {}).on_target ?? v.on_target);
        if (on != null && matches) { out.sot = round(on / matches); used[n] = "shots+sot"; }
      }
      break;
    }
  }
  return { stats: out, seen: [...new Set(seen)], used };
}

function round(x) { return Math.round(x * 100) / 100; }

/* ------------------------------------------------------ team matching --- */

const ALIASES = {
  republicofireland: "ireland", czechrepublic: "czechia", turkiye: "turkey",
  macedonia: "northmacedonia", fyrmacedonia: "northmacedonia",
  bosniaherzegovina: "bosniaandherzegovina", bosnia: "bosniaandherzegovina",
  korearepublic: "southkorea", usa: "unitedstates"
};

export function normName(s) {
  const flat = String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " and ")
    .replace(/\b(fc|afc|cf|sc|ac|as|ss|ssc|club|cd|rc|sv|vfb|fk|bk|if|calcio)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
  return ALIASES[flat] || flat;
}

/**
 * The board team a Sportmonks team is. An id stored by an earlier run wins;
 * then an exact normalised name; then a unique partial one. Two or more
 * partial candidates is reported as ambiguous and skipped - "Manchester"
 * must never be written into whichever of United or City came first.
 */
export function boardKeyFor(smTeam, boardTeams) {
  for (const [k, t] of Object.entries(boardTeams)) {
    if (t.sportmonksId != null && Number(t.sportmonksId) === Number(smTeam.id)) return { key: k };
  }
  const want = normName(smTeam.name);
  if (!want) return { key: null };
  const exact = Object.keys(boardTeams).filter((k) => normName(boardTeams[k].name) === want);
  if (exact.length === 1) return { key: exact[0] };
  if (exact.length > 1) return { key: null, ambiguous: exact };
  const partial = Object.keys(boardTeams).filter((k) => {
    const n = normName(boardTeams[k].name);
    return n && (n.startsWith(want) || want.startsWith(n));
  });
  if (partial.length === 1) return { key: partial[0] };
  return { key: null, ambiguous: partial.length ? partial : undefined };
}

/* --------------------------------------------------------- the merge --- */

/**
 * Write Sportmonks figures onto the board's teams.
 *
 *   - A figure Sportmonks measured replaces the published one. Every team
 *     then comes from the same source over the same season, which is the
 *     thing the hand-pasted figures never had (Romania over 8 matches against
 *     Belgium over 40 was the largest error on the Nations League board).
 *   - xG is the exception, because it is what opens the model's gate. If the
 *     plan carries xG, it is used. If not, a real xG already entered by hand
 *     is kept; only failing both is it estimated from shots - and then marked
 *     xgEstimated, so the page never shows an estimate as a measurement.
 *   - Nothing is cleared. A field Sportmonks does not carry keeps whatever
 *     was there.
 */
export function mergeIntoBoard(board, pulled, today) {
  const report = { updated: [], estimatedXg: [], keptHandXg: [], noMatches: [] };
  for (const p of pulled) {
    const t = board.teams[p.key];
    if (!t) continue;
    const s = p.stats;
    if (!s.matches) { report.noMatches.push(p.key); continue; }

    for (const f of ["matches", "goals", "xgA", "shots", "sot", "fouls", "tackles", "yellow", "red"]) {
      if (s[f] != null) t[f] = s[f];
    }
    if (s.xgF != null) {
      t.xgF = s.xgF;
      delete t.xgEstimated;
    } else if (t.measured && t.xgF != null && !t.xgEstimated) {
      report.keptHandXg.push(p.key);
    } else if (s.sot != null || s.shots != null) {
      const on = s.sot || 0, off = Math.max(0, (s.shots || 0) - on);
      const est = XG_ON_TARGET * on + XG_OFF_TARGET * off;
      if (est > 0) { t.xgF = round(est); t.xgEstimated = true; report.estimatedXg.push(p.key); }
    }

    t.sportmonksId = p.smId;
    t.measured = true;
    t.measuredAt = today;
    t.source = "sportmonks";
    t.statsMissing = t.xgF == null;
    report.updated.push(p.key);
  }
  return report;
}

/* ------------------------------------------------------------ network --- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class AuthError extends Error {}

async function getJSON(fetchImpl, token, p, params) {
  const url = new URL(BASE + p);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
  for (let attempt = 1; attempt <= 4; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let res;
    try {
      /* Header, not the api_token query parameter: a URL ends up in logs and
         error messages, a header does not. */
      res = await fetchImpl(url, { headers: { Authorization: token, Accept: "application/json" },
                                   signal: ctrl.signal });
    } finally { clearTimeout(timer); }
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(`Sportmonks refused the token on ${p} (HTTP ${res.status})`);
    }
    if (res.status === 429 || res.status >= 500) {
      const wait = num(res.headers && res.headers.get && res.headers.get("retry-after"));
      await sleep((wait ? wait * 1000 : 2000 * attempt));
      continue;
    }
    if (!res.ok) throw new Error(`${p} -> HTTP ${res.status}`);
    return res.json();
  }
  throw new Error(`${p} -> still failing after 4 attempts`);
}

async function getAll(fetchImpl, token, p, params, maxPages = 40) {
  const rows = [];
  for (let page = 1; page <= maxPages; page++) {
    const json = await getJSON(fetchImpl, token, p, { ...params, page, per_page: 50 });
    const data = json && json.data;
    if (Array.isArray(data)) rows.push(...data); else if (data) rows.push(data);
    const pg = json && json.pagination;
    if (!pg || !pg.has_more) break;
  }
  return rows;
}

/* --------------------------------------------------------------- run ---- */

function assertNoToken(token, text, where) {
  if (token && token.length >= 8 && text.includes(token)) {
    throw new Error(`refusing to write ${where}: it contains the API token`);
  }
}

export async function run({
  token = process.env.SPORTMONKS_TOKEN,
  fetchImpl = globalThis.fetch,
  dataFile = path.join(ROOT, "data/moneyball-fixtures.json"),
  reportFile = path.join(ROOT, "data/sportmonks/last-run.json"),
  rawDir = process.env.SPORTMONKS_RAW_DIR || path.join(ROOT, ".sportmonks-raw"),
  daysAhead = Number(process.env.DAYS_AHEAD || 14),
  now = new Date(),
  log = console.log
} = {}) {
  if (!token) {
    log("No SPORTMONKS_TOKEN set - nothing pulled, nothing changed.");
    log("Add it under Settings > Secrets and variables > Actions, named SPORTMONKS_TOKEN.");
    return { skipped: true };
  }

  const today = now.toISOString().slice(0, 10);
  const board = JSON.parse(await fs.readFile(dataFile, "utf8"));
  await fs.mkdir(rawDir, { recursive: true });
  const writeRaw = async (name, obj) => {
    const text = JSON.stringify(obj);
    assertNoToken(token, text, name);
    await fs.writeFile(path.join(rawDir, name), text);
  };

  const report = { pulledAt: now.toISOString(), leagues: [], namesSeen: {}, namesUsed: {},
                   matched: [], unmatched: 0, ambiguous: [], fixturesArchived: 0, errors: [] };

  /* The plan decides which leagues come back; ask for all of them. */
  const leagues = await getAll(fetchImpl, token, "/leagues", { include: "currentSeason" });
  await writeRaw("leagues.json", leagues);

  const pulled = [];
  for (const lg of leagues) {
    const season = lg.currentseason || lg.currentSeason || lg.current_season;
    if (!season || season.id == null) continue;
    let teams;
    try {
      teams = await getAll(fetchImpl, token, `/teams/seasons/${season.id}`, {
        include: "statistics.details.type",
        filters: `teamStatisticSeasons:${season.id}`
      });
    } catch (err) {
      if (err instanceof AuthError) throw err;
      report.errors.push(`${lg.name}: ${err.message}`);
      continue;
    }
    await writeRaw(`season-${season.id}-teams.json`, { league: lg, season, teams });
    report.leagues.push({ league: lg.name, season: season.name, seasonId: season.id, teams: teams.length });

    for (const team of teams) {
      const { stats, seen, used } = teamStats(team, season.id);
      seen.forEach((n) => { report.namesSeen[n] = (report.namesSeen[n] || 0) + 1; });
      Object.entries(used).forEach(([n, f]) => { report.namesUsed[n] = f; });
      const m = boardKeyFor(team, board.teams);
      if (m.key) { pulled.push({ key: m.key, smId: team.id, stats }); report.matched.push(m.key); }
      else if (m.ambiguous) report.ambiguous.push({ sportmonks: team.name, candidates: m.ambiguous });
      else report.unmatched++;
    }
  }

  /* Upcoming fixtures, archived only. They carry no bookmaker prices, so they
     cannot be priced on the board yet; they are kept for when they can. */
  try {
    const end = new Date(now.getTime() + daysAhead * 86400000).toISOString().slice(0, 10);
    const ids = leagues.map((l) => l.id).filter((x) => x != null);
    const fixtures = await getAll(fetchImpl, token, `/fixtures/between/${today}/${end}`, {
      include: "participants;league",
      ...(ids.length ? { filters: `fixtureLeagues:${ids.join(",")}` } : {})
    });
    await writeRaw(`fixtures-${today}-to-${end}.json`, fixtures);
    report.fixturesArchived = fixtures.length;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    report.errors.push(`fixtures: ${err.message}`);
  }

  const merged = mergeIntoBoard(board, pulled, today);
  Object.assign(report, merged);

  const boardText = JSON.stringify(board, null, 2) + "\n";
  const reportText = JSON.stringify(report, null, 2) + "\n";
  assertNoToken(token, boardText, "the data file");
  assertNoToken(token, reportText, "the run report");
  await fs.writeFile(dataFile, boardText);
  await fs.mkdir(path.dirname(reportFile), { recursive: true });
  await fs.writeFile(reportFile, reportText);

  log(`Leagues on this plan: ${report.leagues.length}`);
  for (const l of report.leagues) log(`  ${l.league} (${l.season}): ${l.teams} teams`);
  log(`Board teams updated: ${merged.updated.length}`);
  log(`  xG from Sportmonks:          ${merged.updated.length - merged.estimatedXg.length - merged.keptHandXg.length}`);
  log(`  xG kept from your own entry: ${merged.keptHandXg.length}`);
  log(`  xG estimated from shots:     ${merged.estimatedXg.length}`);
  if (report.ambiguous.length) log(`Ambiguous names, skipped: ${report.ambiguous.map((a) => a.sportmonks).join(", ")}`);
  log(`Upcoming fixtures archived: ${report.fixturesArchived}`);
  if (report.errors.length) log(`Errors: ${report.errors.join(" | ")}`);
  return report;
}

/* Run when executed directly, not when imported by the test. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((err) => {
    /* The message never carries the token: it is sent as a header, and every
       error above names the path, not the URL. */
    console.error(String(err && err.message || err));
    if (err instanceof AuthError) {
      console.error("If the subscription has ended, the statistics already published stay as they are. " +
                    "Disable this workflow under Actions to stop the daily attempt.");
    }
    process.exit(1);
  });
}
