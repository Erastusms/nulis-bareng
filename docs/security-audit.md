# Security Audit & Hardening Report

## Executive Summary
This document provides a comprehensive security review and audit summary for the **Collaborative Real-Time Workspace** application (`nulis-bareng`). The audit evaluates authentication, authorization, IDOR, input validation, rate limiting, WebSocket & real-time collaboration security, CORS/CSRF, SQL injection resilience, and document content/XSS safety.

---

## 1. Authentication Security

### Architecture & Controls
- **Password Hashing**: Uses `bcryptjs` with salt rounds = 10, generating unique cryptographic salts per password. Plaintext passwords are never stored or logged.
- **Session Tokens**: 256-bit entropy generated using Web Crypto `crypto.getRandomValues()` (64 hex characters).
- **Session Lifecycles**: 30-day sliding TTL stored in PostgreSQL `sessions` table. Expired sessions are rejected automatically.
- **Cookie Flags**:
  - `httpOnly: true` (prevents JavaScript `document.cookie` access)
  - `sameSite: "lax"` (mitigates CSRF on cross-site requests)
  - `secure: isProduction` (enforces HTTPS in production)
  - `path: "/"`
- **Credential Sanitization**: The `toSafeUser` / `serializeUser` boundary guarantees `passwordHash` and private session tokens are stripped prior to response serialization.
- **Error Response Sanitization**: The central `errorResponse` handler in `src/server/api/route-handler.ts` guarantees database stack traces, SQL errors, connection strings, and server internals are hidden from client responses.

---

## 2. Authorization & IDOR Hardening

### Defense Matrix
- **No Client Trust**: Never trust client-provided `userId`, `ownerId`, `role`, or permissions. All identity is resolved server-side from validated session cookies.
- **Hierarchical Access Verification**:
  1. **Workspace Scope**: Every query/mutation resolves membership in the target workspace via `WorkspaceAuthorizationService.requireWorkspaceAccess(userId, workspaceId)`.
  2. **Board Scope**: `BoardAuthorizationService.requireBoardInWorkspace(boardId, workspaceId, userId)` verifies that the board belongs to the authorized workspace.
  3. **Column Scope**: `BoardAuthorizationService.requireColumnInBoard(columnId, boardId, workspaceId, userId)` verifies column-to-board integrity.
  4. **Card Scope**: `BoardAuthorizationService.requireCardInBoard(cardId, boardId, workspaceId, userId)` verifies card-to-column-to-board integrity.
  5. **Document Scope**: `PageAuthorizationService.requirePageAccess(pageId, userId)` verifies page-to-workspace ownership.
- **IDOR Regression Suite**: `src/server/security/idor.test.ts` validates cross-workspace isolation across Workspaces, Boards, Columns, Cards, Documents, Activities, and WebSocket channels.

---

## 3. Rate Limiting

### Implementation
- Added `RateLimiter` (`src/server/security/rate-limiter.ts`) supporting sliding-window request counting with in-memory store and distributed Redis `zset` fallback.
- **Enforced Presets**:
  - **Login / Register**: 10 attempts per minute per IP.
  - **WebSocket Session Token**: 30 requests per minute per IP.
  - **Mutations & Expensive APIs**: 120 per minute.

---

## 4. WebSocket & Real-Time Security

### Authorization Boundaries
- **Upgrade Authentication**: WebSocket connections must authenticate via session cookie, Bearer token, or query token during handshake. Unauthenticated connections are closed immediately (`4401 Unauthorized`).
- **Channel / Room Authorization**: WebSocket `subscribe` messages are authorized server-side via `authorizeWorkspaceSubscription(userId, workspaceId)` before joining the room.
- **Hocuspocus Document Collaboration**: `collabAuth.authorizeConnection(token, documentName)` verifies document format (`workspace:${wsId}:page:${pageId}`), token validity, workspace membership, and page ownership.
- **Cross-Workspace Event Isolation**: Redis Pub/Sub events are partitioned by `workspace:${workspaceId}`. Sockets never receive events from unauthorized rooms.

---

## 5. XSS & Document Content Security

### Threat Model & Defenses
- **ProseMirror / Tiptap AST Validation**: Document content is stored as structured JSON AST, validated by `validateDocumentContent`.
- **Dangerous Protocol Rejection**: `isSafeUrl` strictly rejects `javascript:`, `data:`, `vbscript:`, and `file:` URLs (including control character obfuscation) in link marks.
- **Node & Mark Allowlisting**: Only known, safe rich-text nodes (`doc`, `paragraph`, `heading`, `bulletList`, `orderedList`, `listItem`, `taskList`, `taskItem`, `codeBlock`, `text`) and marks (`bold`, `italic`, `strike`, `code`, `link`) are permitted.
- **DoS / Depth Limits**: Documents exceeding 500 KB, nesting depth > 20 levels, or text nodes > 50,000 characters are rejected with `ValidationError`.

---

## 6. SQL Injection Resilience

### Database Access
- All database operations are executed via Prisma ORM parameterized query builders (`prisma.user.findUnique`, `prisma.card.create`, etc.).
- No raw SQL concatenation (`$queryRawUnsafe`) is used.
- Verified with regression test suite `src/server/security/sql-injection.test.ts`.

---

## 7. CORS & CSRF Evaluation

### Assessment
- **CSRF**: Authenticated API endpoints utilize `SameSite: Lax` cookies and JSON `Content-Type: application/json` requiring non-simple requests, preventing cross-site form submission exploits.
- **CORS**: Next.js App Router defaults to strict same-origin. Custom security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`) are attached in middleware.

---

## 8. Future File Upload Security Checklist

When attachment / file-upload functionality is introduced in future phases, the following security controls must be enforced:

- [ ] **MIME Type Validation**: Verify magic bytes on the server rather than trusting `Content-Type` header or file extension.
- [ ] **Extension Allowlisting**: Restrict allowed extensions (e.g., `.png`, `.jpg`, `.pdf`, `.txt`) and disallow executable extensions (`.exe`, `.sh`, `.php`, `.html`, `.svg`).
- [ ] **Filename Sanitization**: Strip path traversal sequences (`../`, `..\`) and generate UUID/CUID filenames on storage.
- [ ] **Size Limits**: Enforce strict per-file (e.g., 10MB) and per-workspace storage quotas.
- [ ] **Storage Isolation**: Store uploads in isolated object storage (e.g. S3/GCS bucket) with private access policies.
- [ ] **Download Authorization**: Require authenticated pre-signed URLs or authorized proxy routes to download private workspace files.
- [ ] **Virus / Malware Scanning**: Scan uploaded binaries via ClamAV or cloud virus scanners prior to making them accessible.
