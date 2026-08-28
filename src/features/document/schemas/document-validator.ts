import { ValidationError } from "@/lib/api/errors";

export const DEFAULT_EMPTY_DOCUMENT = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
};

const MAX_DOCUMENT_SIZE_BYTES = 500 * 1024; // 500 KB
const MAX_TREE_DEPTH = 20;
const MAX_TEXT_LENGTH = 50000;

const ALLOWED_NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "codeBlock",
  "text",
]);

const ALLOWED_MARKS = new Set(["bold", "italic", "strike", "code", "link"]);

/**
 * Validates whether a URL is safe to use in a link node.
 * Prevents XSS via javascript:, data:, vbscript:, etc.
 */
export function isSafeUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== "string") return false;

  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  // Relative anchor or path
  if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./")) {
    return true;
  }

  // Remove control characters and whitespace
  const sanitized = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, "");

  // Disallow dangerous protocols
  const lower = sanitized.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "mailto:" ||
      parsed.protocol === "tel:"
    );
  } catch {
    // If it is a domain without protocol, e.g. "example.com", or relative URL
    return !lower.includes(":");
  }
}

/**
 * Recursively validates a ProseMirror/Tiptap node AST.
 */
function validateNode(node: unknown, depth = 0): void {
  if (depth > MAX_TREE_DEPTH) {
    throw new ValidationError(`Document exceeds maximum nesting depth of ${MAX_TREE_DEPTH} levels.`);
  }

  if (!node || typeof node !== "object") {
    throw new ValidationError("Invalid node: node must be an object.");
  }

  const n = node as Record<string, unknown>;

  if (typeof n.type !== "string") {
    throw new ValidationError("Invalid node: missing or invalid 'type' property.");
  }

  if (!ALLOWED_NODE_TYPES.has(n.type)) {
    throw new ValidationError(`Unsupported node type '${n.type}'.`);
  }

  // Heading validation
  if (n.type === "heading") {
    const attrs = n.attrs as Record<string, unknown> | undefined;
    const level = attrs?.level;
    if (typeof level !== "number" || level < 1 || level > 3) {
      throw new ValidationError("Heading node must have an integer 'level' attribute between 1 and 3.");
    }
  }

  // Text node validation
  if (n.type === "text") {
    if (typeof n.text !== "string") {
      throw new ValidationError("Text node must contain a string 'text' property.");
    }
    if (n.text.length > MAX_TEXT_LENGTH) {
      throw new ValidationError(`Text node exceeds maximum character limit of ${MAX_TEXT_LENGTH}.`);
    }

    if (n.marks !== undefined) {
      if (!Array.isArray(n.marks)) {
        throw new ValidationError("Marks property on text node must be an array.");
      }

      for (const mark of n.marks) {
        if (!mark || typeof mark !== "object") {
          throw new ValidationError("Invalid mark: mark must be an object.");
        }
        const m = mark as Record<string, unknown>;
        if (typeof m.type !== "string" || !ALLOWED_MARKS.has(m.type)) {
          throw new ValidationError(`Unsupported mark type '${m.type}'.`);
        }

        if (m.type === "link") {
          const attrs = m.attrs as Record<string, unknown> | undefined;
          const href = attrs?.href;
          if (typeof href !== "string" || !isSafeUrl(href)) {
            throw new ValidationError(`Invalid or unsafe URL in link mark: '${href}'.`);
          }
        }
      }
    }
  }

  // Children validation
  if (n.content !== undefined) {
    if (!Array.isArray(n.content)) {
      throw new ValidationError("Node 'content' must be an array of child nodes.");
    }

    for (const child of n.content) {
      validateNode(child, depth + 1);
    }
  }
}

/**
 * Authoritative document structure validator.
 * Ensures the document is a valid ProseMirror doc conforming to the Phase 8 MVP schema.
 */
export function validateDocumentContent(content: unknown): Record<string, unknown> {
  if (content === undefined || content === null) {
    return DEFAULT_EMPTY_DOCUMENT;
  }

  if (typeof content !== "object") {
    throw new ValidationError("Document content must be a JSON object.");
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(content);
  } catch {
    throw new ValidationError("Document content must be serializable JSON.");
  }

  if (new TextEncoder().encode(serialized).length > MAX_DOCUMENT_SIZE_BYTES) {
    throw new ValidationError(
      `Document payload exceeds maximum allowed size of ${MAX_DOCUMENT_SIZE_BYTES / 1024} KB.`
    );
  }

  const doc = content as Record<string, unknown>;

  if (doc.type !== "doc") {
    throw new ValidationError("Root node must have type 'doc'.");
  }

  if (doc.content !== undefined && !Array.isArray(doc.content)) {
    throw new ValidationError("Root 'content' must be an array.");
  }

  validateNode(doc, 0);

  return doc;
}
