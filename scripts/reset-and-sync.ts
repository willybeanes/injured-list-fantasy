/**
 * Dev-only script: reset any in-progress drafts back to "upcoming",
 * then sync all 40-man roster players from the MLB API into the database.
 *
 * Run with:
 *   DATABASE_URL=... ~/.bun/bin/bun run scripts/reset-and-sync.ts
 */

import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL env var");
  process.exit(1);
}

const BASE_URL = "https://statsapi.mlb.com/api/v1";

// ─── MLB API helpers ──────────────────────────────────────────────────────────

function rosterStatusToIlStatus(code: string): string {
  switch (code) {
    case "D10": return "il10";
    case "D15": return "il15";
    case "D60": return "il60";
    case "DTD": return "dtd";
    default:    return "active";
  }
}

interface RosterEntry {
  playerId: number;
  fullName: string;
  teamName: string;
  teamAbbr: string;
  position: string | null;
  ilStatus: string;
  age: number | null;
  birthDate: string | null;
}

async function fetchAllPlayers(): Promise<RosterEntry[]> {
  console.log("Fetching MLB teams...");
  const teamsRes = await fetch(`${BASE_URL}/teams?sportId=1`);
  if (!teamsRes.ok) throw new Error(`Teams fetch failed: ${teamsRes.status}`);
  const teamsData = await teamsRes.json();
  const teams: Array<{ id: number; name: string; abbreviation: string }> = teamsData.teams ?? [];
  console.log(`Got ${teams.length} MLB teams`);

  const allPlayers: RosterEntry[] = [];

  await Promise.all(
    teams.map(async (team) => {
      try {
        const rosterRes = await fetch(`${BASE_URL}/teams/${team.id}/roster?rosterType=40Man&hydrate=person`);
        if (!rosterRes.ok) return;
        const rosterData = await rosterRes.json();
        const roster: Array<{
          person: { id: number; fullName: string; currentAge?: number; birthDate?: string };
          status: { code: string };
          position?: { abbreviation: string };
        }> = rosterData.roster ?? [];

        for (const entry of roster) {
          allPlayers.push({
            playerId: entry.person.id,
            fullName: entry.person.fullName,
            teamName: team.name,
            teamAbbr: team.abbreviation,
            position: entry.position?.abbreviation ?? null,
            ilStatus: rosterStatusToIlStatus(entry.status?.code),
            age: entry.person.currentAge ?? null,
            birthDate: entry.person.birthDate ?? null,
          });
        }
      } catch {
        // skip teams that fail
      }
    })
  );

  return allPlayers;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const db = new Client({ connectionString: DATABASE_URL });

try {
  await db.connect();
  console.log("Connected to database\n");

  // ── 1. Reset drafting leagues back to upcoming ────────────────────────────
  const draftingRes = await db.query(
    `SELECT id, name FROM "League" WHERE status = 'drafting'`
  );
  const draftingLeagues = draftingRes.rows;

  if (draftingLeagues.length === 0) {
    console.log("No leagues currently in 'drafting' state — nothing to reset.\n");
  } else {
    console.log(`Found ${draftingLeagues.length} drafting league(s): ${draftingLeagues.map((l: { name: string }) => l.name).join(", ")}`);

    for (const league of draftingLeagues) {
      // Delete all roster picks for this league's rosters
      const deleteRes = await db.query(
        `DELETE FROM "RosterPlayer"
         WHERE "rosterId" IN (
           SELECT id FROM "Roster" WHERE "leagueId" = $1
         )`,
        [league.id]
      );
      console.log(`  Deleted ${deleteRes.rowCount} draft picks from "${league.name}"`);

      // Reset roster stats
      await db.query(
        `UPDATE "Roster"
         SET "totalIlDays" = 0, "weeklyIlDays" = 0, rank = NULL
         WHERE "leagueId" = $1`,
        [league.id]
      );

      // Reset league status to upcoming
      await db.query(
        `UPDATE "League" SET status = 'upcoming' WHERE id = $1`,
        [league.id]
      );
      console.log(`  Reset "${league.name}" → upcoming\n`);
    }
  }

  // ── 2. Sync all 40-man roster players from MLB API ───────────────────────
  console.log("Fetching all 40-man roster players from MLB API...");
  const players = await fetchAllPlayers();
  console.log(`Fetched ${players.length} players\n`);

  const ilStatuses = ["il10", "il15", "il60", "dtd"];
  let upserted = 0;
  let ilCount = 0;

  for (const p of players) {
    await db.query(
      `INSERT INTO "MlbPlayer" (id, "fullName", "teamName", "teamAbbr", position, "currentIlStatus", "seasonIlDays", age, "birthDate", "lastSyncedAt")
       VALUES ($1, $2, $3, $4, $5, $6::\"IlStatus\", 0, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         "fullName"        = EXCLUDED."fullName",
         "teamName"        = EXCLUDED."teamName",
         "teamAbbr"        = EXCLUDED."teamAbbr",
         position          = EXCLUDED.position,
         "currentIlStatus" = EXCLUDED."currentIlStatus",
         age               = EXCLUDED.age,
         "birthDate"       = EXCLUDED."birthDate",
         "lastSyncedAt"    = NOW()`,
      [p.playerId, p.fullName, p.teamName, p.teamAbbr, p.position, p.ilStatus, p.age, p.birthDate]
    );
    upserted++;
    if (ilStatuses.includes(p.ilStatus)) ilCount++;
  }

  console.log(`✓ Upserted ${upserted} players (${ilCount} on IL, ${upserted - ilCount} active)\n`);

  // ── 3. Summary ────────────────────────────────────────────────────────────
  const totalRes = await db.query(`SELECT COUNT(*) FROM "MlbPlayer"`);
  const activeRes = await db.query(`SELECT COUNT(*) FROM "MlbPlayer" WHERE "currentIlStatus" = 'active'`);
  console.log(`Database now has ${totalRes.rows[0].count} total players (${activeRes.rows[0].count} active/draft-eligible)`);
  console.log("\nDone! You can now start a fresh draft.");

} catch (err) {
  console.error("Error:", err);
  process.exit(1);
} finally {
  await db.end();
}
