import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = "Injured List Fantasy <noreply@injuredlistfantasy.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function sendInjuryAlert({
  to,
  username,
  playerName,
  ilStatus,
}: {
  to: string;
  username: string;
  playerName: string;
  ilStatus: string;
}) {
  const ilLabel = ilStatus.replace("il", "IL-").replace("dtd", "Day-to-Day");
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `🚑 ${playerName} placed on ${ilLabel} — +1 pt/day`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            <div style="width:36px;height:36px;background:#dc2f1f;border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:18px;">🏥</span>
            </div>
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">Injury Alert</h1>
          <p style="color:#8892a4;margin:0 0 16px;">Hey ${username},</p>
          <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:16px;margin-bottom:16px;">
            <p style="margin:0;font-size:15px;font-weight:700;color:#edf0f5;">${playerName}</p>
            <p style="margin:4px 0 0;color:#dc2f1f;font-weight:600;">Placed on ${ilLabel}</p>
            <p style="margin:8px 0 0;color:#8892a4;font-size:13px;">+1 point per day added to your roster score</p>
          </div>
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:700;font-size:14px;">
            View Dashboard →
          </a>
          <p style="color:#505c6e;font-size:12px;margin-top:20px;">
            You're receiving this because you have ${playerName} on your Injured List Fantasy roster.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send injury alert:", err);
  }
}

export async function sendLeagueInvite({
  to,
  inviterUsername,
  leagueName,
  inviteCode,
}: {
  to: string;
  inviterUsername: string;
  leagueName: string;
  inviteCode: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `${inviterUsername} invited you to ${leagueName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">You're Invited!</h1>
          <p style="color:#8892a4;margin:0 0 16px;">
            <strong style="color:#edf0f5;">${inviterUsername}</strong> invited you to join
            <strong style="color:#edf0f5;">${leagueName}</strong> on Injured List Fantasy.
          </p>
          <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:16px;margin-bottom:16px;text-align:center;">
            <p style="color:#8892a4;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.1em;">Invite Code</p>
            <p style="font-size:28px;font-weight:800;letter-spacing:0.15em;color:#dc2f1f;margin:0;">${inviteCode}</p>
          </div>
          <a href="${APP_URL}/signup" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:700;font-size:14px;">
            Join the League →
          </a>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send league invite:", err);
  }
}

export async function sendLeagueInviteToExistingUser({
  to,
  inviterUsername,
  leagueName,
  acceptUrl,
}: {
  to: string;
  inviterUsername: string;
  leagueName: string;
  acceptUrl: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `${inviterUsername} invited you to ${leagueName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            <div style="width:36px;height:36px;background:#dc2f1f;border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:18px;">🩼</span>
            </div>
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">You&apos;re Invited!</h1>
          <p style="color:#8892a4;margin:0 0 16px;">
            <strong style="color:#edf0f5;">${inviterUsername}</strong> has invited you to join
            <strong style="color:#edf0f5;">${leagueName}</strong>.
          </p>
          <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="color:#8892a4;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">League</p>
            <p style="font-size:17px;font-weight:800;color:#edf0f5;margin:0;">${leagueName}</p>
            <p style="font-size:13px;color:#8892a4;margin:4px 0 0;">Invited by ${inviterUsername}</p>
          </div>
          <a href="${acceptUrl}" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:700;font-size:14px;">
            Accept Invitation →
          </a>
          <p style="color:#505c6e;font-size:12px;margin-top:20px;">
            This invite expires in 7 days. If you didn&apos;t expect this, you can ignore this email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send league invite (existing user):", err);
  }
}

export async function sendLeagueInviteToNewUser({
  to,
  inviterUsername,
  leagueName,
  signupUrl,
}: {
  to: string;
  inviterUsername: string;
  leagueName: string;
  signupUrl: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `${inviterUsername} invited you to ${leagueName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            <div style="width:36px;height:36px;background:#dc2f1f;border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:18px;">🩼</span>
            </div>
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">You&apos;re Invited!</h1>
          <p style="color:#8892a4;margin:0 0 16px;">
            <strong style="color:#edf0f5;">${inviterUsername}</strong> has invited you to join
            <strong style="color:#edf0f5;">${leagueName}</strong> on Injured List Fantasy.
          </p>
          <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="color:#8892a4;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">League</p>
            <p style="font-size:17px;font-weight:800;color:#edf0f5;margin:0;">${leagueName}</p>
            <p style="font-size:13px;color:#8892a4;margin:4px 0 0;">Invited by ${inviterUsername}</p>
          </div>
          <p style="color:#8892a4;margin:0 0 16px;font-size:14px;">
            Create a free account to accept this invitation and join the league.
          </p>
          <a href="${signupUrl}" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:700;font-size:14px;">
            Create Account &amp; Join →
          </a>
          <p style="color:#505c6e;font-size:12px;margin-top:20px;">
            This invite expires in 7 days. If you didn&apos;t expect this, you can ignore this email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send league invite (new user):", err);
  }
}

export async function sendDraftReminder({
  to,
  username,
  leagueName,
  leagueId,
  draftAt,
}: {
  to: string;
  username: string;
  leagueName: string;
  leagueId: string;
  draftAt: Date;
}) {
  const timeStr = draftAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `⏰ Draft starts in 2 hours — ${leagueName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            <div style="width:36px;height:36px;background:#dc2f1f;border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:18px;">⏰</span>
            </div>
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">Your Draft Starts in 2 Hours</h1>
          <p style="color:#8892a4;margin:0 0 16px;">Hey ${username}, get ready!</p>
          <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="color:#8892a4;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">League</p>
            <p style="font-size:17px;font-weight:800;color:#edf0f5;margin:0;">${leagueName}</p>
            <p style="font-size:13px;color:#dc2f1f;font-weight:600;margin:6px 0 0;">Draft at ${timeStr}</p>
          </div>
          <a href="${APP_URL}/draft/${leagueId}" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:700;font-size:14px;">
            Go to Draft Room →
          </a>
          <p style="color:#505c6e;font-size:12px;margin-top:20px;">
            The draft room opens 5 minutes before the scheduled time.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send draft reminder:", err);
  }
}

export async function sendDraftFinalReminder({
  to,
  username,
  leagueName,
  leagueId,
}: {
  to: string;
  username: string;
  leagueName: string;
  leagueId: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `🚨 Your draft is starting now — ${leagueName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            <div style="width:36px;height:36px;background:#dc2f1f;border-radius:8px;display:flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:18px;">🚨</span>
            </div>
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">Your Draft Is Starting Now!</h1>
          <p style="color:#8892a4;margin:0 0 16px;">Hey ${username}, the draft room is open — get in there!</p>
          <div style="background:#191d26;border:1px solid #dc2f1f;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="color:#8892a4;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">League</p>
            <p style="font-size:17px;font-weight:800;color:#edf0f5;margin:0;">${leagueName}</p>
            <p style="font-size:13px;color:#dc2f1f;font-weight:700;margin:6px 0 0;">🔴 Live now</p>
          </div>
          <a href="${APP_URL}/draft/${leagueId}" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:700;font-size:14px;">
            Enter Draft Room →
          </a>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send draft final reminder:", err);
  }
}

export async function sendWeeklySummary({
  to,
  username,
  weeklyIlDays,
  leagueRank,
  leagueName,
  totalIlDays,
}: {
  to: string;
  username: string;
  weeklyIlDays: number;
  leagueRank: number | null;
  leagueName: string;
  totalIlDays: number;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Your weekly summary: ${weeklyIlDays} IL days earned`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">Weekly Summary</h1>
          <p style="color:#8892a4;margin:0 0 16px;">Hey ${username}, here's how last week went:</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:14px;">
              <p style="color:#8892a4;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px;">This Week</p>
              <p style="font-size:24px;font-weight:800;color:#dc2f1f;margin:0;">${weeklyIlDays}d</p>
              <p style="font-size:12px;color:#8892a4;margin:4px 0 0;">IL days earned</p>
            </div>
            <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:14px;">
              <p style="color:#8892a4;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px;">League Rank</p>
              <p style="font-size:24px;font-weight:800;color:#edf0f5;margin:0;">${leagueRank ? `#${leagueRank}` : "—"}</p>
              <p style="font-size:12px;color:#8892a4;margin:4px 0 0;">${leagueName}</p>
            </div>
          </div>
          <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:14px;margin-bottom:16px;">
            <p style="color:#8892a4;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px;">Season Total</p>
            <p style="font-size:24px;font-weight:800;color:#edf0f5;margin:0;">${totalIlDays}d</p>
          </div>
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:700;font-size:14px;">
            View Full Dashboard →
          </a>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send weekly summary:", err);
  }
}
