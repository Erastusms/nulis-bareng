# Development Conventions & Code Guidelines

## 1. Naming Conventions

### File & Directory Names

- **Components**: PascalCase (e.g., `Button.tsx`, `WorkspaceHeader.tsx`)
- **Hooks**: camelCase prefixed with `use` (e.g., `useWorkspaces.ts`, `useBoard.ts`)
- **Utilities & Modules**: kebab-case or camelCase (e.g., `query-keys.ts`, `errors.ts`, `utils.ts`)
- **Feature Directories**: kebab-case singular or plural (e.g., `src/features/workspace/`)

### TypeScript Types & Schemas

- **Interfaces / Types**: PascalCase (e.g., `Workspace`, `CreateWorkspaceInput`, `ApiResponse<T>`)
- **Zod Schemas**: camelCase ending in `Schema` (e.g., `createWorkspaceSchema`, `loginSchema`)

---

## 2. Directory Structure Conventions

```text
src/
├── app/                  # Next.js App Router (pages, layouts, route handlers)
├── components/ui/        # Shared, domain-agnostic UI primitives
├── config/               # Application configuration and validated environment
├── features/<name>/      # Feature-oriented domain modules
│   ├── api/              # API request callers
│   ├── components/       # Feature-specific UI components
│   ├── hooks/            # TanStack Query & state hooks
│   ├── schemas/          # Zod validation schemas
│   └── types/            # Feature-specific DTOs and types
├── lib/                  # Reusable infrastructure (api client, query keys, realtime)
├── providers/            # React context providers
├── server/               # Backend domain services & repository interfaces
└── types/                # Core domain entity definitions
```

---

## 3. How to Add a New Feature Module

Follow this 5-step checklist when adding a new domain feature (e.g., `features/comment`):

1. **Define Types & Schemas**:
   - Add domain entity in `src/types/domain.ts`.
   - Create `src/features/<feature>/schemas/<feature>.schema.ts` with Zod validation.
   - Re-export in `src/features/<feature>/types/index.ts`.

2. **Add Query Key Factory**:
   - Add the feature's query keys in `src/lib/query/query-keys.ts`.

3. **Implement API Callers**:
   - Add typed API endpoints in `src/features/<feature>/api/`.
   - Use `apiClient.get()`, `apiClient.post()`, etc.

4. **Create React Query Hooks**:
   - Add `useQuery` or `useMutation` hooks in `src/features/<feature>/hooks/`.

5. **Build UI Components**:
   - Compose components in `src/features/<feature>/components/` using generic UI primitives from `src/components/ui/`.
