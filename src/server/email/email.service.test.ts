import { beforeEach, describe, expect, it } from "vitest";
import { EmailService } from "./email.service";
import { MockEmailTransport } from "./transports";

describe("EmailService & Real SMTP (invitation email delivery)", () => {
  let mockTransport: MockEmailTransport;
  let emailService: EmailService;

  beforeEach(() => {
    mockTransport = new MockEmailTransport();
    emailService = new EmailService(mockTransport);
  });

  it("should generate and send invitation email with From: system and Reply-To: inviter", async () => {
    const result = await emailService.sendInvitationEmail({
      recipientEmail: "bob@gmail.com",
      inviterName: "Alice Smith",
      inviterEmail: "alice@gmail.com",
      workspaceName: "Engineering Team",
      role: "ADMIN",
      invitationToken: "secure_token_12345",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    expect(result.success).toBe(true);
    expect(mockTransport.getSentMessages()).toHaveLength(1);

    const message = mockTransport.getLastMessage();
    expect(message).toBeDefined();
    expect(message?.to).toBe("bob@gmail.com");
    expect(message?.replyTo).toBe('"Alice Smith" <alice@gmail.com>');
    expect(message?.from).toContain("NulisBareng");
    expect(message?.subject).toBe("Alice Smith invited you to join Engineering Team");

    // HTML Content verification
    expect(message?.html).toContain("Alice Smith");
    expect(message?.html).toContain("alice@gmail.com");
    expect(message?.html).toContain("Engineering Team");
    expect(message?.html).toContain("ADMIN");
    expect(message?.html).toContain("secure_token_12345");
    expect(message?.html).toContain("Accept Invitation");

    // Plain-Text Content verification
    expect(message?.text).toContain("Alice Smith");
    expect(message?.text).toContain("alice@gmail.com");
    expect(message?.text).toContain("Engineering Team");
    expect(message?.text).toContain("ADMIN");
    expect(message?.text).toContain("secure_token_12345");
  });

  it("should gracefully handle transport delivery errors without throwing uncaught exceptions", async () => {
    mockTransport.setShouldFail(true, "535 Authentication failed");

    const result = await emailService.sendInvitationEmail({
      recipientEmail: "error@example.com",
      inviterName: "Alice Smith",
      inviterEmail: "alice@gmail.com",
      workspaceName: "Engineering Team",
      role: "MEMBER",
      invitationToken: "token_err",
      expiresAt: new Date(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("535 Authentication failed");
  });
});
