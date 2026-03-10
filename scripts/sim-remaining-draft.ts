/**
 * scripts/sim-remaining-draft.ts
 *
 * Simulates all remaining picks in a draft directly via the database.
 * Each team (other than the real user) gets auto-picked by careerIlDays desc.
 * The real user's remaining picks are also auto-filled (best available).
 *
 * Run with:
 *   DATABASE_URL=... ~/.bun/bin/bun run scripts/sim-remaining-draft.ts <leagueId>
 */

import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const leagueId = process.argv[2];

if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }
if (!leagueId) { console.error("Usage: bun run sim-remaining-draft.ts <leagueId>"); process.exit(1); }

const db = new Client({ connectionString: DATABASE_URL });

try {
  await db.connect();

  // ── Load league ──────────────────────────────────────────────────────────────
  const leagueRes = await db.query(
    `SELECT id, name, "rosterSize", status FROM "League" WHERE id = $1`,
    [leagueId]
  );
  if (!leagueRes.rows.length) { console.error("League not found"); process.exit(1); }
  const league = leagueRes.rows[0];

  if (league.status !== "drafting") {
    console.error(`League "${league.name}" status is "${league.status}", not "drafting"`);
    process.exit(1);
  }

  // ── Load teams in join order ─────────────────────────────────────────────────
  const teamsRes = await db.query(
    `SELECT lm."userId", u.username, r.id AS "rosterId"
     FROM "LeagueMember" lm
     JOIN "User" u ON u.id = lm."userId"
     JOIN "Roster" r ON r."leagueId" = lm."leagueId" AND r."userId" = lm."userId"
     WHERE lm."leagueId" = $1
     ORDER BY lm."joinedAt" ASC`,
    [leagueId]
  );
  const teams = teamsRes.rows;
  const numTeams = teams.length;
  const rosterSize = league.rosterSize;
  const totalPicks = numTeams * rosterSize;

  console.log(`\nLeague: "${league.name}"`);
  console.log(`Teams: ${numTeams}  |  Roster size: ${rosterSize}  |  Total picks: ${totalPicks}`);
  console.log(`Teams (pick order):`);
  teams.forEach((t, i) => console.log(`  ${i + 1}. ${t.username}`));

  // ── Count picks already made ─────────────────────────────────────────────────
  const picksRes = await db.query(
    `SELECT r."userId", COUNT(rp.id)::int AS picks
     FROM "Roster" r
     LEFT JOIN "RosterPlayer" rp ON rp."rosterId" = r.id
     WHERE r."leagueId" = $1
     GROUP BY r."userId"`,
    [leagueId]
  );
  const picksByUser = new Map<string, number>(
    picksRes.rows.map((r: { userId: string; picks: number }) => [r.userId, r.picks])
  );
  const totalPicksMade = [...picksByUser.values()].reduce((a, b) => a + b, 0);
  console.log(`\nPicks made so far: ${totalPicksMade} / ${totalPicks}`);
  if (totalPicksMade >= totalPicks) {
    console.log("Draft is already complete!"); process.exit(0);
  }

  // ── Simulate remaining picks ─────────────────────────────────────────────────
  let pickNum = totalPicksMade;
  let simCount = 0;

  while (pickNum < totalPicks) {
    // Snake draft turn order
    const round = Math.floor(pickNum / numTeams);
    const slotInRound = pickNum % numTeams;
    const isEvenRound = round % 2 === 1;
    const teamIdx = isEvenRound ? numTeams - 1 - slotInRound : slotInRound;
    const team = teams[teamIdx];

    // Get already-drafted IDs
    const draftedRes = await db.query(
      `SELECT rp."mlbPlayerId" FROM "RosterPlayer" rp
       JOIN "Roster" r ON r.id = rp."rosterId"
       WHERE r."leagueId" = $1`,
      [leagueId]
    );
    const draftedIds = draftedRes.rows.map((r: { mlbPlayerId: number }) => r.mlbPlayerId);
    const notInClause = draftedIds.length > 0
      ? `AND id != ALL($1::int[])`
      : "";
    const params = draftedIds.length > 0 ? [draftedIds] : [];

    // Best available active player by careerIlDays
    const playerRes = await db.query(
      `SELECT id, "fullName", "careerIlDays", "careerSeasons"
       FROM "MlbPlayer"
       WHERE "currentIlStatus" = 'active' ${notInClause}
       ORDER BY "careerIlDays" DESC, "fullName" ASC
       LIMIT 1`,
      params
    );

    if (!playerRes.rows.length) {
      console.error("No players available!"); break;
    }
    const player = playerRes.rows[0];
    const avg = (player.careerIlDays / Math.max(1, player.careerSeasons)).toFixed(1);

    // Insert pick
    await db.query(
      `INSERT INTO "RosterPlayer" (id, "rosterId", "mlbPlayerId", "draftedAt")
       VALUES (gen_random_uuid(), $1, $2, NOW())`,
      [team.rosterId, player.id]
    );

    const pickLabel = `Pick ${pickNum + 1} (R${round + 1})`;
    console.log(`  ${pickLabel.padEnd(16)} ${team.username.padEnd(16)} → ${player.fullName} (${player.careerIlDays}d career, ${avg}d avg/yr)`);

    pickNum++;
    simCount++;
  }

  // ── Mark draft complete ───────────────────────────────────────────────────────
  await db.query(
    `UPDATE "League" SET status = 'active' WHERE id = $1`,
    [leagueId]
  );

  console.log(`\n✓ Simulated ${simCount} picks — draft complete! League is now active.`);

  // ── Print final rosters ───────────────────────────────────────────────────────
  console.log("\n=== Final Rosters ===");
  for (const team of teams) {
    const rosterRes = await db.query(
      `SELECT p."fullName", p."teamAbbr", p.position, p."careerIlDays", p."careerSeasons"
       FROM "RosterPlayer" rp
       JOIN "MlbPlayer" p ON p.id = rp."mlbPlayerId"
       WHERE rp."rosterId" = $1
       ORDER BY rp."draftedAt" ASC`,
      [team.rosterId]
    );
    const totalDays = rosterRes.rows.reduce((s: number, r: { careerIlDays: number }) => s + r.careerIlDays, 0);
    console.log(`\n  ${team.username} (${totalDays}d career IL total):`);
    rosterRes.rows.forEach((p: { fullName: string; teamAbbr: string; position: string; careerIlDays: number; careerSeasons: number }, i: number) => {
      const avg = (p.careerIlDays / Math.max(1, p.careerSeasons)).toFixed(1);
      console.log(`    ${String(i + 1).padStart(2)}. ${p.fullName.padEnd(24)} ${(p.teamAbbr ?? "—").padEnd(4)} ${(p.position ?? "—").padEnd(4)} ${String(p.careerIlDays).padStart(4)}d (${avg}d avg)`);
    });
  }

} catch (err) {
  console.error("Error:", err);
  process.exit(1);
} finally {
  await db.end();
}
