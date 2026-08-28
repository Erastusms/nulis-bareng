"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  CheckSquare,
  Code,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LinkModal } from "./LinkModal";

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [isLinkModalOpen, setIsLinkModalOpen] = React.useState(false);

  if (!editor) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-b bg-card/60 px-3 py-1.5 backdrop-blur-sm">
        {/* Text Style: Paragraph & Headings */}
        <div className="flex items-center gap-0.5 border-r pr-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={cn(
              "h-8 px-2 text-xs font-medium",
              editor.isActive("paragraph") &&
                !editor.isActive("heading") &&
                "bg-accent text-accent-foreground font-semibold"
            )}
            title="Normal Text (Paragraph)"
          >
            <Pilcrow className="mr-1 h-3.5 w-3.5" />
            <span>P</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              "h-8 px-2 text-xs",
              editor.isActive("heading", { level: 1 }) &&
                "bg-accent text-accent-foreground font-semibold"
            )}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              "h-8 px-2 text-xs",
              editor.isActive("heading", { level: 2 }) &&
                "bg-accent text-accent-foreground font-semibold"
            )}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              "h-8 px-2 text-xs",
              editor.isActive("heading", { level: 3 }) &&
                "bg-accent text-accent-foreground font-semibold"
            )}
            title="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
        </div>

        {/* Inline Formatting: Bold, Italic, Strike, Code, Link */}
        <div className="flex items-center gap-0.5 border-r pr-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={cn(
              "h-8 w-8 p-0",
              editor.isActive("bold") && "bg-accent text-accent-foreground"
            )}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={cn(
              "h-8 w-8 p-0",
              editor.isActive("italic") && "bg-accent text-accent-foreground"
            )}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
            className={cn(
              "h-8 w-8 p-0",
              editor.isActive("strike") && "bg-accent text-accent-foreground"
            )}
            title="Strikethrough (Ctrl+Shift+X)"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            disabled={!editor.can().chain().focus().toggleCode().run()}
            className={cn(
              "h-8 w-8 p-0",
              editor.isActive("code") && "bg-accent text-accent-foreground"
            )}
            title="Inline Code (Ctrl+E)"
          >
            <Code className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsLinkModalOpen(true)}
            className={cn(
              "h-8 w-8 p-0",
              editor.isActive("link") && "bg-accent text-primary font-semibold"
            )}
            title="Hyperlink"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Lists & Tasks */}
        <div className="flex items-center gap-0.5 border-r pr-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              "h-8 w-8 p-0",
              editor.isActive("bulletList") && "bg-accent text-accent-foreground"
            )}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              "h-8 w-8 p-0",
              editor.isActive("orderedList") && "bg-accent text-accent-foreground"
            )}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={cn(
              "h-8 w-8 p-0",
              editor.isActive("taskList") && "bg-accent text-accent-foreground"
            )}
            title="Task List (Checkboxes)"
          >
            <CheckSquare className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={cn(
              "h-8 w-8 p-0",
              editor.isActive("codeBlock") && "bg-accent text-accent-foreground"
            )}
            title="Code Block"
          >
            <FileCode className="h-4 w-4" />
          </Button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="h-8 w-8 p-0"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="h-8 w-8 p-0"
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <LinkModal
        editor={editor}
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
      />
    </>
  );
}
