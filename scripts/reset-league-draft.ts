/**
 * Reset a league's draft so it can be re-drafted.
 * Usage: DATABASE_URL=... bun run scripts/reset-league-draft.ts "League Name"
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const leagueName = process.argv[2];
if (!leagueName) {
  console.error("Usage: bun run scripts/reset-league-draft.ts <league name>");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find the league
  const league = await prisma.league.findFirst({
    where: { name: leagueName },
    include: { _count: { select: { members: true } } },
  });

  if (!league) {
    console.error(`League "${leagueName}" not found.`);
    process.exit(1);
  }

  console.log(`Found league: ${league.name} (${league.id})`);
  console.log(`  Status: ${league.status}`);
  console.log(`  Members: ${league._count.members}`);

  // 1. Delete all drafted players from every roster in this league
  const rosters = await prisma.roster.findMany({ where: { leagueId: league.id } });
  const rosterIds = rosters.map((r) => r.id);

  const deleted = await prisma.rosterPlayer.deleteMany({
    where: { rosterId: { in: rosterIds } },
  });
  console.log(`  Deleted ${deleted.count} drafted player(s)`);

  // 2. Reset roster stats
  await prisma.roster.updateMany({
    where: { leagueId: league.id },
    data: { totalIlDays: 0, weeklyIlDays: 0, rank: null },
  });
  console.log(`  Reset ${rosters.length} roster(s)`);

  // 3. Reset league status + draft reminder flags
  await prisma.league.update({
    where: { id: league.id },
    data: {
      status: "upcoming",
      draftReminderSentAt: null,
      draftFinalReminderSentAt: null,
    },
  });
  console.log(`  League status reset to "upcoming"`);

  console.log(`\n✅ "${leagueName}" is ready to draft again!`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
