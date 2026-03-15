CREATE TABLE "BlockedEmail" (
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "BlockedEmail_pkey" PRIMARY KEY ("email")
);
