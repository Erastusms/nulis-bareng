"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { MemberList } from "@/features/workspace/components/MemberList";

export default function WorkspaceMembersPage() {
  const params = useParams();
  const workspaceId = params.id as string;

  return <MemberList workspaceId={workspaceId} />;
}
