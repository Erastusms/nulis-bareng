import { z } from "zod";
import { DEFAULT_EMPTY_DOCUMENT } from "./document-validator";

export const createPageSchema = z.object({
  title: z.string().max(200, "Title must not exceed 200 characters").optional().default("Untitled"),
  content: z.record(z.unknown()).optional().default(DEFAULT_EMPTY_DOCUMENT),
});

export const updatePageSchema = z.object({
  title: z.string().max(200, "Title must not exceed 200 characters").optional(),
  content: z.record(z.unknown()).optional(),
});

export interface CreatePageInput {
  title?: string;
  content?: Record<string, unknown>;
}

export interface UpdatePageInput {
  title?: string;
  content?: Record<string, unknown>;
}

// Aliases for compatibility
export const createDocumentSchema = createPageSchema;
export const updateDocumentSchema = updatePageSchema;
export type CreateDocumentInput = CreatePageInput;
export type UpdateDocumentInput = UpdatePageInput;
