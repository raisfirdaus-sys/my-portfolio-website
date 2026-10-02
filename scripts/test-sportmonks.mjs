// The Sportmonks pull, run end to end against a fake API in the documented v3
// shape: no token, no network. What it must get right is everything that
// would cost money or trust to get wrong on the one month that is paid for -
// following every page, reading each statistic per match, never writing one
// club's figures onto another, never presenting an estimate as a
// measurement, and never letting the token reach a file.
//
//   node scripts/test-sportmonks.mjs

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as SM from "./fetch-sportmonks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fail = 0;
const say = (ok, m) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${m}`); if (!ok) fail++; };

const TOKEN = "test-token-6f1c2a9e";

/* --------------------------------------------------- a fake Sportmonks --- */
const stat = (name, value) => ({ type_id: 0, value, type: { developer_name: name, name } });
function team(id, name, opts = {}) {
  const details = [
    stat("WIN",  { all: { count: 4 } }),
    stat("DRAW", { all: { count: 2 } }),
    stat("LOST", { all: { count: 1 } }),
    stat("GOALS", { all: { count: 14, average: 2.0 } }),
    stat("SHOTS", { total: 98, on_target: 35 }),
    stat("FOULS", { count: 77 }),
    stat("TACKLES", { count: 112, average: 16 }),
    stat("YELLOWCARDS", { all: { count: 12 } }),
    stat("REDCARDS", { all: { count: 1 } }),
    stat("CORNERS", { count: 40 })
  ];
  if (opts.xg) details.push(stat("EXPECTED_GOALS", { all: { count: opts.xg * 7, average: opts.xg } }));
  return { id, name, statistics: [{ season_id: 900, details }] };
}

const LEAGUES = [{ id: 8, name: "Premier League", currentseason: { id: 900, name: "2026/2027" } }];
const PAGE1 = [team(1, "Chelsea", { xg: 2.11 }), team(2, "Brentford"), team(3, "Manchester")];
const PAGE2 = [team(4, "Ireland"), team(5, "Some Club Not On The Board")];

const calls = [];
function fakeFetch(status = 200) {
  return async (url, init) => {
    const u = new URL(url);
    calls.push({ url: u.toString(), auth: init && init.headers && init.headers.Authorization });
    const body = (data, more) => ({
      ok: status === 200, status,
      headers: { get: () => null },
      json: async () => ({ data, pagination: { has_more: !!more } })
    });
    if (status !== 200) return body(null);
    if (u.pathname.endsWith("/leagues")) return body(LEAGUES);
    if (u.pathname.includes("/teams/seasons/900")) {
      return u.searchParams.get("page") === "2" ? body(PAGE2, false) : body(PAGE1, true);
    }
    if (u.pathname.includes("/fixtures/between/")) return body([{ id: 77, name: "A vs B" }]);
    return body([]);
  };
}

/* A working copy of the real board, with two hand-entered teams to merge
   around: Brentford with a real xG of its own, Ireland with none. */
async function sandbox() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sm-test-"));
  const data = JSON.parse(await fs.readFile(path.join(ROOT, "data/moneyball-fixtures.json"), "utf8"));
  Object.assign(data.teams.brentford, { measured: true, xgF: 1.97, matches: 7 });
  delete data.teams.brentford.xgEstimated;
  Object.assign(data.teams.ireland, { measured: false, xgF: null, statsMissing: true });
  delete data.teams.ireland.xgEstimated;
  const dataFile = path.join(dir, "board.json");
  await fs.writeFile(dataFile, JSON.stringify(data));
  return { dir, dataFile, reportFile: path.join(dir, "report.json"), rawDir: path.join(dir, "raw") };
}

/* ------------------------------------------------------------ the units -- */
const one = SM.teamStats(team(9, "X", { xg: 1.5 }), 900).stats;
say(one.matches === 7, `matches from wins + draws + losses (got ${one.matches})`);
say(one.goals === 2, "goals read from the season average");
say(Math.abs(one.shots - 14) < 0.01, `shots per match from a season total (got ${one.shots})`);
say(Math.abs(one.sot - 5) < 0.01, `on target read from inside the shots value (got ${one.sot})`);
say(Math.abs(one.fouls - 11) < 0.01, "fouls: a bare count divided by matches");
say(one.tackles === 16, "tackles: the average is preferred to count / matches");
say(Math.abs(one.yellow - 1.71) < 0.01 && Math.abs(one.red - 0.14) < 0.01, "cards per match");
say(one.xgF === 1.5, "xG read when the plan carries it");
say(SM.teamStats(team(9, "X"), 900).stats.xgF == null, "and left empty when it does not - never invented here");

const board = { teams: {
  manutd: { name: "Manchester United" }, mancity: { name: "Manchester City" },
  ireland: { name: "Republic of Ireland" }, bosnia: { name: "Bosnia and Herzegovina" }
} };
say(SM.boardKeyFor({ id: 3, name: "Manchester" }, board.teams).key === null,
  '"Manchester" is written onto neither United nor City');
say(SM.boardKeyFor({ id: 4, name: "Ireland" }, board.teams).key === "ireland",
  '"Ireland" finds the board\'s "Republic of Ireland"');
say(SM.boardKeyFor({ id: 5, name: "Bosnia & Herzegovina" }, board.teams).key === "bosnia",
  "an ampersand reads the same as \"and\"");
board.teams.mancity.sportmonksId = 31;
say(SM.boardKeyFor({ id: 31, name: "Man City FC" }, board.teams).key === "mancity",
  "an id stored by an earlier run beats any name");

/* --------------------------------------------------------- end to end ---- */
{
  const sb = await sandbox();
  const before = await fs.readFile(sb.dataFile, "utf8");
  const r = await SM.run({ token: "", fetchImpl: fakeFetch(), ...sb, log: () => {} });
  say(r.skipped === true, "no token: the run says so and stops");
  say((await fs.readFile(sb.dataFile, "utf8")) === before, "and the data file is untouched");
}

{
  calls.length = 0;
  const sb = await sandbox();
  const r = await SM.run({ token: TOKEN, fetchImpl: fakeFetch(), ...sb,
                           now: new Date("2026-10-02T09:00:00Z"), log: () => {} });
  const after = JSON.parse(await fs.readFile(sb.dataFile, "utf8"));

  say(calls.some((c) => c.url.includes("page=2")), "every page of teams is fetched, not just the first");
  say(calls.every((c) => c.auth === TOKEN), "the token travels in the Authorization header");
  say(calls.every((c) => !c.url.includes(TOKEN)), "and never in a URL, where it would reach a log");

  const ch = after.teams.chelsea;
  say(ch.xgF === 2.11 && !ch.xgEstimated, "Chelsea: the plan's own xG is used");
  say(ch.matches === 7 && ch.goals === 2 && ch.source === "sportmonks", "with the season's figures alongside it");
  say(ch.sportmonksId === 1, "and the Sportmonks id stored, so next time is matched by id");

  const br = after.teams.brentford;
  say(br.xgF === 1.97 && !br.xgEstimated, "Brentford: no xG on the plan, so the real xG typed in earlier is kept");
  say(br.shots === 14, "while every other figure is refreshed");

  const ir = after.teams.ireland;
  say(ir.xgEstimated === true && ir.xgF > 0, `Ireland: no xG anywhere, so it is estimated from shots (${ir.xgF})`);
  say(Math.abs(ir.xgF - (0.185 * 5 + 0.05 * 9)) < 0.01, "using the engine's own per-shot values");
  say(ir.statsMissing === false, "and the model can use the team");

  say(r.ambiguous.some((a) => a.sportmonks === "Manchester"), "the ambiguous name is reported, not guessed");
  say(r.unmatched === 1, "a club the board does not carry is counted, not forced onto anyone");
  say(r.namesSeen.CORNERS === 5 && !r.namesUsed.CORNERS,
    "every statistic the plan sends is listed, used or not - the first real run shows what it carries");

  const rawFiles = await fs.readdir(sb.rawDir);
  say(rawFiles.includes("season-900-teams.json") && rawFiles.some((f) => f.startsWith("fixtures-")),
    "raw responses kept, in the raw folder only");
  const written = [await fs.readFile(sb.dataFile, "utf8"), await fs.readFile(sb.reportFile, "utf8"),
                   ...(await Promise.all(rawFiles.map((f) => fs.readFile(path.join(sb.rawDir, f), "utf8"))))];
  say(written.every((t) => !t.includes(TOKEN)), "the token appears in no file written");
}

{
  const sb = await sandbox();
  const before = await fs.readFile(sb.dataFile, "utf8");
  let threw = null;
  try { await SM.run({ token: TOKEN, fetchImpl: fakeFetch(401), ...sb, log: () => {} }); }
  catch (e) { threw = e; }
  say(!!threw && /refused the token/.test(threw.message), "a refused token stops the run loudly");
  say(!threw || !threw.message.includes(TOKEN), "without printing the token");
  say((await fs.readFile(sb.dataFile, "utf8")) === before,
    "and what was already published stays exactly as it was");
}

/* ------------------------------------------- the workflow and the repo --- */
const wf = await fs.readFile(path.join(ROOT, ".github/workflows/update-sportmonks.yml"), "utf8");
say(/secrets\.SPORTMONKS_TOKEN/.test(wf), "the workflow takes the token from a repository secret");
say(/workflow_dispatch/.test(wf), "and can be run with one press");
say(/upload-artifact/.test(wf) && /retention-days:\s*90/.test(wf), "raw responses kept privately for 90 days");
say(!/git add[^\n]*(sportmonks-raw|\$\{\{ runner\.temp)/.test(wf), "and never committed to this public repository");
const gi = await fs.readFile(path.join(ROOT, ".gitignore"), "utf8");
say(/\.sportmonks-raw\//.test(gi), "a local raw folder is ignored by git too");

console.log(fail ? `\n${fail} failure(s).` : "\nsportmonks ok");
process.exit(fail ? 1 : 0);
