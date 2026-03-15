import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = "Injured List Fantasy <noreply@injuredlistfantasy.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function logoImg() {
  return `<img src="${APP_URL}/email-icon.png" width="36" height="36" alt="Injured List Fantasy" style="display:block;border-radius:8px;">`;
}

function unsubscribeUrl(userId: string) {
  return `${APP_URL}/unsubscribe?uid=${userId}`;
}

function unsubscribeUrlByToken(token: string) {
  return `${APP_URL}/unsubscribe?token=${token}`;
}

function unsubscribeFooterHtml(userId: string) {
  return `<p style="color:#505c6e;font-size:11px;margin-top:24px;border-top:1px solid #1e2533;padding-top:12px;">
    Don't want these emails? <a href="${unsubscribeUrl(userId)}" style="color:#505c6e;">Unsubscribe</a>
  </p>`;
}

function unsubscribeFooterHtmlByToken(token: string) {
  return `<p style="color:#505c6e;font-size:11px;margin-top:24px;border-top:1px solid #1e2533;padding-top:12px;">
    Don't want these emails? <a href="${unsubscribeUrlByToken(token)}" style="color:#505c6e;">Unsubscribe</a>
  </p>`;
}

function unsubscribeFooterText(userId: string) {
  return `\n\nTo unsubscribe from all emails: ${unsubscribeUrl(userId)}`;
}

function unsubscribeFooterTextByToken(token: string) {
  return `\n\nTo unsubscribe from all emails: ${unsubscribeUrlByToken(token)}`;
}

export async function sendInjuryAlert({
  to,
  userId,
  username,
  playerName,
  ilStatus,
}: {
  to: string;
  userId: string;
  username: string;
  playerName: string;
  ilStatus: string;
}) {
  const ilLabel = ilStatus.replace("il", "IL-").replace("dtd", "Day-to-Day");
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Injury Alert: ${playerName} placed on ${ilLabel}`,
      text: `Hey ${username},\n\n${playerName} has been placed on the ${ilLabel}. This adds +1 point per day to your roster score.\n\nView your dashboard: ${APP_URL}/dashboard\n\nYou're receiving this because you have ${playerName} on your Injured List Fantasy roster.${unsubscribeFooterText(userId)}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            ${logoImg()}
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
            View Dashboard
          </a>
          <p style="color:#505c6e;font-size:12px;margin-top:20px;">
            You're receiving this because you have ${playerName} on your Injured List Fantasy roster.
          </p>
          ${unsubscribeFooterHtml(userId)}
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
  // Sent to non-users — no unsubscribe link needed
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `${inviterUsername} invited you to join ${leagueName}`,
      text: `You've been invited!\n\n${inviterUsername} has invited you to join ${leagueName} on Injured List Fantasy.\n\nYour invite code: ${inviteCode}\n\nCreate a free account to join: ${APP_URL}/signup`,
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
            Join the League
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
  userId,
  inviterUsername,
  leagueName,
  acceptUrl,
}: {
  to: string;
  userId: string;
  inviterUsername: string;
  leagueName: string;
  acceptUrl: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `${inviterUsername} invited you to join ${leagueName}`,
      text: `You're invited!\n\n${inviterUsername} has invited you to join ${leagueName} on Injured List Fantasy.\n\nAccept your invitation: ${acceptUrl}\n\nThis invite expires in 7 days. If you didn't expect this, you can ignore this email.${unsubscribeFooterText(userId)}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            ${logoImg()}
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
            Accept Invitation
          </a>
          <p style="color:#505c6e;font-size:12px;margin-top:20px;">
            This invite expires in 7 days. If you didn&apos;t expect this, you can ignore this email.
          </p>
          ${unsubscribeFooterHtml(userId)}
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
  unsubToken,
}: {
  to: string;
  inviterUsername: string;
  leagueName: string;
  signupUrl: string;
  unsubToken: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `${inviterUsername} invited you to join ${leagueName}`,
      text: `You're invited!\n\n${inviterUsername} has invited you to join ${leagueName} on Injured List Fantasy.\n\nCreate a free account to accept this invitation and join the league:\n${signupUrl}\n\nThis invite expires in 7 days. If you didn't expect this, you can ignore this email.${unsubscribeFooterTextByToken(unsubToken)}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            ${logoImg()}
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
            Create Account &amp; Join
          </a>
          <p style="color:#505c6e;font-size:12px;margin-top:20px;">
            This invite expires in 7 days. If you didn&apos;t expect this, you can ignore this email.
          </p>
          ${unsubscribeFooterHtmlByToken(unsubToken)}
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send league invite (new user):", err);
  }
}

export async function sendDraftReminder({
  to,
  userId,
  username,
  leagueName,
  leagueId,
  draftAt,
}: {
  to: string;
  userId: string;
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
      subject: `Draft reminder: ${leagueName} starts in 2 hours`,
      text: `Hey ${username},\n\nYour draft for ${leagueName} starts in 2 hours at ${timeStr}.\n\nThe draft room opens 5 minutes before the scheduled time.\n\nGo to draft room: ${APP_URL}/draft/${leagueId}${unsubscribeFooterText(userId)}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            ${logoImg()}
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
            Go to Draft Room
          </a>
          <p style="color:#505c6e;font-size:12px;margin-top:20px;">
            The draft room opens 5 minutes before the scheduled time.
          </p>
          ${unsubscribeFooterHtml(userId)}
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send draft reminder:", err);
  }
}

export async function sendDraftFinalReminder({
  to,
  userId,
  username,
  leagueName,
  leagueId,
}: {
  to: string;
  userId: string;
  username: string;
  leagueName: string;
  leagueId: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Your draft is starting now — ${leagueName}`,
      text: `Hey ${username},\n\nThe draft room for ${leagueName} is open now — get in there!\n\nEnter the draft room: ${APP_URL}/draft/${leagueId}${unsubscribeFooterText(userId)}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            ${logoImg()}
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">Your Draft Is Starting Now!</h1>
          <p style="color:#8892a4;margin:0 0 16px;">Hey ${username}, the draft room is open — get in there!</p>
          <div style="background:#191d26;border:1px solid #dc2f1f;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="color:#8892a4;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">League</p>
            <p style="font-size:17px;font-weight:800;color:#edf0f5;margin:0;">${leagueName}</p>
            <p style="font-size:13px;color:#dc2f1f;font-weight:700;margin:6px 0 0;">Live now</p>
          </div>
          <a href="${APP_URL}/draft/${leagueId}" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:700;font-size:14px;">
            Enter Draft Room
          </a>
          ${unsubscribeFooterHtml(userId)}
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send draft final reminder:", err);
  }
}

export async function sendDraftStartingEmail({
  to,
  userId,
  username,
  leagueName,
  leagueId,
}: {
  to: string;
  userId: string;
  username: string;
  leagueName: string;
  leagueId: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Draft starting in 5 minutes — ${leagueName}`,
      text: `Hey ${username},\n\nYour commissioner has started the draft countdown for ${leagueName}. The draft begins in 5 minutes!\n\nEnter the draft room: ${APP_URL}/draft/${leagueId}${unsubscribeFooterText(userId)}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            ${logoImg()}
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">Draft Starting in 5 Minutes!</h1>
          <p style="color:#8892a4;margin:0 0 16px;">Hey ${username}, your commissioner has started the draft countdown — get in the room!</p>
          <div style="background:#191d26;border:1px solid #dc2f1f;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="color:#8892a4;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">League</p>
            <p style="font-size:17px;font-weight:800;color:#edf0f5;margin:0;">${leagueName}</p>
            <p style="font-size:13px;color:#dc2f1f;font-weight:700;margin:6px 0 0;">Countdown is live</p>
          </div>
          <a href="${APP_URL}/draft/${leagueId}" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:700;font-size:14px;">
            Enter Draft Room
          </a>
          ${unsubscribeFooterHtml(userId)}
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send draft starting email:", err);
  }
}

export async function sendDraftScheduledEmail({
  to,
  userId,
  username,
  leagueName,
  leagueId,
  draftAt,
  isChange,
}: {
  to: string;
  userId: string;
  username: string;
  leagueName: string;
  leagueId: string;
  draftAt: Date;
  isChange: boolean;
}) {
  const dateStr = draftAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = draftAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const verb = isChange ? "rescheduled" : "scheduled";
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Draft ${verb}: ${leagueName} — ${dateStr}`,
      text: `Hey ${username},\n\nYour commissioner has ${verb} the draft for ${leagueName}.\n\nDraft time: ${dateStr} at ${timeStr}\n\nThe draft room opens 5 minutes before the scheduled time.\n\nView league: ${APP_URL}/leagues/${leagueId}${unsubscribeFooterText(userId)}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            ${logoImg()}
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">Draft ${isChange ? "Rescheduled" : "Date Set"}!</h1>
          <p style="color:#8892a4;margin:0 0 16px;">Hey ${username}, your commissioner has ${verb} the draft for <strong style="color:#edf0f5;">${leagueName}</strong>.</p>
          <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="color:#8892a4;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Draft Time</p>
            <p style="font-size:17px;font-weight:800;color:#edf0f5;margin:0;">${dateStr}</p>
            <p style="font-size:13px;color:#dc2f1f;font-weight:600;margin:6px 0 0;">${timeStr}</p>
          </div>
          <a href="${APP_URL}/leagues/${leagueId}" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:700;font-size:14px;">
            View League
          </a>
          <p style="color:#505c6e;font-size:12px;margin-top:20px;">
            The draft room opens 5 minutes before the scheduled time.
          </p>
          ${unsubscribeFooterHtml(userId)}
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send draft scheduled email:", err);
  }
}

// ─── Public League Emails ──────────────────────────────────────────────────────

export async function sendDraftDelayedEmail({
  to, userId, username, leagueName, newDraftTime, spotsLeft, delayNumber, maxDelays, lobbyUrl,
}: {
  to: string; userId: string; username: string; leagueName: string; newDraftTime: string;
  spotsLeft: number; delayNumber: number; maxDelays: number; lobbyUrl: string;
}) {
  const remaining = maxDelays - delayNumber;
  const urgencyNote = remaining === 0
    ? `This is the final auto-delay. After this, the commissioner will decide whether to start with fewer teams or cancel.`
    : `This league can be auto-delayed ${remaining} more time${remaining === 1 ? "" : "s"} if it isn't full.`;

  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Draft delayed: ${leagueName} needs ${spotsLeft} more team${spotsLeft === 1 ? "" : "s"}`,
      text: `Hey ${username},\n\nThe draft for ${leagueName} didn't have enough teams to start and has been automatically delayed.\n\nNew draft time: ${newDraftTime}\n${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} still open — share the lobby link!\n\n${urgencyNote}\n\nView public lobby: ${lobbyUrl}${unsubscribeFooterText(userId)}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            ${logoImg()}
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">Draft Delayed</h1>
          <p style="color:#8892a4;margin:0 0 16px;">Hey ${username},</p>
          <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:16px;margin-bottom:16px;">
            <p style="margin:0;font-size:15px;font-weight:700;color:#edf0f5;">${leagueName}</p>
            <p style="margin:6px 0 0;color:#8892a4;font-size:13px;">The draft didn't have enough teams to start. It has been automatically delayed.</p>
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid #272e3d;">
              <p style="margin:0;font-size:13px;color:#8892a4;">New draft time</p>
              <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#edf0f5;">${newDraftTime}</p>
            </div>
            <div style="margin-top:10px;">
              <p style="margin:0;font-size:13px;color:#f59e0b;">${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} still open — share the lobby link!</p>
            </div>
          </div>
          <p style="color:#8892a4;font-size:13px;margin:0 0 16px;">${urgencyNote}</p>
          <a href="${lobbyUrl}" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:700;font-size:14px;">
            View Public Lobby
          </a>
          ${unsubscribeFooterHtml(userId)}
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send draft delayed email:", err);
  }
}

export async function sendDraftDecisionNeededEmail({
  to, userId, commissionerUsername, leagueName, memberCount, maxTeams, leagueUrl,
}: {
  to: string; userId: string; commissionerUsername: string; leagueName: string;
  memberCount: number; maxTeams: number; leagueUrl: string;
}) {
  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `Action needed: ${leagueName} isn't full after 3 delays`,
      text: `Hey ${commissionerUsername},\n\nYour league ${leagueName} has been auto-delayed 3 times and still has ${memberCount}/${maxTeams} teams. No more auto-delays remain.\n\nAs commissioner, you can:\n- Start the draft now with ${memberCount} teams\n- Cancel the league\n\nGo to league: ${leagueUrl}${unsubscribeFooterText(userId)}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            ${logoImg()}
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">Decision Required</h1>
          <p style="color:#8892a4;margin:0 0 16px;">Hey ${commissionerUsername},</p>
          <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:16px;margin-bottom:16px;">
            <p style="margin:0;font-size:15px;font-weight:700;color:#edf0f5;">${leagueName}</p>
            <p style="margin:6px 0 0;color:#8892a4;font-size:13px;">Your league has been auto-delayed 3 times and still has ${memberCount}/${maxTeams} teams. No more auto-delays remain.</p>
            <p style="margin:10px 0 0;font-size:13px;color:#edf0f5;font-weight:600;">As commissioner, you can:</p>
            <ul style="margin:6px 0 0;padding-left:18px;color:#8892a4;font-size:13px;">
              <li style="margin-bottom:4px;">Start the draft now with ${memberCount} teams</li>
              <li>Cancel the league</li>
            </ul>
          </div>
          <a href="${leagueUrl}" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:700;font-size:14px;">
            Go to League
          </a>
          ${unsubscribeFooterHtml(userId)}
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send draft decision email:", err);
  }
}

export async function sendLeagueFullEmail({
  to,
  userId,
  username,
  leagueName,
  teamCount,
  isCommissioner,
  leagueUrl,
}: {
  to: string;
  userId: string;
  username: string;
  leagueName: string;
  teamCount: number;
  isCommissioner: boolean;
  leagueUrl: string;
}) {
  const commissionerNote = isCommissioner
    ? `<p style="margin:8px 0 0;color:#22c55e;font-size:13px;font-weight:600;">As commissioner, you can now schedule or start the draft.</p>`
    : `<p style="margin:8px 0 0;color:#8892a4;font-size:13px;">Keep an eye out for a draft time announcement from your commissioner.</p>`;
  const commissionerNotePlain = isCommissioner
    ? `As commissioner, you can now schedule or start the draft.`
    : `Keep an eye out for a draft time announcement from your commissioner.`;

  try {
    await getResend().emails.send({
      from: FROM,
      to,
      subject: `${leagueName} is full — time to draft!`,
      text: `Hey ${username},\n\n${leagueName} is full with ${teamCount}/${teamCount} teams!\n\n${commissionerNotePlain}\n\nView league: ${leagueUrl}\n\nYou're receiving this because you're a member of ${leagueName} on Injured List Fantasy.${unsubscribeFooterText(userId)}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0e1014;color:#edf0f5;border-radius:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
            ${logoImg()}
            <strong style="font-size:16px;font-weight:800;">Injured List Fantasy</strong>
          </div>
          <h1 style="font-size:20px;font-weight:800;margin:0 0 8px;">Your league is full!</h1>
          <p style="color:#8892a4;margin:0 0 16px;">Hey ${username},</p>
          <div style="background:#191d26;border:1px solid #272e3d;border-radius:12px;padding:16px;margin-bottom:16px;">
            <p style="margin:0;font-size:15px;font-weight:700;color:#edf0f5;">${leagueName}</p>
            <p style="margin:4px 0 0;color:#22c55e;font-weight:600;">${teamCount}/${teamCount} teams — League is full</p>
            ${commissionerNote}
          </div>
          <a href="${leagueUrl}" style="display:inline-block;background:#dc2f1f;color:white;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:700;font-size:14px;">
            Go to League
          </a>
          <p style="color:#505c6e;font-size:12px;margin-top:20px;">
            You're receiving this because you're a member of ${leagueName} on Injured List Fantasy.
          </p>
          ${unsubscribeFooterHtml(userId)}
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send league full email:", err);
  }
}
