import { z } from "zod";

export const createBoardSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required").optional(),
  title: z.string().min(1, "Board title is required").max(100, "Board title must be at most 100 characters"),
  description: z.string().max(500, "Description must be at most 500 characters").nullish(),
});

export const updateBoardSchema = z.object({
  title: z.string().min(1, "Board title is required").max(100, "Board title must be at most 100 characters").optional(),
  description: z.string().max(500, "Description must be at most 500 characters").nullish(),
  position: z.number().int().nonnegative().optional(),
});

export const createColumnSchema = z.object({
  title: z.string().min(1, "Column title is required").max(100, "Column title must be at most 100 characters"),
  color: z.string().max(50).nullish(),
  position: z.number().int().nonnegative().optional(),
});

export const updateColumnSchema = z.object({
  title: z.string().min(1, "Column title is required").max(100, "Column title must be at most 100 characters").optional(),
  color: z.string().max(50).nullish(),
  position: z.number().int().nonnegative().optional(),
});

export const moveColumnSchema = z.object({
  columnId: z.string().min(1, "Column ID is required"),
  targetPosition: z.number().int().nonnegative("Target position must be non-negative"),
});

export const reorderColumnsSchema = z.object({
  columnIds: z.array(z.string().min(1)).min(1, "At least one column ID is required"),
});

export const createCardSchema = z.object({
  columnId: z.string().min(1, "Column ID is required"),
  title: z.string().min(1, "Card title is required").max(255, "Card title must be at most 255 characters"),
  description: z.string().nullish(),
  position: z.number().int().nonnegative().optional(),
  assigneeIds: z.array(z.string()).optional(),
  dueDate: z.string().nullish(),
  labels: z.array(z.string().max(50)).optional(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1, "Card title is required").max(255, "Card title must be at most 255 characters").optional(),
  description: z.string().nullish(),
  columnId: z.string().min(1).optional(),
  position: z.number().int().nonnegative().optional(),
  assigneeIds: z.array(z.string()).optional(),
  dueDate: z.string().nullish(),
  labels: z.array(z.string().max(50)).optional(),
});

export const moveCardSchema = z.object({
  cardId: z.string().min(1, "Card ID is required"),
  sourceColumnId: z.string().min(1, "Source column ID is required"),
  targetColumnId: z.string().min(1, "Target column ID is required"),
  targetPosition: z.number().int().nonnegative("Target position must be non-negative"),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;
export type MoveColumnInput = z.infer<typeof moveColumnSchema>;
export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
