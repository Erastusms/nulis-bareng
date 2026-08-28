import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMPTY_DOCUMENT,
  isSafeUrl,
  validateDocumentContent,
} from "./document-validator";
import { ValidationError } from "@/lib/api/errors";

describe("document-validator", () => {
  describe("isSafeUrl", () => {
    it("should allow safe http, https, mailto, tel, and relative links", () => {
      expect(isSafeUrl("https://example.com")).toBe(true);
      expect(isSafeUrl("http://example.com/path?foo=bar#hash")).toBe(true);
      expect(isSafeUrl("mailto:user@example.com")).toBe(true);
      expect(isSafeUrl("tel:+1234567890")).toBe(true);
      expect(isSafeUrl("#heading-1")).toBe(true);
      expect(isSafeUrl("/workspaces/ws_1")).toBe(true);
      expect(isSafeUrl("./relative-path")).toBe(true);
      expect(isSafeUrl("example.com")).toBe(true);
    });

    it("should reject dangerous protocols like javascript: and data:", () => {
      expect(isSafeUrl("javascript:alert(1)")).toBe(false);
      expect(isSafeUrl("JAVASCRIPT:alert(1)")).toBe(false);
      expect(isSafeUrl("  javascript:alert(1)  ")).toBe(false);
      expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
      expect(isSafeUrl("vbscript:msgbox(1)")).toBe(false);
      expect(isSafeUrl("file:///etc/passwd")).toBe(false);
      expect(isSafeUrl("")).toBe(false);
    });
  });

  describe("validateDocumentContent", () => {
    it("should return default empty document if content is null or undefined", () => {
      expect(validateDocumentContent(null)).toEqual(DEFAULT_EMPTY_DOCUMENT);
      expect(validateDocumentContent(undefined)).toEqual(DEFAULT_EMPTY_DOCUMENT);
    });

    it("should allow valid MVP nodes: paragraph, headings, lists, taskList, codeBlock, and marks", () => {
      const validDoc = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Main Title" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Here is ",
              },
              {
                type: "text",
                text: "bold and italic",
                marks: [{ type: "bold" }, { type: "italic" }],
              },
              {
                type: "text",
                text: " and a link",
                marks: [{ type: "link", attrs: { href: "https://example.com" } }],
              },
            ],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Bullet 1" }] }],
              },
            ],
          },
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Numbered 1" }] }],
              },
            ],
          },
          {
            type: "taskList",
            content: [
              {
                type: "taskItem",
                attrs: { checked: true },
                content: [{ type: "paragraph", content: [{ type: "text", text: "Task 1" }] }],
              },
            ],
          },
          {
            type: "codeBlock",
            attrs: { language: "typescript" },
            content: [{ type: "text", text: "const x = 1;" }],
          },
        ],
      };

      const result = validateDocumentContent(validDoc);
      expect(result).toEqual(validDoc);
    });

    it("should reject non-object content", () => {
      expect(() => validateDocumentContent("not an object")).toThrow(ValidationError);
      expect(() => validateDocumentContent(123)).toThrow(ValidationError);
    });

    it("should reject root node if type is not 'doc'", () => {
      expect(() => validateDocumentContent({ type: "paragraph" })).toThrow(
        "Root node must have type 'doc'."
      );
    });

    it("should reject unsupported node types (e.g. image, table)", () => {
      const invalidDoc = {
        type: "doc",
        content: [{ type: "image", attrs: { src: "https://example.com/pic.jpg" } }],
      };
      expect(() => validateDocumentContent(invalidDoc)).toThrow("Unsupported node type 'image'.");
    });

    it("should reject unsupported heading levels", () => {
      const invalidDoc = {
        type: "doc",
        content: [{ type: "heading", attrs: { level: 4 } }],
      };
      expect(() => validateDocumentContent(invalidDoc)).toThrow(
        "Heading node must have an integer 'level' attribute between 1 and 3."
      );
    });

    it("should reject unsupported marks (e.g. underline, highlight)", () => {
      const invalidDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Highlighted",
                marks: [{ type: "highlight" }],
              },
            ],
          },
        ],
      };
      expect(() => validateDocumentContent(invalidDoc)).toThrow(
        "Unsupported mark type 'highlight'."
      );
    });

    it("should reject unsafe links in link marks", () => {
      const unsafeDoc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Malicious link",
                marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
              },
            ],
          },
        ],
      };
      expect(() => validateDocumentContent(unsafeDoc)).toThrow("Invalid or unsafe URL in link mark");
    });

    it("should reject excessively deeply nested nodes", () => {
      let current: Record<string, unknown> = {
        type: "paragraph",
        content: [{ type: "text", text: "deep" }],
      };
      for (let i = 0; i < 25; i++) {
        current = {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [current],
            },
          ],
        };
      }
      const deepDoc = {
        type: "doc",
        content: [current],
      };
      expect(() => validateDocumentContent(deepDoc)).toThrow("Document exceeds maximum nesting depth");
    });
  });
});
