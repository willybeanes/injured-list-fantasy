-- CreateEnum
CREATE TYPE "DraftFormat" AS ENUM ('snake', 'auction');

-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('season_total', 'weekly_h2h');

-- CreateEnum
CREATE TYPE "LeagueStatus" AS ENUM ('upcoming', 'drafting', 'active', 'completed');

-- CreateEnum
CREATE TYPE "IlStatus" AS ENUM ('active', 'il10', 'il15', 'il60', 'dtd');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionerId" TEXT NOT NULL,
    "maxTeams" INTEGER NOT NULL DEFAULT 12,
    "rosterSize" INTEGER NOT NULL DEFAULT 10,
    "draftFormat" "DraftFormat" NOT NULL DEFAULT 'snake',
    "scoringType" "ScoringType" NOT NULL DEFAULT 'season_total',
    "inviteCode" TEXT NOT NULL,
    "status" "LeagueStatus" NOT NULL DEFAULT 'upcoming',
    "seasonYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roster" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalIlDays" INTEGER NOT NULL DEFAULT 0,
    "weeklyIlDays" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterPlayer" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "mlbPlayerId" INTEGER NOT NULL,
    "draftedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MlbPlayer" (
    "id" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "teamName" TEXT,
    "teamAbbr" TEXT,
    "position" TEXT,
    "currentIlStatus" "IlStatus" NOT NULL DEFAULT 'active',
    "seasonIlDays" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "MlbPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IlDayLog" (
    "id" TEXT NOT NULL,
    "mlbPlayerId" INTEGER NOT NULL,
    "logDate" DATE NOT NULL,
    "ilStatus" "IlStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IlDayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonYear" INTEGER NOT NULL,
    "totalIlDays" INTEGER NOT NULL DEFAULT 0,
    "globalRank" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "League_inviteCode_key" ON "League"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMember_leagueId_userId_key" ON "LeagueMember"("leagueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Roster_leagueId_userId_key" ON "Roster"("leagueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "IlDayLog_mlbPlayerId_logDate_key" ON "IlDayLog"("mlbPlayerId", "logDate");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalScore_userId_key" ON "GlobalScore"("userId");

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_commissionerId_fkey" FOREIGN KEY ("commissionerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterPlayer" ADD CONSTRAINT "RosterPlayer_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterPlayer" ADD CONSTRAINT "RosterPlayer_mlbPlayerId_fkey" FOREIGN KEY ("mlbPlayerId") REFERENCES "MlbPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IlDayLog" ADD CONSTRAINT "IlDayLog_mlbPlayerId_fkey" FOREIGN KEY ("mlbPlayerId") REFERENCES "MlbPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalScore" ADD CONSTRAINT "GlobalScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
