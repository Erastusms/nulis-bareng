import * as Y from "yjs";
import type { PageRecord } from "@/server/db/repository";

export const DEFAULT_FRAGMENT_NAME = "default";

/**
 * Converts a ProseMirror JSON node into Yjs XML structures inside a Y.Doc.
 * Attaches elements in a top-down manner to maintain clean Yjs document bindings.
 */
export function populateYXmlFragmentFromJson(
  json: Record<string, unknown>,
  fragment: Y.XmlFragment
): void {
  const content = (json.content as Array<Record<string, unknown>>) || [];

  if (content.length === 0) {
    const p = new Y.XmlElement("paragraph");
    fragment.push([p]);
    return;
  }

  function appendNode(parent: Y.XmlFragment | Y.XmlElement, node: Record<string, unknown>): void {
    if (node.type === "text") {
      const xmlText = new Y.XmlText();
      const text = typeof node.text === "string" ? node.text : "";
      const marksObj: Record<string, unknown> = {};
      if (Array.isArray(node.marks)) {
        for (const mark of node.marks) {
          if (mark && typeof mark === "object" && typeof mark.type === "string") {
            marksObj[mark.type] = mark.attrs || {};
          }
        }
      }

      parent.push([xmlText]);
      if (Object.keys(marksObj).length > 0) {
        xmlText.insert(0, text, marksObj);
      } else {
        xmlText.insert(0, text);
      }
      return;
    }

    const xmlElement = new Y.XmlElement(typeof node.type === "string" ? node.type : "paragraph");
    if (node.attrs && typeof node.attrs === "object") {
      for (const [key, val] of Object.entries(node.attrs as Record<string, unknown>)) {
        if (val !== undefined && val !== null) {
          xmlElement.setAttribute(key, String(val));
        }
      }
    }

    parent.push([xmlElement]);

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (child && typeof child === "object") {
          appendNode(xmlElement, child as Record<string, unknown>);
        }
      }
    }
  }

  for (const item of content) {
    if (item && typeof item === "object") {
      appendNode(fragment, item as Record<string, unknown>);
    }
  }
}

/**
 * Initializes and loads a Y.Doc from a database PageRecord.
 * If yjsState binary exists, applies it. Otherwise migrates from legacy content JSON.
 */
export function loadPageYDoc(page: PageRecord, ydoc: Y.Doc = new Y.Doc()): Y.Doc {
  if (page.yjsState && page.yjsState.byteLength > 0) {
    Y.applyUpdate(ydoc, page.yjsState);
    return ydoc;
  }

  const fragment = ydoc.getXmlFragment(DEFAULT_FRAGMENT_NAME);
  if (page.content && typeof page.content === "object" && Object.keys(page.content).length > 0) {
    populateYXmlFragmentFromJson(page.content, fragment);
  } else {
    const p = new Y.XmlElement("paragraph");
    fragment.push([p]);
  }

  return ydoc;
}

/**
 * Exports the complete CRDT state of a Y.Doc as a binary Uint8Array update.
 */
export function exportPageYDoc(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc);
}
