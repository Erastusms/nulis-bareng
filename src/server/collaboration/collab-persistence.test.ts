import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  DEFAULT_FRAGMENT_NAME,
  exportPageYDoc,
  loadPageYDoc,
  populateYXmlFragmentFromJson,
} from "./collab-persistence";
import type { PageRecord } from "@/server/db/repository";

describe("collab-persistence", () => {
  const mockPageRecord: PageRecord = {
    id: "page_1",
    workspaceId: "ws_1",
    title: "Test Page",
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Main Title" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "World", marks: [{ type: "bold" }] },
          ],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [{ type: "paragraph", content: [{ type: "text", text: "Done item" }] }],
            },
          ],
        },
      ],
    },
    yjsState: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("should convert legacy ProseMirror JSON to Yjs XML fragment", () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment(DEFAULT_FRAGMENT_NAME);

    populateYXmlFragmentFromJson(mockPageRecord.content, fragment);

    expect(fragment.length).toBe(3);

    const heading = fragment.get(0) as Y.XmlElement;
    expect(heading.nodeName).toBe("heading");
    expect(heading.getAttribute("level")).toBe("1");

    const paragraph = fragment.get(1) as Y.XmlElement;
    expect(paragraph.nodeName).toBe("paragraph");

    const taskList = fragment.get(2) as Y.XmlElement;
    expect(taskList.nodeName).toBe("taskList");
  });

  it("should populate default paragraph if JSON content is empty", () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment(DEFAULT_FRAGMENT_NAME);

    populateYXmlFragmentFromJson({ type: "doc", content: [] }, fragment);

    expect(fragment.length).toBe(1);
    const p = fragment.get(0) as Y.XmlElement;
    expect(p.nodeName).toBe("paragraph");
  });

  it("should load page YDoc from existing yjsState binary when available", () => {
    // 1. Create a source doc with modifications
    const sourceDoc = new Y.Doc();
    const fragment = sourceDoc.getXmlFragment(DEFAULT_FRAGMENT_NAME);
    const p = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    text.insert(0, "Binary persistent text");
    p.insert(0, [text]);
    fragment.insert(0, [p]);

    const binaryState = exportPageYDoc(sourceDoc);

    const pageWithBinary: PageRecord = {
      ...mockPageRecord,
      yjsState: binaryState,
    };

    // 2. Load into target doc
    const targetDoc = loadPageYDoc(pageWithBinary);
    const targetFragment = targetDoc.getXmlFragment(DEFAULT_FRAGMENT_NAME);

    expect(targetFragment.length).toBe(1);
    const targetP = targetFragment.get(0) as Y.XmlElement;
    const targetText = targetP.get(0) as Y.XmlText;
    expect(targetText.toString()).toBe("Binary persistent text");
  });

  it("should serialize and deserialize Yjs updates losslessly (round-trip)", () => {
    const docA = new Y.Doc();
    const fragmentA = docA.getXmlFragment(DEFAULT_FRAGMENT_NAME);
    const p = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    text.insert(0, "Collaborative typing");
    p.insert(0, [text]);
    fragmentA.insert(0, [p]);

    const update = exportPageYDoc(docA);
    expect(update).toBeInstanceOf(Uint8Array);
    expect(update.byteLength).toBeGreaterThan(0);

    const docB = new Y.Doc();
    Y.applyUpdate(docB, update);

    const fragmentB = docB.getXmlFragment(DEFAULT_FRAGMENT_NAME);
    expect(fragmentB.length).toBe(1);
    const elemB = fragmentB.get(0) as Y.XmlElement;
    const textB = elemB.get(0) as Y.XmlText;
    expect(textB.toString()).toBe("Collaborative typing");
  });
});
