"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FilePlus2,
  FileText,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCreatePage, useDeletePage, usePages } from "../hooks/use-documents";
import { DeletePageDialog } from "./DeletePageDialog";

interface PageSidebarProps {
  workspaceId: string;
  activePageId?: string;
}

export function PageSidebar({ workspaceId, activePageId }: PageSidebarProps) {
  const router = useRouter();
  const { data: pages, isLoading } = usePages(workspaceId);
  const createPageMutation = useCreatePage(workspaceId);
  const deletePageMutation = useDeletePage(workspaceId);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [pageToDelete, setPageToDelete] = React.useState<{ id: string; title: string } | null>(null);

  const filteredPages = React.useMemo(() => {
    if (!pages || !Array.isArray(pages)) return [];
    // Deduplicate by page ID to guarantee unique React keys across concurrent updates
    const seen = new Set<string>();
    const uniquePages: typeof pages = [];
    for (const p of pages) {
      if (p && p.id && !seen.has(p.id)) {
        seen.add(p.id);
        uniquePages.push(p);
      }
    }
    if (!searchQuery.trim()) return uniquePages;
    const query = searchQuery.toLowerCase();
    return uniquePages.filter((p) => p.title.toLowerCase().includes(query));
  }, [pages, searchQuery]);

  const handleCreatePage = async () => {
    try {
      const newPage = await createPageMutation.mutateAsync({ title: "Untitled" });
      router.push(`/workspaces/${workspaceId}/documents/${newPage.id}`);
    } catch {
      // Handled by error boundaries
    }
  };

  const handleConfirmDelete = async () => {
    if (!pageToDelete) return;
    try {
      await deletePageMutation.mutateAsync(pageToDelete.id);
      if (activePageId === pageToDelete.id) {
        router.push(`/workspaces/${workspaceId}/documents`);
      }
      setPageToDelete(null);
    } catch {
      // Handled by error boundaries
    }
  };

  return (
    <div className="flex h-full w-full flex-col rounded-xl border bg-card shadow-sm md:w-64 lg:w-72">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between border-b p-3.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight">Documents</span>
          {pages && (
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {filteredPages.length}
            </span>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleCreatePage}
          disabled={createPageMutation.isPending}
          className="h-8 gap-1 px-2.5 text-xs shadow-none"
        >
          {createPageMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FilePlus2 className="h-3.5 w-3.5" />
          )}
          <span>New Page</span>
        </Button>
      </div>

      {/* Search Bar */}
      {pages && pages.length > 3 && (
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      )}

      {/* Page List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-1">
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              {searchQuery ? "No matching pages found" : "No pages yet"}
            </p>
            {!searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreatePage}
                disabled={createPageMutation.isPending}
                className="mt-3 h-7 text-xs"
              >
                Create your first page
              </Button>
            )}
          </div>
        ) : (
          <nav className="space-y-0.5">
            {filteredPages.map((p) => {
              const isActive = p.id === activePageId;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors hover:bg-muted/70",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Link
                    href={`/workspaces/${workspaceId}/documents/${p.id}`}
                    className="flex flex-1 items-center gap-2 truncate"
                  >
                    <FileText
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="truncate">{p.title || "Untitled"}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPageToDelete({ id: p.id, title: p.title });
                    }}
                    className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                    title="Delete page"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </nav>
        )}
      </div>

      <DeletePageDialog
        isOpen={Boolean(pageToDelete)}
        pageTitle={pageToDelete?.title || ""}
        isDeleting={deletePageMutation.isPending}
        onClose={() => setPageToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
