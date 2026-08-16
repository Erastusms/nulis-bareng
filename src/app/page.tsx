import {
  Activity,
  Boxes,
  CheckCircle2,
  Database,
  FileCode2,
  FolderTree,
  Layers,
  Radio,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";

const architecturePillars = [
  {
    title: "Next.js App Router & React 19",
    description: "Server/Client component isolation, layout composition, and route groups.",
    icon: Layers,
    badge: "Active",
    badgeVariant: "success" as const,
  },
  {
    title: "TanStack Query v5 & Cache Keys",
    description: "Hierarchical Query Key factories for structured caching and cache invalidation.",
    icon: Zap,
    badge: "Configured",
    badgeVariant: "success" as const,
  },
  {
    title: "Type-Safe Fail-Fast Environment",
    description: "Strict Zod schemas isolating client and server environment configurations.",
    icon: ShieldCheck,
    badge: "Validated",
    badgeVariant: "success" as const,
  },
  {
    title: "Centralized API & Error Model",
    description: "Normalized HTTP client, AppError hierarchy, and standard envelope responses.",
    icon: Activity,
    badge: "Ready",
    badgeVariant: "success" as const,
  },
  {
    title: "Domain Modules & DB Boundary",
    description: "Dependency inversion with generic IRepository interfaces and isolated services.",
    icon: Database,
    badge: "Modular",
    badgeVariant: "default" as const,
  },
  {
    title: "Real-Time Event Foundation",
    description: "Strongly-typed workspace event contracts ready for WebSockets / SSE.",
    icon: Radio,
    badge: "Contract Ready",
    badgeVariant: "default" as const,
  },
];

const featureModules = [
  { name: "features/auth", status: "Contracts & Schemas Ready" },
  { name: "features/workspace", status: "API, Hooks & Schemas Ready" },
  { name: "features/board", status: "Contracts & Schemas Ready" },
  { name: "features/document", status: "Contracts & Schemas Ready" },
  { name: "features/notification", status: "Contracts Ready" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground shadow">
              NB
            </div>
            <span className="text-lg font-semibold tracking-tight">{siteConfig.name}</span>
            <Badge variant="outline" className="ml-2 font-mono text-xs">
              Phase 1: Foundation
            </Badge>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="success" className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Architecture Initialized
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-6xl space-y-10 px-6 py-10">
        {/* Hero Section */}
        <section className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <Boxes className="h-3.5 w-3.5 text-primary" />
            Week 1: Architecture & Project Setup
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Collaborative Real-Time Workspace Foundation
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A production-grade, modular foundation built with Next.js App Router, Tailwind CSS,
            TanStack Query, strict TypeScript, and fail-fast environment validation. Designed for
            seamless real-time expansion without architectural rewrites.
          </p>
        </section>

        {/* Architectural Pillars */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Foundational Pillars</h2>
            <span className="text-xs text-muted-foreground">Production-Grade Standards</span>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {architecturePillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Card key={pillar.title} className="transition-all hover:border-primary/50">
                  <CardHeader className="space-y-2 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant={pillar.badgeVariant}>{pillar.badge}</Badge>
                    </div>
                    <CardTitle className="text-base">{pillar.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">{pillar.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Feature Boundaries & Structure */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <FolderTree className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Feature Domain Boundaries</CardTitle>
              </div>
              <CardDescription>
                Modular directory structures separating domain concerns and types.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {featureModules.map((mod) => (
                  <li
                    key={mod.name}
                    className="flex items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-2 font-mono text-sm"
                  >
                    <span>{mod.name}</span>
                    <Badge variant="outline" className="font-sans text-xs font-normal">
                      {mod.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <FileCode2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Available Tooling & Commands</CardTitle>
              </div>
              <CardDescription>
                Unified developer workflow scripts established in `package.json`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="rounded-md border bg-muted/40 p-2.5">
                  <p className="font-semibold text-foreground">npm run dev</p>
                  <p className="mt-0.5 font-sans text-xs text-muted-foreground">Start dev server</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-2.5">
                  <p className="font-semibold text-foreground">npm run typecheck</p>
                  <p className="mt-0.5 font-sans text-xs text-muted-foreground">Strict TS check</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-2.5">
                  <p className="font-semibold text-foreground">npm run test</p>
                  <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                    Vitest test suite
                  </p>
                </div>
                <div className="rounded-md border bg-muted/40 p-2.5">
                  <p className="font-semibold text-foreground">npm run build</p>
                  <p className="mt-0.5 font-sans text-xs text-muted-foreground">Production build</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-2.5">
                  <p className="font-semibold text-foreground">npm run lint</p>
                  <p className="mt-0.5 font-sans text-xs text-muted-foreground">ESLint checks</p>
                </div>
                <div className="rounded-md border bg-muted/40 p-2.5">
                  <p className="font-semibold text-foreground">npm run format</p>
                  <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                    Prettier formatter
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
