import type { InvitationEmailProps } from "../types";

export function renderInvitationEmail(props: InvitationEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const { inviterName, inviterEmail, workspaceName, role, invitationUrl, expiresAt } = props;
  const expirationText =
    typeof expiresAt === "string"
      ? new Date(expiresAt).toLocaleDateString()
      : expiresAt.toLocaleDateString();

  const subject = `${inviterName} invited you to join ${workspaceName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 30px 15px; color: #172b4d;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
    <!-- Header -->
    <tr>
      <td style="padding: 28px 32px; background-color: #0f172a; text-align: left;">
        <div style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-weight: 700; font-size: 16px; padding: 6px 12px; border-radius: 6px; letter-spacing: 0.5px;">NB</div>
        <span style="color: #ffffff; font-size: 18px; font-weight: 600; margin-left: 10px; vertical-align: middle;">NulisBareng</span>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px;">
          Workspace Invitation
        </h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
          Hello,
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
          <strong>${inviterName}</strong> (<a href="mailto:${inviterEmail}" style="color: #2563eb; text-decoration: none;">${inviterEmail}</a>) has invited you to collaborate in the <strong>${workspaceName}</strong> workspace as a <strong>${role}</strong>.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px 20px; margin-bottom: 28px;">
          <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">Workspace:</div>
          <div style="font-size: 16px; font-weight: 600; color: #0f172a;">${workspaceName}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 8px;">Assigned Role: <span style="color: #2563eb; font-weight: 600;">${role}</span></div>
          <div style="font-size: 13px; color: #64748b; margin-top: 8px;">Invited By: <span style="color: #0f172a; font-weight: 500;">${inviterName} (${inviterEmail})</span></div>
        </div>
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${invitationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 6px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
            Accept Invitation
          </a>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-bottom: 12px;">
          Or copy and paste this link into your browser:
        </p>
        <p style="font-size: 12px; line-height: 1.4; color: #2563eb; word-break: break-all; margin-bottom: 24px; background-color: #f1f5f9; padding: 10px; border-radius: 4px;">
          <a href="${invitationUrl}" style="color: #2563eb; text-decoration: underline;">${invitationUrl}</a>
        </p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          ⏱ This invitation link will expire on <strong>${expirationText}</strong>. If you have questions for the inviter, you can reply directly to this email. If you were not expecting this invitation, you can safely ignore it.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Workspace Invitation — NulisBareng

Hello,

${inviterName} (${inviterEmail}) has invited you to join the "${workspaceName}" workspace as a ${role}.

To accept this invitation, please visit the following URL:
${invitationUrl}

This invitation link will expire on ${expirationText}.
If you have any questions, you can reply directly to this email to contact ${inviterName}.
If you did not expect this invitation, you can safely ignore this message.
`;

  return { subject, html, text };
}
