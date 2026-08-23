import { env } from "@/config/env";
import { renderInvitationEmail } from "./templates/invitation-template";
import { smtpTransport } from "./transports";
import type { EmailSendResult, IEmailTransport } from "./types";

export interface SendInvitationEmailParams {
  recipientEmail: string;
  inviterName: string;
  inviterEmail: string;
  workspaceName: string;
  role: string;
  invitationToken: string;
  expiresAt: Date | string;
}

export class EmailService {
  constructor(private readonly transport: IEmailTransport = smtpTransport) {}

  /**
   * Generates and delivers an invitation email with real SMTP configuration,
   * sending from the application system email with Reply-To set to the inviter.
   */
  async sendInvitationEmail(params: SendInvitationEmailParams): Promise<EmailSendResult> {
    const {
      recipientEmail,
      inviterName,
      inviterEmail,
      workspaceName,
      role,
      invitationToken,
      expiresAt,
    } = params;

    const invitationUrl = `${env.NEXT_PUBLIC_APP_URL}/invitations/${invitationToken}`;

    const { subject, html, text } = renderInvitationEmail({
      recipientEmail,
      inviterName,
      inviterEmail,
      workspaceName,
      role,
      invitationUrl,
      expiresAt,
    });

    const replyTo = inviterName ? `"${inviterName}" <${inviterEmail}>` : inviterEmail;
    const from = env.INVITATION_EMAIL_FROM;

    const result = await this.transport.send({
      from,
      replyTo,
      to: recipientEmail,
      subject,
      html,
      text,
    });

    if (result.success) {
      console.log(
        `[EmailService] Invitation email sent to ${recipientEmail} (Reply-To: ${replyTo}) for workspace "${workspaceName}".`
      );
    } else {
      console.warn(
        `[EmailService] Failed to deliver invitation email to ${recipientEmail}: ${result.error}`
      );
    }

    return result;
  }
}

export const emailService = new EmailService();
