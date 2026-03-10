# Email Invite Feature Plan

## Summary
Two decisions confirmed:
- Pending invites do NOT hold spots (first-come first-served)
- Team names are optional; username shown as fallback

---

## 1. Schema Changes (`prisma/schema.prisma`)

### A. Add `teamName` to `Roster`
```prisma
teamName    String?   // optional, shown in standings instead of username if set
```

### B. Add `LeagueInvite` model
```prisma
model LeagueInvite {
  id          String   @id @default(uuid())
  leagueId    String
  league      League   @relation(fields: [leagueId], references: [id], onDelete: Cascade)
  email       String                        // the invited email address
  token       String   @unique             // crypto.randomUUID() — used in accept URL
  status      String   @default("pending") // "pending" | "accepted"
  invitedById String
  invitedBy   User     @relation("SentInvites", fields: [invitedById], references: [id])
  createdAt   DateTime @default(now())
  expiresAt   DateTime                     // createdAt + 7 days

  @@unique([leagueId, email])   // can't invite same email twice to same league
  @@index([token])
  @@index([email])
}
```

### C. Add relations to `User` and `League`
- `User`: add `sentInvites LeagueInvite[] @relation("SentInvites")`
- `League`: add `invites LeagueInvite[]`

Migration command: `DATABASE_URL=... bunx prisma migrate dev --name add-league-invites`

---

## 2. New Email Functions (`lib/email.ts`)

### `sendLeagueInviteToExistingUser({ to, inviterUsername, leagueName, acceptUrl })`
- Subject: `{inviterUsername} invited you to {leagueName}`
- Body: league info card + **"Accept Invitation →"** button pointing to `acceptUrl`
- `acceptUrl` = `{APP_URL}/invites/{token}`

### `sendLeagueInviteToNewUser({ to, inviterUsername, leagueName, signupUrl })`
- Same subject/style
- Body: league info card + **"Create Account & Join →"** button pointing to `signupUrl`
- `signupUrl` = `{APP_URL}/signup?invite={token}`

---

## 3. New API Routes

### `app/api/leagues/[leagueId]/invite/route.ts`

**POST** — Commissioner sends an email invite
- Auth required; must be commissioner; league must be `upcoming`
- Body: `{ email: string }`
- Validate email format
- Check email is not already a `LeagueMember`
- Check no non-expired `pending` invite already exists for this email + league
- Create `LeagueInvite` with token = `randomUUID()`, expiresAt = now + 7 days
- Look up `User` by email → if found: `sendLeagueInviteToExistingUser`; else: `sendLeagueInviteToNewUser`
- Return `{ ok: true, existingUser: boolean }`

**GET** — Commissioner lists pending invites for this league
- Auth required; must be commissioner
- Returns pending (non-expired) `LeagueInvite[]` for the league
- Fields: `id`, `email`, `createdAt`, `expiresAt`, `status`

### `app/api/invites/[token]/route.ts`

**GET** — Public; get invite info by token (no auth required)
- Find `LeagueInvite` by token (include league name + commissioner username)
- Return `{ leagueName, commissionerUsername, email, status, expired: expiresAt < now }`
- 404 if not found

### `app/api/invites/[token]/accept/route.ts`

**POST** — Accept an invite (auth required)
- Body: `{ teamName?: string }`
- Find invite by token; validate: pending + not expired
- Validate logged-in user's email matches invite email (case-insensitive)
- Check league is still `upcoming` and not full
- Check not already a member
- In transaction: create `LeagueMember` + `Roster` (with teamName if provided), mark invite `accepted`
- Return `{ leagueId }`

---

## 4. Update Existing Routes

### `app/api/leagues/join/route.ts`
- Accept optional `teamName` field in request body
- Pass `teamName` when creating Roster record

---

## 5. Middleware (`middleware.ts`)
- Add `/invites` prefix to public routes so the acceptance page is accessible without login:
```typescript
const PUBLIC_ROUTES = ["/", "/login", "/signup"];
// Change the check to also allow /invites/:
if (!user && !PUBLIC_ROUTES.includes(pathname) && !pathname.startsWith("/invites") && !pathname.startsWith("/api")) {
```

---

## 6. New Frontend Page: `/app/invites/[token]/page.tsx`
Standalone page (outside `(app)` route group, so no sidebar).

**States:**
1. **Loading** — fetching invite info
2. **Invalid/expired** — "This invite is no longer valid"
3. **Not logged in** — show invite card (league name, commissioner) + two buttons:
   - "Log in to accept" → `/login?redirect=/invites/{token}`
   - "Create account" → `/signup?invite={token}`
4. **Logged in, email mismatch** — "This invite was sent to {masked email}. Please log in with that account."
5. **Logged in, already accepted** — "You're already in this league." + link to league
6. **Logged in, ready to accept** — invite card + optional team name input + "Accept Invitation" button
7. **Accepted** — success state + "Go to League" button → `/leagues/{leagueId}`

The page fetches `GET /api/invites/[token]` (public), then if user is logged in calls `POST /api/invites/[token]/accept` on button click.

---

## 7. Modify Signup Page (`app/(auth)/signup/page.tsx`)
- Read `?invite` search param from URL
- If `invite` param present:
  - Pass it through `emailRedirectTo`: `/api/auth/callback?redirect=/invites/{token}`
  - After successful signup with immediate session: `router.push('/invites/{token}')` instead of `/dashboard`

---

## 8. League Page (`app/(app)/leagues/[leagueId]/page.tsx`)

### A. "Invite" button in Topbar actions (commissioner + upcoming only)
- Opens `InviteByEmailModal`
- Sits alongside the existing invite code button

### B. `InviteByEmailModal` component (at bottom of file)
- Email input + "Send Invite" button
- Shows pending invites list below (fetched from `GET /api/leagues/[leagueId]/invite`)
- Pending invite rows show email + "Invited" badge + expiry
- Success/error feedback inline

### C. Pending invites section in league page body (upcoming only)
- Below the stats cards: show a "Pending Invites" card if there are any pending
- Lists invited emails with "Invited" badge (only commissioner sees this)

### D. Team name in standings
- Update standings table to show `roster.teamName ?? roster.user.username`
- Show `@username` as a sub-line if teamName is set
- Roster API response needs to include `teamName`

---

## 9. Leagues Page Join Flow (`app/(app)/leagues/page.tsx`)
- After successful join via invite code, show a team name modal before redirecting to the league
- Optional → "Skip" dismisses and goes to league page, or sets the name

---

## File Creation/Modification Summary

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `LeagueInvite` model + `teamName` on Roster |
| `lib/email.ts` | Add 2 new email functions |
| `app/api/leagues/[leagueId]/invite/route.ts` | **NEW** — POST + GET |
| `app/api/invites/[token]/route.ts` | **NEW** — GET (public invite info) |
| `app/api/invites/[token]/accept/route.ts` | **NEW** — POST (accept) |
| `app/invites/[token]/page.tsx` | **NEW** — acceptance page |
| `middleware.ts` | Add `/invites` to public routes |
| `app/api/leagues/join/route.ts` | Add `teamName` support |
| `app/(auth)/signup/page.tsx` | Handle `?invite` param |
| `app/(app)/leagues/[leagueId]/page.tsx` | Invite modal + pending list + team name display |
| `app/(app)/leagues/page.tsx` | Team name prompt after join |
