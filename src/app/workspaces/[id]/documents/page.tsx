"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { FilePlus2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSidebar } from "@/features/document/components/PageSidebar";
import { useCreatePage } from "@/features/document/hooks/use-documents";

export default function WorkspaceDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const createPageMutation = useCreatePage(workspaceId);

  const handleCreatePage = async () => {
    try {
      const newPage = await createPageMutation.mutateAsync({ title: "Untitled" });
      router.push(`/workspaces/${workspaceId}/documents/${newPage.id}`);
    } catch {
      // Handled by error boundaries
    }
  };

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <PageSidebar workspaceId={workspaceId} />

      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-card/40 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FileText className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          Workspace Documents
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Select an existing document from the sidebar to start reading and editing, or create a new one.
        </p>

        <Button
          type="button"
          onClick={handleCreatePage}
          disabled={createPageMutation.isPending}
          className="mt-6 gap-2 text-xs"
        >
          {createPageMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FilePlus2 className="h-4 w-4" />
          )}
          <span>Create New Document</span>
        </Button>
      </div>
    </div>
  );
}
