import { z } from "zod";

export const createDocumentSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
  parentId: z.string().optional().nullable(),
  title: z.string().min(1, "Document title is required").max(200),
  content: z.string().default(""),
  icon: z.string().optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
});

export const updateDocumentSchema = createDocumentSchema.partial();

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
