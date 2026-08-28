import { describe, it, expect } from "vitest";
import { createPageSchema, updatePageSchema } from "./document.schema";
import { DEFAULT_EMPTY_DOCUMENT } from "./document-validator";

describe("Document & Page Validation Schemas (Unit)", () => {
  describe("createPageSchema", () => {
    it("should provide default values for title and content when omitted", () => {
      const result = createPageSchema.parse({});
      expect(result.title).toBe("Untitled");
      expect(result.content).toEqual(DEFAULT_EMPTY_DOCUMENT);
    });

    it("should accept custom title and valid document content", () => {
      const customContent = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Hello World" }] }],
      };
      const result = createPageSchema.parse({
        title: "Sprint Notes",
        content: customContent,
      });
      expect(result.title).toBe("Sprint Notes");
      expect(result.content).toEqual(customContent);
    });

    it("should reject title exceeding 200 characters", () => {
      expect(() => createPageSchema.parse({ title: "p".repeat(201) })).toThrow(
        "Title must not exceed 200 characters"
      );
    });
  });

  describe("updatePageSchema", () => {
    it("should accept partial updates with optional title or content", () => {
      expect(updatePageSchema.parse({ title: "Updated Title" })).toEqual({
        title: "Updated Title",
      });

      const updatedContent = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Updated" }] }],
      };
      expect(updatePageSchema.parse({ content: updatedContent })).toEqual({
        content: updatedContent,
      });
    });

    it("should reject title exceeding 200 characters on update", () => {
      expect(() => updatePageSchema.parse({ title: "u".repeat(201) })).toThrow(
        "Title must not exceed 200 characters"
      );
    });
  });
});
