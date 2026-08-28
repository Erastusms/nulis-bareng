"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isSafeUrl } from "../schemas/document-validator";

interface LinkModalProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LinkModal({ editor, isOpen, onClose }: LinkModalProps) {
  const [url, setUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && editor) {
      const previousUrl = editor.getAttributes("link").href || "";
      setUrl(previousUrl);
      setError(null);
    }
  }, [isOpen, editor]);

  if (!editor) return null;

  const handleSave = () => {
    const trimmed = url.trim();

    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }

    if (!isSafeUrl(trimmed)) {
      setError("Please enter a valid URL (e.g. https://example.com or /path)");
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: trimmed })
      .run();

    onClose();
  };

  const handleRemove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  };

  const isLinkActive = editor.isActive("link");

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isLinkActive ? "Edit Link" : "Insert Link"}
      description="Enter a destination URL for the selected text."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-between pt-2">
          {isLinkActive ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Unlink className="mr-1.5 h-3.5 w-3.5" />
              <span>Remove Link</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
