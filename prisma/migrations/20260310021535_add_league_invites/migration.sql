-- AlterTable
ALTER TABLE "Roster" ADD COLUMN     "teamName" TEXT;

-- CreateTable
CREATE TABLE "LeagueInvite" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueInvite_token_key" ON "LeagueInvite"("token");

-- CreateIndex
CREATE INDEX "LeagueInvite_token_idx" ON "LeagueInvite"("token");

-- CreateIndex
CREATE INDEX "LeagueInvite_email_idx" ON "LeagueInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueInvite_leagueId_email_key" ON "LeagueInvite"("leagueId", "email");

-- AddForeignKey
ALTER TABLE "LeagueInvite" ADD CONSTRAINT "LeagueInvite_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueInvite" ADD CONSTRAINT "LeagueInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
