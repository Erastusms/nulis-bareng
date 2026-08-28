"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { PageSidebar } from "@/features/document/components/PageSidebar";
import { DocumentEditor } from "@/features/document/components/DocumentEditor";

export default function DocumentDetailPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const pageId = params.pageId as string;

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <PageSidebar workspaceId={workspaceId} activePageId={pageId} />
      <div className="flex-1">
        <DocumentEditor workspaceId={workspaceId} pageId={pageId} />
      </div>
    </div>
  );
}
