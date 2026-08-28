import { NextRequest } from "next/server";
import { createPageSchema } from "@/features/document/schemas/document.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { pageService } from "@/server/modules/pages/page.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    const pages = await pageService.getPagesByWorkspace(workspaceId, user.id);
    return successResponse(pages, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    const json = await request.json().catch(() => ({}));
    const input = createPageSchema.parse(json);

    const page = await pageService.createPage(workspaceId, user.id, {
      title: input.title,
      content: input.content,
    });

    return successResponse(page, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
