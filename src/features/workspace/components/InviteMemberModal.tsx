"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AppError } from "@/lib/api/errors";
import { useInviteMember } from "../hooks/use-workspace-members";
import { inviteMemberSchema } from "../schemas/workspace.schema";
import type { WorkspaceRole } from "@/types/domain";

interface InviteMemberModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function InviteMemberModal({
  workspaceId,
  isOpen,
  onClose,
}: InviteMemberModalProps) {
  const inviteMutation = useInviteMember(workspaceId);

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<WorkspaceRole>("MEMBER");
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string }>({});
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setEmail("");
      setRole("MEMBER");
      setFieldErrors({});
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const parseResult = inviteMemberSchema.safeParse({ email, role });
    if (!parseResult.success) {
      const formatted = parseResult.error.flatten().fieldErrors;
      setFieldErrors({ email: formatted.email?.[0] });
      return;
    }

    try {
      const result = await inviteMutation.mutateAsync(parseResult.data);
      if (result.emailDelivered === false) {
        setSuccessMessage(`Invitation created for ${email} (check server logs for email delivery).`);
      } else {
        setSuccessMessage(`Invitation email sent to ${email} (valid for 7 days).`);
      }

      setEmail("");
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (error) {
      if (error instanceof AppError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to invite member. Please try again.");
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Team Member"
      description="Add collaborators to this workspace to work together on boards and documents."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="invite-email">
            User Email Address
          </label>
          <div className="relative">
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={Boolean(fieldErrors.email)}
              disabled={inviteMutation.isPending}
              className="pl-9"
              required
            />
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
          {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="invite-role">
            Workspace Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            disabled={inviteMutation.isPending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="MEMBER">Member (Can view and contribute)</option>
            <option value="ADMIN">Admin (Can manage settings and invite members)</option>
          </select>
          <p className="text-[11px] text-muted-foreground">
            Admins have full operational access to workspace settings and membership management.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={inviteMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={inviteMutation.isPending} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
