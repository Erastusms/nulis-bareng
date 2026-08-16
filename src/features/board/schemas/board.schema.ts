import { z } from "zod";

export const createBoardSchema = z.object({
  workspaceId: z.string().min(1, "Workspace ID is required"),
  title: z.string().min(1, "Board title is required").max(100),
  description: z.string().max(300).optional(),
});

export const createCardSchema = z.object({
  columnId: z.string().min(1, "Column ID is required"),
  boardId: z.string().min(1, "Board ID is required"),
  title: z.string().min(1, "Card title is required").max(200),
  description: z.string().optional(),
  position: z.number().int().nonnegative(),
  assigneeIds: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
});

export const moveCardSchema = z.object({
  cardId: z.string().min(1),
  sourceColumnId: z.string().min(1),
  targetColumnId: z.string().min(1),
  targetPosition: z.number().int().nonnegative(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
