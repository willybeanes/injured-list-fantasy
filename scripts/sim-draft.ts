/**
 * scripts/sim-draft.ts
 * Simulates the remaining draft picks for all non-commissioner teams.
 *
 * Usage:
 *   DATABASE_URL=... ~/.bun/bin/bun run scripts/sim-draft.ts <leagueId>
 */

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter } as any);

const leagueId = process.argv[2];
if (!leagueId) {
  console.error("Usage: DATABASE_URL=... bun run scripts/sim-draft.ts <leagueId>");
  process.exit(1);
}

async function main() {
  // 1. Load league + members in join order
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      members: {
        orderBy: { joinedAt: "asc" },
        include: { user: { select: { id: true, username: true } } },
      },
    },
  });

  if (!league) {
    console.error(`League ${leagueId} not found`);
    process.exit(1);
  }

  if (league.status !== "drafting") {
    console.error(`League status is "${league.status}", expected "drafting"`);
    process.exit(1);
  }

  const teams = league.members.map((m) => m.user);
  const numTeams = teams.length;
  const rosterSize = league.rosterSize;
  const totalPicksAllowed = numTeams * rosterSize;
  const commissionerId = league.commissionerId;

  console.log(`\nLeague: ${league.name}`);
  console.log(`Teams (${numTeams}) in draft order:`);
  teams.forEach((t, i) =>
    console.log(`  [${i}] ${t.username}${t.id === commissionerId ? " (commissioner — skipping)" : ""}`)
  );
  console.log(`Roster size: ${rosterSize}  |  Total picks: ${totalPicksAllowed}`);

  // 2. Get rosters
  const rosters = await prisma.roster.findMany({
    where: { leagueId },
    include: {
      players: { select: { mlbPlayerId: true } },
      _count: { select: { players: true } },
    },
  });

  const rosterByUserId = new Map(rosters.map((r) => [r.userId, r]));
  const totalPicksMade = rosters.reduce((sum, r) => sum + r._count.players, 0);

  console.log(`\nPicks already made: ${totalPicksMade} / ${totalPicksAllowed}`);

  if (totalPicksMade >= totalPicksAllowed) {
    console.log("Draft is already complete!");
    await prisma.$disconnect();
    process.exit(0);
  }

  // 3. Get already-drafted player IDs
  const draftedIds = rosters.flatMap((r) => r.players.map((p) => p.mlbPlayerId));

  // 4. Get available players sorted by seasonIlDays desc
  const availablePlayers = await prisma.mlbPlayer.findMany({
    where: { id: { notIn: draftedIds.length > 0 ? draftedIds : [-1] } },
    orderBy: [{ seasonIlDays: "desc" }, { fullName: "asc" }],
  });

  console.log(`Available players: ${availablePlayers.length}`);

  if (availablePlayers.length === 0) {
    console.error("No players available to draft!");
    await prisma.$disconnect();
    process.exit(1);
  }

  // 5. Walk through remaining picks in snake draft order
  const playerQueue = [...availablePlayers];
  let picksSimulated = 0;
  let totalInserted = 0;

  console.log("\n--- Simulating picks ---");

  for (let pickNum = totalPicksMade; pickNum < totalPicksAllowed; pickNum++) {
    const round = Math.floor(pickNum / numTeams);
    const slotInRound = pickNum % numTeams;
    const isReverseRound = round % 2 === 1; // odd rounds go in reverse (snake)
    const teamIndex = isReverseRound ? numTeams - 1 - slotInRound : slotInRound;
    const currentUser = teams[teamIndex];

    // Skip commissioner's turns — they pick themselves via the UI
    if (currentUser.id === commissionerId) {
      console.log(
        `  Pick ${pickNum + 1} | Rd ${round + 1} | [${teamIndex}] ${currentUser.username.padEnd(14)} → (commissioner — leave for UI)`
      );
      picksSimulated++;
      continue;
    }

    if (playerQueue.length === 0) {
      console.warn(`  ⚠️  Ran out of players at pick ${pickNum + 1}!`);
      break;
    }

    const player = playerQueue.shift()!;
    const roster = rosterByUserId.get(currentUser.id);

    if (!roster) {
      console.error(`  ❌ No roster found for ${currentUser.username}`);
      continue;
    }

    await prisma.rosterPlayer.create({
      data: { rosterId: roster.id, mlbPlayerId: player.id },
    });

    console.log(
      `  Pick ${pickNum + 1} | Rd ${round + 1} | [${teamIndex}] ${currentUser.username.padEnd(14)} → ${player.fullName} (${player.seasonIlDays} IL days)`
    );

    picksSimulated++;
    totalInserted++;
  }

  // 6. Check if fully complete
  const newTotal = totalPicksMade + totalInserted;
  const allPicksDone = newTotal >= totalPicksAllowed;

  if (allPicksDone) {
    await prisma.league.update({
      where: { id: leagueId },
      data: { status: "active" },
    });
    console.log("\n✅ All picks made — league status set to active");
  } else {
    console.log(
      `\n⏳ Commissioner has ${totalPicksAllowed - newTotal} picks remaining in the draft UI`
    );
  }

  console.log(`\n✓ Simulated ${totalInserted} picks for test users.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
