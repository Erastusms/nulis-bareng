"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { WorkspaceSettingsForm } from "@/features/workspace/components/WorkspaceSettingsForm";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const workspaceId = params.id as string;

  return <WorkspaceSettingsForm workspaceId={workspaceId} />;
}
