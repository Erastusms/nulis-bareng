import nodemailer from "nodemailer";
import { env } from "@/config/env";
import type { EmailMessage, EmailSendResult, IEmailTransport } from "./types";

/**
 * Real SMTP Email Transport utilizing nodemailer.
 * Supports port 587 (STARTTLS), port 465 (SSL/TLS), and local SMTP development servers.
 */
export class SmtpEmailTransport implements IEmailTransport {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const auth =
        env.SMTP_USER && env.SMTP_PASSWORD
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASSWORD,
            }
          : undefined;

      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          // Do not fail on invalid certs in development/test environments
          rejectUnauthorized: env.NODE_ENV === "production",
        },
      });
    }

    return this.transporter;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const from = message.from || env.INVITATION_EMAIL_FROM;
      const transporter = this.getTransporter();

      const info = await transporter.sendMail({
        from,
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to deliver email via SMTP";
      console.error(`[SmtpEmailTransport] Delivery failure to ${message.to}:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}

/**
 * In-memory Mock Email Transport for unit testing and local offline simulations.
 */
export class MockEmailTransport implements IEmailTransport {
  private sentMessages: EmailMessage[] = [];
  private shouldFail = false;
  private failureMessage = "Mock email delivery failure";

  setShouldFail(shouldFail: boolean, message?: string) {
    this.shouldFail = shouldFail;
    if (message) this.failureMessage = message;
  }

  getSentMessages(): EmailMessage[] {
    return [...this.sentMessages];
  }

  getLastMessage(): EmailMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clear(): void {
    this.sentMessages = [];
    this.shouldFail = false;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureMessage,
      };
    }

    this.sentMessages.push(message);

    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      previewUrl: false,
    };
  }
}

export const smtpTransport = new SmtpEmailTransport();
