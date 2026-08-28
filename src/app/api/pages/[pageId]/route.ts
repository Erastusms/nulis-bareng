import { NextRequest } from "next/server";
import { updatePageSchema } from "@/features/document/schemas/document.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { pageService } from "@/server/modules/pages/page.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const user = await requireAuth();
    const { pageId } = await context.params;
    const page = await pageService.getPageById(pageId, user.id);
    return successResponse(page, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const user = await requireAuth();
    const { pageId } = await context.params;
    const json = await request.json();
    const input = updatePageSchema.parse(json);

    const updated = await pageService.updatePage(pageId, user.id, {
      title: input.title,
      content: input.content,
    });

    return successResponse(updated, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const user = await requireAuth();
    const { pageId } = await context.params;
    await pageService.deletePage(pageId, user.id);
    return successResponse({ message: "Page deleted successfully" }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
