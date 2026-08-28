"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { CollaborationCursor } from "../lib/collaboration-cursor";
import CodeBlock from "@tiptap/extension-code-block";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { CloudOff, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/hooks/use-auth";
import type { User } from "@/types/domain";
import { useDeletePage, usePage, useUpdatePage } from "../hooks/use-documents";
import { useCollabProvider } from "../hooks/use-collab-provider";
import { getUserColor } from "../lib/collab-utils";
import { EditorToolbar } from "./EditorToolbar";
import { CollaboratorList } from "./CollaboratorList";
import { DeletePageDialog } from "./DeletePageDialog";

interface CollaborativeEditorContentProps {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  currentUser: User | null;
}

function CollaborativeEditorContent({
  ydoc,
  provider,
  currentUser,
}: CollaborativeEditorContentProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
        link: false,
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          class:
            "rounded-md bg-muted p-4 font-mono text-sm border border-border my-4 overflow-x-auto",
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "space-y-1 my-2 list-none p-0",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "flex items-start gap-2 my-1",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer hover:opacity-80 font-medium",
        },
      }),
      Placeholder.configure({
        placeholder: "Write something, or start with a heading...",
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:text-muted-foreground/50 before:float-left before:pointer-events-none before:h-0",
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: currentUser?.name || "Anonymous",
          color: getUserColor(currentUser?.id || "anon"),
        },
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[400px] text-foreground leading-relaxed",
      },
    },
  });

  return (
    <>
      <EditorToolbar editor={editor} />
      <div className="p-6 sm:p-8">
        <EditorContent editor={editor} />
      </div>
    </>
  );
}

interface DocumentEditorProps {
  workspaceId: string;
  pageId: string;
}

export function DocumentEditor({ workspaceId, pageId }: DocumentEditorProps) {
  const router = useRouter();
  const { data: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const { data: page, isLoading: isPageLoading, error: fetchError } = usePage(pageId);
  const updatePageMutation = useUpdatePage(pageId, workspaceId);
  const deletePageMutation = useDeletePage(workspaceId);

  const {
    provider,
    ydoc,
    status: collabStatus,
    isSynced,
    collaborators,
    error: collabError,
  } = useCollabProvider({
    workspaceId,
    pageId,
    user: currentUser,
  });

  const [title, setTitle] = React.useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  // Debounced title update timer
  const titleDebounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync initial title from page data
  React.useEffect(() => {
    if (page) {
      setTitle(page.title);
    }
  }, [page]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);

    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }

    titleDebounceRef.current = setTimeout(async () => {
      try {
        await updatePageMutation.mutateAsync({ title: newTitle });
      } catch {
        // Handled by error boundary
      }
    }, 750);
  };

  React.useEffect(() => {
    return () => {
      if (titleDebounceRef.current) {
        clearTimeout(titleDebounceRef.current);
      }
    };
  }, []);

  const handleDeletePage = async () => {
    try {
      await deletePageMutation.mutateAsync(pageId);
      setIsDeleteDialogOpen(false);
      router.push(`/workspaces/${workspaceId}/documents`);
    } catch {
      // Error handled by query
    }
  };

  if (isPageLoading || isUserLoading || !ydoc || !provider) {
    return (
      <div className="space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-2/3 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-4/6" />
          <Skeleton className="h-28 w-full rounded-md" />
        </div>
      </div>
    );
  }

  if (fetchError || !page) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
        <h3 className="text-lg font-semibold">Page not found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The requested document does not exist or you do not have permission to view it.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => router.push(`/workspaces/${workspaceId}/documents`)}
        >
          Return to Documents
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card shadow-sm">
      {/* Editor Top Bar: Title, Real-Time Status, Collaborators, Actions */}
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full bg-transparent text-2xl font-bold tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none sm:text-3xl"
        />

        {/* Real-time Collaboration Status & Presence */}
        <div className="flex shrink-0 items-center gap-4">
          {/* Active Collaborators */}
          <CollaboratorList
            collaborators={collaborators}
            currentUserId={currentUser?.id}
          />

          {/* Sync & Connection Status */}
          {collabStatus === "connected" ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/90 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span>{isSynced ? "Synced" : "Syncing..."}</span>
            </div>
          ) : collabStatus === "connecting" ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Connecting...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <CloudOff className="h-3.5 w-3.5" />
              <span>Offline</span>
            </div>
          )}

          {collabError && (
            <span className="text-xs text-destructive" title={collabError}>
              Auth error
            </span>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Delete Document"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tiptap Collaborative Editor View */}
      <CollaborativeEditorContent
        ydoc={ydoc}
        provider={provider}
        currentUser={currentUser ?? null}
      />

      <DeletePageDialog
        isOpen={isDeleteDialogOpen}
        pageTitle={title}
        isDeleting={deletePageMutation.isPending}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeletePage}
      />
    </div>
  );
}
