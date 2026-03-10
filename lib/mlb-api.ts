/**
 * MLB Stats API integration
 * Base: https://statsapi.mlb.com/api/v1
 * No API key required. Cache responses for at least 1 hour.
 */

const BASE_URL = "https://statsapi.mlb.com/api/v1";

const ONE_HOUR = 3600;

interface MlbInjury {
  player: {
    id: number;
    fullName: string;
  };
  team: {
    id: number;
    name: string;
    abbreviation?: string;
  };
  status: string; // "10-Day IL", "15-Day IL", "60-Day IL", "Day-to-Day", etc.
  ininjuredListType?: string;
}


interface MlbPlayer {
  id: number;
  fullName: string;
  primaryPosition?: { abbreviation: string };
  currentTeam?: { id: number; name: string; abbreviation?: string };
}

/** Map MLB injury status string to our IlStatus enum */
export function mapMlbStatusToIlStatus(
  status: string
): "active" | "il10" | "il15" | "il60" | "dtd" {
  const s = status.toLowerCase();
  if (s.includes("60")) return "il60";
  if (s.includes("15")) return "il15";
  if (s.includes("10")) return "il10";
  if (s.includes("day-to-day") || s.includes("dtd")) return "dtd";
  return "active";
}

/** Map 40-man roster status code to a human-readable IL string */
function rosterStatusToIlString(code: string): string | null {
  switch (code) {
    case "D10": return "10-Day IL";
    case "D15": return "15-Day IL";
    case "D60": return "60-Day IL";
    case "DTD": return "Day-to-Day";
    default: return null;
  }
}

export interface AllRosterEntry {
  player: { id: number; fullName: string };
  team: { id: number; name: string; abbreviation: string };
  ilStatus: "active" | "il10" | "il15" | "il60" | "dtd";
  position?: string;
  age?: number;
  birthDate?: string;
}

/**
 * Fetch every player on every MLB team's 40-man roster, returning their
 * current IL status ("active" if healthy). Used by the sync cron so that
 * healthy players are seeded into the DB as draft-eligible picks.
 * Uses hydrate=person to also capture age and birthDate.
 */
export async function fetchAllRosterPlayers(): Promise<AllRosterEntry[]> {
  try {
    const teamsRes = await fetch(`${BASE_URL}/teams?sportId=1`, {
      next: { revalidate: ONE_HOUR * 24 },
    });
    if (!teamsRes.ok) {
      console.error(`MLB API teams endpoint returned ${teamsRes.status}`);
      return [];
    }
    const teamsData = await teamsRes.json();
    const teams: Array<{ id: number; name: string; abbreviation: string }> =
      teamsData.teams ?? [];

    const allPlayers: AllRosterEntry[] = [];

    await Promise.all(
      teams.map(async (team) => {
        try {
          const rosterRes = await fetch(
            `${BASE_URL}/teams/${team.id}/roster?rosterType=40Man&hydrate=person`,
            { next: { revalidate: ONE_HOUR } }
          );
          if (!rosterRes.ok) return;
          const rosterData = await rosterRes.json();
          const roster: Array<{
            person: {
              id: number;
              fullName: string;
              currentAge?: number;
              birthDate?: string;
            };
            status: { code: string; description: string };
            position?: { abbreviation: string };
          }> = rosterData.roster ?? [];

          for (const entry of roster) {
            const ilString = rosterStatusToIlString(entry.status?.code);
            allPlayers.push({
              player: { id: entry.person.id, fullName: entry.person.fullName },
              team: { id: team.id, name: team.name, abbreviation: team.abbreviation },
              ilStatus: ilString ? mapMlbStatusToIlStatus(ilString) : "active",
              position: entry.position?.abbreviation,
              age: entry.person.currentAge,
              birthDate: entry.person.birthDate,
            });
          }
        } catch {
          // Skip teams that fail
        }
      })
    );

    return allPlayers;
  } catch (err) {
    console.error("Failed to fetch roster players:", err);
    return [];
  }
}

/** Fetch all players currently on any IL (subset of fetchAllRosterPlayers) */
export async function fetchCurrentInjuries(): Promise<MlbInjury[]> {
  const all = await fetchAllRosterPlayers();
  return all
    .filter((e) => e.ilStatus !== "active")
    .map((e) => ({
      player: e.player,
      team: { id: 0, name: e.team.name, abbreviation: e.team.abbreviation },
      status:
        e.ilStatus === "il60" ? "60-Day IL" :
        e.ilStatus === "il15" ? "15-Day IL" :
        e.ilStatus === "il10" ? "10-Day IL" : "Day-to-Day",
    }));
}

/** Fetch roster for a specific team to get player details */
export async function fetchTeamRoster(teamId: number): Promise<MlbPlayer[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/teams/${teamId}/roster?rosterType=active`,
      { next: { revalidate: ONE_HOUR } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.roster?.map((r: { person: MlbPlayer }) => r.person) ?? [];
  } catch {
    return [];
  }
}

/** Search players by name */
export async function searchPlayers(query: string): Promise<MlbPlayer[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/people/search?names=${encodeURIComponent(query)}&sportId=1`,
      { next: { revalidate: ONE_HOUR } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.people ?? [];
  } catch {
    return [];
  }
}

/** Fetch all MLB teams */
export async function fetchAllTeams() {
  try {
    const res = await fetch(`${BASE_URL}/teams?sportId=1`, {
      next: { revalidate: ONE_HOUR * 24 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.teams ?? [];
  } catch {
    return [];
  }
}

/** Fetch a player's injury history for a season */
export async function fetchPlayerInjuryHistory(
  playerId: number,
  season: number
) {
  try {
    const res = await fetch(
      `${BASE_URL}/people/${playerId}?hydrate=transactions&season=${season}`,
      { next: { revalidate: ONE_HOUR } }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
