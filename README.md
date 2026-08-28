# NulisBareng — Collaborative Real-Time Workspace

> **Phase 1: Foundation (Week 1: Architecture & Project Setup)**

NulisBareng is a modern, full-stack collaborative real-time workspace application (conceptually similar to Trello and Notion) designed for multi-user project management, Kanban boards, collaborative documents, real-time updates, presence indicators, and activity tracking.

---

## 🚀 Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server & Client Components)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Server State**: [TanStack Query v5](https://tanstack.com/query/latest)
- **Validation**: [Zod](https://zod.dev/)
- **Drag & Drop Foundation**: [`@hello-pangea/dnd`](https://github.com/hello-pangea/dnd)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/)
- **Linting & Formatting**: [ESLint 9](https://eslint.org/) + [Prettier](https://prettier.io/)

---

## 📁 Repository Architecture

```text
nulis-bareng/
├── .env.example              # Environment variables template
├── .env.local                # Local environment configuration (gitignored)
├── docs/                     # Architectural documentation & conventions
│   ├── architecture.md       # Layer boundaries, query cache, error hierarchy
│   └── conventions.md        # File naming, code style, adding new features
├── src/
│   ├── app/                  # Next.js App Router (pages, layouts, error/loading states)
│   │   ├── api/health/       # Health check API route
│   │   ├── globals.css       # Design system CSS variables & Tailwind styles
│   │   ├── layout.tsx        # Root layout with Providers
│   │   └── page.tsx          # Architecture overview dashboard
│   ├── components/
│   │   └── ui/               # Generic UI primitives (Button, Card, Input, Badge, Skeleton)
│   ├── config/               # Fail-fast validated environment & site metadata
│   │   ├── env.ts            # Zod environment schema validator
│   │   └── site.ts           # Global app metadata
│   ├── features/             # Domain feature modules
│   │   ├── auth/             # Authentication contracts & schemas
│   │   ├── board/            # Kanban board contracts & schemas
│   │   ├── document/         # Document contracts & schemas
│   │   ├── notification/     # Notification contracts
│   │   └── workspace/        # Workspace API, hooks, and schemas
│   ├── lib/                  # Shared core infrastructure
│   │   ├── api/              # Universal ApiClient, AppError hierarchy & envelope types
│   │   ├── query/            # QueryClient configuration & Query Key Factories
│   │   ├── realtime/         # Real-time event contracts & interfaces
│   │   └── utils.ts          # cn() and formatting utilities
│   ├── providers/            # React context providers (TanStack Query, UI)
│   ├── server/               # Backend domain modules & repository interfaces
│   │   ├── db/repository.ts  # Generic IRepository interface
│   │   └── modules/          # Domain services (WorkspaceService, etc.)
│   ├── test/                 # Vitest test setup and matchers
│   └── types/                # Core domain types (User, Workspace, Board, Card, Doc)
```

---

## 🛠️ Getting Started

### 1. Prerequisites

- **Node.js**: `v20+` or `v22+` (v25 supported)
- **npm** or package manager of choice

### 2. Installation

```bash
npm install
```

### 3. Environment & Local Infrastructure

Start PostgreSQL and Redis using Docker Compose:

```bash
docker compose up -d
```

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

### 4. Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Available Scripts

| Script         | Command              | Purpose                                                |
| :------------- | :------------------- | :----------------------------------------------------- |
| **Dev**        | `npm run dev`        | Starts local Next.js development server                |
| **Typecheck**  | `npm run typecheck`  | Runs strict TypeScript compiler check (`tsc --noEmit`) |
| **Lint**       | `npm run lint`       | Runs ESLint validation rules                           |
| **Test**       | `npm run test`       | Executes Vitest test suite                             |
| **Test Watch** | `npm run test:watch` | Runs Vitest in interactive watch mode                  |
| **Format**     | `npm run format`     | Auto-formats codebase with Prettier                    |
| **Build**      | `npm run build`      | Builds optimized production bundle                     |
| **Start**      | `npm run start`      | Runs the compiled production server                    |

---

## 📐 Architectural Principles & DRY Standards

1. **Centralized Fail-Fast Environment (`src/config/env.ts`)**:
   No `process.env.*` calls inside components. All environment variables are validated at build/boot time.

2. **Universal API Client & Error Normalizer (`src/lib/api/`)**:
   Centralized network layer with automatic JSON handling, timeout abort controllers, and error normalization (`AppError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `InternalServerError`).

3. **Hierarchical Query Key Factories (`src/lib/query/query-keys.ts`)**:
   Zero magic strings in TanStack Query keys. Prevents cache key collisions and makes cache invalidation predictable.

4. **Clean Backend Boundaries (`src/server/`)**:
   Business logic lives in modular domain services implementing `IRepository` interfaces, completely decoupling persistence from presentation.

5. **Real-Time Readiness (`src/lib/realtime/events.ts`)**:
   Strongly-typed workspace event contracts ready for upcoming WebSockets/SSE integration without UI rewrites.

---

## 📖 Adding a New Feature Module

Refer to [`docs/conventions.md`](docs/conventions.md) for full guidelines on adding schemas, query keys, API callers, and hooks.
