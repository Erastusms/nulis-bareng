# Real-Time WebSocket Protocol Specification

## 1. Overview & Architecture

`NulisBareng` implements a server-authoritative, event-driven WebSocket architecture designed for low-latency, granular state synchronization between connected clients.

```text
Browser Client A                       Browser Client B
     |                                      |
     | 1. HTTP API Mutation                 |
     v                                      |
Next.js REST API Handler                    |
     |                                      |
     | 2. Validate & Commit                 |
     v                                      |
Database (Prisma / PostgreSQL)              |
     |                                      |
     | 3. On DB Commit -> Publish Event     |
     v                                      |
EventPublisher (IEventPublisher)            |
     |                                      |
     | 4. Broadcast to Workspace Room       |
     v                                      |
WebSocket Server (ws://)                    |
     |                                      |
     +------ workspace:ws_123 ------------->|
                                            v
                                 RealtimeCacheUpdater
                                            v
                                    TanStack Query Cache
```

### Architectural Principles:
1. **Server-Authoritative**: Domain events are published **only** after underlying mutations are successfully committed to the database. If a database transaction fails, no domain event is broadcast.
2. **Granular Delta Events**: Events convey only the minimal mutation payload needed for peer clients to reconcile state. The server **never** broadcasts the entire board state for normal mutations.
3. **Strict Channel Isolation**: Subscriptions are scoped to workspace rooms (`workspace:{workspaceId}`). A client in Workspace A never receives events from Workspace B.
4. **Decoupled Transport**: Domain services publish events through the `IEventPublisher` interface, enabling future scaling to Redis Pub/Sub, NATS, or Kafka without changing business logic.

---

## 2. Connection Lifecycle & Authentication

### 2.1 Connection Endpoint
- **Default Development URL**: `ws://localhost:3001`
- **Configured via**: `NEXT_PUBLIC_WS_URL` and `WS_PORT`

### 2.2 Authentication Flow
During connection handshake, the server authenticates the client using one of three credentials (in order of priority):
1. **Cookie**: Standard HTTP `Cookie` header containing `nb_session=<session_token>`.
2. **Authorization Header**: `Authorization: Bearer <session_token>`.
3. **Query Parameter**: `ws://localhost:3001?token=<session_token>`.

If the session token is missing, expired, or invalid, the server sends an `error` message and closes the socket with code `4401`:

```json
{
  "type": "error",
  "code": "UNAUTHORIZED",
  "message": "Authentication required to establish WebSocket connection."
}
```

---

## 3. Workspace Rooms & Authorization

### 3.1 Room Naming Convention
Channels follow the pattern:
```text
workspace:{workspaceId}
```
*Example:* `workspace:cly893jd00001`

### 3.2 Subscription Flow
To receive events for a workspace, the client must send a `subscribe` message:

```json
{
  "type": "subscribe",
  "workspaceId": "ws_123"
}
```

The server verifies that the authenticated user is an active member (`OWNER`, `ADMIN`, `MEMBER`, or `VIEWER`) of that workspace.

- **On Success**:
  ```json
  {
    "type": "subscribed",
    "workspaceId": "ws_123"
  }
  ```
- **On Authorization Failure**:
  ```json
  {
    "type": "error",
    "code": "FORBIDDEN",
    "message": "You do not have permission to subscribe to this workspace.",
    "workspaceId": "ws_123"
  }
  ```

### 3.3 Unsubscription Flow
```json
{
  "type": "unsubscribe",
  "workspaceId": "ws_123"
}
```

Server response:
```json
{
  "type": "unsubscribed",
  "workspaceId": "ws_123"
}
```

---

## 4. Event Envelope & Version Semantics

Every domain event emitted by the server conforms to the `BaseRealtimeEvent` envelope:

```typescript
interface BaseRealtimeEvent {
  eventId: string;     // Unique identifier (UUIDv4) for deduplication
  type: string;        // Discriminated event type (e.g. "card.moved")
  workspaceId: string; // Target workspace scope
  version: number;     // Monotonically increasing revision timestamp (ms)
  timestamp: string;   // ISO 8601 creation timestamp
}
```

### Version Semantics:
- **Scope**: The version belongs to the modified entity's revision sequence.
- **Increment**: Assigned from `Date.now()` upon transaction completion.
- **Comparison**: Clients compare incoming `event.version` against the last seen version for that entity (`entityKey`).
- **Stale Event Handling**: If an event arrives with `version < lastSeenVersion`, the client discards it to prevent race conditions or out-of-order execution.
- **Idempotency**: Clients track seen `eventId`s in an LRU buffer. If an event is received more than once (e.g., across reconnects), it is safely ignored.

---

## 5. Event Catalog

### 5.1 Card Events

#### `card.created`
Emitted when a new card is created inside a column.

```json
{
  "eventId": "e9a03b57-6fcb-4c07-bca9-0268ecf931d8",
  "type": "card.created",
  "workspaceId": "ws_123",
  "boardId": "board_456",
  "columnId": "col_789",
  "cardId": "card_001",
  "card": {
    "id": "card_001",
    "columnId": "col_789",
    "boardId": "board_456",
    "title": "Design Database Schema",
    "description": "Create ER diagrams and define migrations",
    "position": 0,
    "dueDate": "2026-09-01T12:00:00.000Z",
    "labels": ["backend", "urgent"],
    "assigneeIds": ["user_1"],
    "assignees": [],
    "createdAt": "2026-08-25T08:30:00.000Z",
    "updatedAt": "2026-08-25T08:30:00.000Z"
  },
  "version": 1724574600000,
  "timestamp": "2026-08-25T08:30:00.000Z"
}
```

#### `card.updated`
Emitted when editable properties of a card are modified.

```json
{
  "eventId": "f1c24a98-10ab-4d22-9011-3ab8cd9ef012",
  "type": "card.updated",
  "workspaceId": "ws_123",
  "boardId": "board_456",
  "columnId": "col_789",
  "cardId": "card_001",
  "changes": {
    "title": "Design Database Schema & Indexes",
    "description": "Add index specifications for positioning queries",
    "labels": ["backend", "database"]
  },
  "version": 1724574605000,
  "timestamp": "2026-08-25T08:30:05.000Z"
}
```

#### `card.deleted`
Emitted when a card is removed.

```json
{
  "eventId": "3c847d01-5e2a-481b-a9b0-1289de048cbb",
  "type": "card.deleted",
  "workspaceId": "ws_123",
  "boardId": "board_456",
  "columnId": "col_789",
  "cardId": "card_001",
  "version": 1724574610000,
  "timestamp": "2026-08-25T08:30:10.000Z"
}
```

#### `card.moved`
Emitted when a card is moved within or across columns. Represents the authoritative server position.

```json
{
  "eventId": "a7b32948-2890-44ec-b552-192837465abc",
  "type": "card.moved",
  "workspaceId": "ws_123",
  "boardId": "board_456",
  "cardId": "card_001",
  "fromColumnId": "col_789",
  "toColumnId": "col_999",
  "position": 2,
  "version": 1724574615000,
  "timestamp": "2026-08-25T08:30:15.000Z"
}
```

---

### 5.2 Column Events

#### `column.created`
Emitted when a new column is added to a board.

```json
{
  "eventId": "bb934812-70df-4f01-8fa1-0192837465aa",
  "type": "column.created",
  "workspaceId": "ws_123",
  "boardId": "board_456",
  "columnId": "col_999",
  "column": {
    "id": "col_999",
    "boardId": "board_456",
    "title": "Code Review",
    "position": 3,
    "color": "#3B82F6",
    "createdAt": "2026-08-25T08:30:20.000Z",
    "updatedAt": "2026-08-25T08:30:20.000Z"
  },
  "version": 1724574620000,
  "timestamp": "2026-08-25T08:30:20.000Z"
}
```

#### `column.updated`
Emitted when a column's title, color, or position changes.

```json
{
  "eventId": "ca849201-66bb-49e0-811c-223344556677",
  "type": "column.updated",
  "workspaceId": "ws_123",
  "boardId": "board_456",
  "columnId": "col_999",
  "changes": {
    "title": "Peer Review & QA",
    "color": "#10B981"
  },
  "version": 1724574625000,
  "timestamp": "2026-08-25T08:30:25.000Z"
}
```

#### `column.deleted`
Emitted when a column and its associated cards are deleted.

```json
{
  "eventId": "dd738192-34ef-410a-9dcb-8899aabbccdd",
  "type": "column.deleted",
  "workspaceId": "ws_123",
  "boardId": "board_456",
  "columnId": "col_999",
  "version": 1724574630000,
  "timestamp": "2026-08-25T08:30:30.000Z"
}
```

---

### 5.3 Board Events

#### `board.updated`
Emitted when board title, description, or ordering position is modified.

```json
{
  "eventId": "ee629103-44ca-401f-bf4e-998877665544",
  "type": "board.updated",
  "workspaceId": "ws_123",
  "boardId": "board_456",
  "changes": {
    "title": "Product Sprint 14",
    "description": "Sprint 14: WebSocket Foundation and Realtime Sync"
  },
  "version": 1724574635000,
  "timestamp": "2026-08-25T08:30:35.000Z"
}
```

---

### 5.4 Workspace Membership Events

#### `member.added`
Emitted when an invitation is accepted and a user joins the workspace.

```json
{
  "eventId": "ff518204-11da-452a-99ab-112233445566",
  "type": "member.added",
  "workspaceId": "ws_123",
  "memberId": "mem_001",
  "member": {
    "id": "mem_001",
    "workspaceId": "ws_123",
    "userId": "user_42",
    "role": "MEMBER",
    "joinedAt": "2026-08-25T08:30:40.000Z",
    "user": {
      "id": "user_42",
      "name": "Sarah Connor",
      "email": "sarah@example.com",
      "avatarUrl": null,
      "createdAt": "2026-08-25T08:30:40.000Z",
      "updatedAt": "2026-08-25T08:30:40.000Z"
    }
  },
  "version": 1724574640000,
  "timestamp": "2026-08-25T08:30:40.000Z"
}
```

#### `member.removed`
Emitted when a member is removed from the workspace.

```json
{
  "eventId": "ab123456-7890-4cde-8f01-234567890123",
  "type": "member.removed",
  "workspaceId": "ws_123",
  "memberId": "mem_001",
  "version": 1724574645000,
  "timestamp": "2026-08-25T08:30:45.000Z"
}
```

---

## 6. Client Cache Integration (TanStack Query)

Clients process domain events via the centralized `RealtimeCacheUpdater`, mapping events to specific queries:

| Event Type | Target Query Key | Targeted Cache Action |
| :--- | :--- | :--- |
| `card.created` | `['boards', 'detail', boardId]` | Appends card to the target column's `cards` array. |
| `card.updated` | `['boards', 'detail', boardId]` | Merges `changes` into matching card in column. |
| `card.deleted` | `['boards', 'detail', boardId]` | Removes card ID from column `cards`. |
| `card.moved` | `['boards', 'detail', boardId]` | Splices card from source column to target column at server position. |
| `column.created` | `['boards', 'detail', boardId]` | Appends column with empty cards list to board `columns`. |
| `column.updated` | `['boards', 'detail', boardId]` | Updates column metadata and resorts columns by position. |
| `column.deleted` | `['boards', 'detail', boardId]` | Removes column and cards from board `columns`. |
| `board.updated` | `['boards', 'detail', boardId]`, `['boards', 'list', wsId]` | Updates board title/description in detail and list caches. |
| `member.added` | `['workspaces', 'detail', wsId, 'members']` | Adds new member to workspace member list. |
| `member.removed` | `['workspaces', 'detail', wsId, 'members']` | Removes member from workspace member list. |

---

## 7. Reconnection & Error Recovery

### 7.1 Heartbeat
Clients send `{ "type": "ping" }` every 30 seconds. The server responds with `{ "type": "pong" }`.

### 7.2 Exponential Backoff Reconnection
Upon disconnection, the client enters `reconnecting` status and attempts automatic reconnects with jittered exponential backoff:
- **Base delay**: 1000ms
- **Multiplier**: 1.5x
- **Max delay**: 10000ms
- **Max attempts**: 10

### 7.3 Automatic Re-subscription
The client tracks active room subscriptions. Once a connection is re-established, it automatically transmits `subscribe` messages for all previously active workspace rooms.

---

## 8. Multi-Instance Horizontal Scaling (Redis Pub/Sub)

To support multiple backend instances behind a load balancer, `NulisBareng` employs **Redis Pub/Sub** as a high-performance cross-instance message broker.

```text
                    Load Balancer
                   /             \
              API #1            API #2
                │                  │
          WebSocket A        WebSocket B
                │                  │
                └──────┐    ┌──────┘
                       │    │
                       ▼    ▼
                    Redis Pub/Sub
                         │
                         ▼
                    PostgreSQL (Source of Truth)
```

### 8.1 Responsibilities & Isolation
- **PostgreSQL**: The single source of truth for persistent entity records. Domain events are published *only* after database transactions successfully commit.
- **Redis Pub/Sub**: Ephemeral message transport. Redis does NOT store persistent workspace state.
- **WebSocket Server**: Delivers events to authenticated, connected clients.

### 8.2 Channel Naming Scheme
All Redis channels are workspace-scoped:
```text
workspace:{workspaceId}
```
*Example:* `workspace:cly893jd00001`

### 8.3 Cross-Instance Event Envelope
Internal Redis messages wrap the domain event inside a typed envelope with routing metadata:
```json
{
  "eventId": "e9a03b57-6fcb-4c07-bca9-0268ecf931d8",
  "type": "card.created",
  "workspaceId": "ws_123",
  "sourceInstanceId": "api-instance-1",
  "timestamp": "2026-08-25T08:30:00.000Z",
  "version": 1724574600000,
  "payload": {
    "eventId": "e9a03b57-6fcb-4c07-bca9-0268ecf931d8",
    "type": "card.created",
    "workspaceId": "ws_123",
    "boardId": "board_456",
    "columnId": "col_789",
    "cardId": "card_001",
    "card": { ... },
    "version": 1724574600000,
    "timestamp": "2026-08-25T08:30:00.000Z"
  }
}
```

### 8.4 Dynamic Channel Subscriptions
Each backend instance manages dynamic Redis channel subscriptions based on active local WebSocket connections:
1. When the **first** local client subscribes to `workspace:123`, the instance issues `SUBSCRIBE workspace:123` to Redis.
2. When subsequent local clients subscribe to the same workspace, no additional Redis subscriptions are created.
3. When the **last** local client leaves `workspace:123`, the instance issues `UNSUBSCRIBE workspace:123`.
4. Upon Redis reconnection, the subscriber automatically re-subscribes to all currently active workspace channels.
