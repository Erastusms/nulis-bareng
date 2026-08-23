export interface EmailMessage {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

export interface InvitationEmailProps {
  recipientEmail: string;
  inviterName: string;
  inviterEmail: string;
  workspaceName: string;
  role: string;
  invitationUrl: string;
  expiresAt: Date | string;
}

export interface IEmailTransport {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
