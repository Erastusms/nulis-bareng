import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { WorkspaceList } from "@/features/workspace/components/WorkspaceList";

export const metadata = {
  title: "Workspaces | NulisBareng",
  description: "Manage your collaborative workspaces and team members",
};

export default function WorkspacesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground shadow">
                NB
              </div>
              <span className="text-lg font-semibold tracking-tight">{siteConfig.name}</span>
            </Link>
            <Badge variant="outline" className="ml-2 font-mono text-xs">
              Phase 3: Workspaces & RBAC
            </Badge>
          </div>
          <div className="flex items-center space-x-4">
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl px-6 py-10">
        <WorkspaceList />
      </main>
    </div>
  );
}
