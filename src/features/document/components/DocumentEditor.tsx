"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Check, CloudAlert, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeletePage, usePage, useUpdatePage } from "../hooks/use-documents";
import { EditorToolbar } from "./EditorToolbar";
import { DeletePageDialog } from "./DeletePageDialog";
import { DEFAULT_EMPTY_DOCUMENT } from "../schemas/document-validator";

interface DocumentEditorProps {
  workspaceId: string;
  pageId: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function DocumentEditor({ workspaceId, pageId }: DocumentEditorProps) {
  const router = useRouter();
  const { data: page, isLoading, error: fetchError } = usePage(pageId);
  const updatePageMutation = useUpdatePage(pageId, workspaceId);
  const deletePageMutation = useDeletePage(workspaceId);

  const [title, setTitle] = React.useState("");
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  // Debounce save timer reference
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = React.useRef<{
    title?: string;
    content?: Record<string, unknown>;
  }>({});

  // Initialize Tiptap editor
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false,
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
    ],
    content: DEFAULT_EMPTY_DOCUMENT,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[400px] text-foreground leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      scheduleSave({ content: json });
    },
  });

  // Sync initial page data once loaded
  React.useEffect(() => {
    if (page) {
      setTitle(page.title);
      if (editor && !editor.isDestroyed) {
        const currentJson = JSON.stringify(editor.getJSON());
        const incomingJson = JSON.stringify(page.content);
        if (currentJson !== incomingJson) {
          editor.commands.setContent(
            page.content && typeof page.content === "object"
              ? page.content
              : DEFAULT_EMPTY_DOCUMENT
          );
        }
      }
    }
  }, [page, editor]);

  // Debounced auto-save function
  const scheduleSave = React.useCallback(
    (changes: { title?: string; content?: Record<string, unknown> }) => {
      pendingChangesRef.current = {
        ...pendingChangesRef.current,
        ...changes,
      };

      setSaveStatus("saving");

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        const payloadToSave = { ...pendingChangesRef.current };
        pendingChangesRef.current = {};

        try {
          await updatePageMutation.mutateAsync(payloadToSave);
          setSaveStatus("saved");
        } catch {
          setSaveStatus("error");
          // Re-queue failed changes so retry works
          pendingChangesRef.current = {
            ...payloadToSave,
            ...pendingChangesRef.current,
          };
        }
      }, 750);
    },
    [updatePageMutation]
  );

  // Clean up debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    scheduleSave({ title: newTitle });
  };

  const handleRetrySave = () => {
    if (editor) {
      scheduleSave({
        title,
        content: editor.getJSON(),
      });
    }
  };

  const handleDeletePage = async () => {
    try {
      await deletePageMutation.mutateAsync(pageId);
      setIsDeleteDialogOpen(false);
      router.push(`/workspaces/${workspaceId}/documents`);
    } catch {
      // Error handled by query error boundary / toast if any
    }
  };

  if (isLoading) {
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
      {/* Editor Top Bar: Title, Save Status, Actions */}
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full bg-transparent text-2xl font-bold tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none sm:text-3xl"
        />

        {/* Persistence Status Badge & Actions */}
        <div className="flex shrink-0 items-center gap-3">
          {saveStatus === "saving" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Saving...</span>
            </div>
          )}

          {saveStatus === "saved" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>Saved</span>
            </div>
          )}

          {saveStatus === "error" && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-destructive">
                <CloudAlert className="h-3.5 w-3.5" />
                <span>Failed to save</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleRetrySave}
              >
                Retry
              </Button>
            </div>
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

      {/* Rich Text Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Editor Content Area */}
      <div className="p-6 sm:p-8">
        <EditorContent editor={editor} />
      </div>

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
