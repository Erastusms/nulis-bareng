import { Extension } from "@tiptap/core";
import { defaultSelectionBuilder, yCursorPlugin } from "@tiptap/y-tiptap";
import type { HocuspocusProvider } from "@hocuspocus/provider";

export interface CollaborationCursorOptions {
  provider: HocuspocusProvider | null;
  user: {
    name: string;
    color: string;
  };
}

/**
 * Collaboration Cursor extension using @tiptap/y-tiptap bindings.
 * Matches @tiptap/extension-collaboration plugin keys seamlessly to prevent plugin state mismatches.
 */
export const CollaborationCursor = Extension.create<CollaborationCursorOptions>({
  name: "collaborationCursor",

  addOptions() {
    return {
      provider: null,
      user: {
        name: "Anonymous",
        color: "#3b82f6",
      },
    };
  },

  addProseMirrorPlugins() {
    const provider = this.options.provider;
    if (!provider || !provider.awareness) {
      return [];
    }

    const awareness = provider.awareness;
    awareness.setLocalStateField("user", this.options.user);

    return [
      yCursorPlugin(awareness, {
        cursorBuilder: (user: { name?: string; color?: string }) => {
          const cursor = document.createElement("span");
          cursor.classList.add("collaboration-cursor__caret");
          cursor.setAttribute("style", `border-color: ${user.color || "#3b82f6"}`);

          const label = document.createElement("div");
          label.classList.add("collaboration-cursor__label");
          label.setAttribute("style", `background-color: ${user.color || "#3b82f6"}`);
          label.textContent = user.name || "Anonymous";
          cursor.insertBefore(label, null);

          return cursor;
        },
        selectionBuilder: defaultSelectionBuilder,
      }),
    ];
  },
});
