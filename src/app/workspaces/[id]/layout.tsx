import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { WorkspaceHeader } from "@/features/workspace/components/WorkspaceHeader";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = await params;

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

      {/* Main Workspace Wrapper */}
      <main className="container mx-auto max-w-6xl px-6 pb-12">
        <WorkspaceHeader workspaceId={id} />
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
