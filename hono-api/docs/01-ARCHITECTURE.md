# MPMS Backend Architecture

## Overview

Backend untuk MPMS (Mersi Project Management System) dibangun dengan stack:

- **HonoJS** - Web framework (Bun runtime)
- **Drizzle ORM** - TypeScript ORM untuk PostgreSQL
- **PostgreSQL** - Relational database
- **JWT** - Authentication via httpOnly cookie (`hono/jwt`)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Next.js)                               │
│                         ┌─────────────────────┐                             │
│                         │   Zustand Store     │                             │
│                         │  (local state)      │                             │
│                         └──────────┬──────────┘                             │
│                                    │                                        │
│                         ┌──────────▼──────────┐                             │
│                         │   API Client        │                             │
│                         │  (fetch, credentials│                             │
│                         │   : 'include')      │                             │
│                         └──────────┬──────────┘                             │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ HTTPS/JSON + httpOnly Cookie
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HONOJS SERVER                                  │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    CORS      │  │  requireAuth │  │  requireRole │  │    Error     │    │
│  │  Middleware  │  │ (JWT verify) │  │    (RBAC)    │  │   Handler    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                          VALIDATION LAYER                            │   │
│  │         validateParams() │ validateJson() │ validateQuery()          │   │
│  │                    (Zod + @hono/zod-validator)                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                             ROUTES                                   │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │   │
│  │  │ /auth  │ │ /users │ │ /depts │ │/projts │ │ /tasks │ │/master │  │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                          CONTROLLERS                                 │   │
│  │            (thin — extract validated data, call service)             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           SERVICES                                   │   │
│  │            (business logic, DB queries, throw DomainErrors)          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                         ┌──────────▼──────────┐                             │
│                         │    Drizzle ORM      │                             │
│                         │  (Type-safe SQL)    │                             │
│                         └──────────┬──────────┘                             │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ SQL
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               POSTGRESQL                                    │
│                                                                             │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐  ┌─────────────┐  ┌─────────┐  │
│  │  user   │  │projects │  │task_instances│  │master_tasks │  │comments │  │
│  └─────────┘  └─────────┘  └──────────────┘  └─────────────┘  └─────────┘  │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ departments │  │  activities │  │task_approvals│  │ media_assets │      │
│  └─────────────┘  └─────────────┘  └──────────────┘  └──────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layered Architecture (MVCS)

```
Request
  │
  ├─→ Route          middleware chain: requireAuth → requireRole
  │
  ├─→ Validation     validateParams / validateJson / validateQuery (Zod middleware)
  │                  schema defined in src/validations/*.validation.ts
  │
  ├─→ Controller     extract validated data via getValidParam/Json/Query
  │                  call service method, return sendSuccess/sendPaginated
  │
  ├─→ Service        business logic, DB queries via Drizzle
  │                  throw DomainErrors (NotFoundError, ConflictError, etc.)
  │
  └─→ Database       PostgreSQL via Drizzle ORM
```

### Request Flow Example

```
PATCH /api/tasks/:id/submit
  → requireAuth          (verify JWT cookie → inject user to context)
  → requireMinRole("SPV")
  → validateParams(taskIdParamSchema)   (400 if :id invalid)
  → validateJson(submitTaskSchema)      (422 if body invalid)
  → TaskController.submit(c)
      └─→ TaskService.submit(id, userId, body)
              └─→ db.update(taskInstances)...
                  └─→ throw NotFoundError / ForbiddenError if needed
  ← sendSuccess(c, data)
```

---

## Module Structure

```
src/
├── index.ts                    # Entry point, mount routes, global middleware
├── config/
│   ├── env.ts                  # Zod-validated env vars (fails fast on startup)
│   ├── database.ts             # Drizzle ORM + pg Pool
│   └── auth.ts                 # JWT signToken() / verifyToken() helpers
│
├── db/
│   ├── schema/
│   │   ├── index.ts            # Export all schemas + Drizzle relations
│   │   ├── auth-schema.ts      # user table (id, email, role, soft delete, ...)
│   │   ├── users.ts            # userRoleEnum
│   │   ├── departments.ts      # departments table
│   │   ├── projects.ts         # projects table
│   │   ├── master-tasks.ts     # master_tasks table
│   │   ├── task-instances.ts   # task_instances table
│   │   ├── task-approvals.ts   # task_approvals table
│   │   ├── comments.ts         # task_comments table
│   │   ├── activities.ts       # activity_entries table (no soft delete)
│   │   └── media-assets.ts     # media_assets table
│   ├── migrations/             # Auto-generated by drizzle-kit
│   └── seed.ts                 # Seed script from data/mock-*.ts
│
├── middleware/
│   ├── auth.ts                 # requireAuth, getCurrentUser (reads JWT cookie)
│   ├── rbac.ts                 # requireRole(), requireMinRole()
│   ├── validator.ts            # validateJson(), validateParams(), validateQuery()
│   └── error-handler.ts        # Catches DomainError → structured JSON response
│
├── validations/                # Zod schemas + inferred types, one file per module
│   ├── task.validation.ts
│   ├── department.validation.ts
│   └── user.validation.ts
│
├── routes/                     # Thin: middleware chain + controller call only
│   ├── index.ts
│   ├── auth.routes.ts
│   ├── users.routes.ts
│   ├── departments.routes.ts
│   ├── projects.routes.ts
│   ├── tasks.routes.ts
│   ├── master-tasks.routes.ts
│   ├── comments.routes.ts
│   ├── activities.routes.ts
│   └── upload.routes.ts
│
├── controllers/                # HTTP handlers — extract data, call service
│   ├── auth.controller.ts
│   ├── user.controller.ts
│   ├── department.controller.ts
│   ├── project.controller.ts
│   ├── task.controller.ts
│   ├── master-task.controller.ts
│   ├── comment.controller.ts
│   ├── activity.controller.ts
│   └── upload.controller.ts
│
├── services/                   # Business logic + DB queries
│   ├── user.service.ts
│   ├── department.service.ts
│   ├── project.service.ts      # Project CRUD, task generation, stats
│   ├── task.service.ts         # Task state machine, approval workflow
│   ├── upload.service.ts       # S3-compatible object storage
│   └── activity.service.ts     # Audit log writer
│
├── lib/
│   ├── errors.ts               # DomainError base + typed subclasses
│   ├── task-access.ts          # canViewTask(), canApproveTask(), canSubmitTask()
│   ├── task-logic.ts           # State transition validation rules
│   ├── task-generator.ts       # Generate task instances from master tasks
│   ├── constants.ts            # Enums, ACTIVITY_ACTIONS
│   └── utils.ts                # generateId(), formatError(), safeParseJSONB()
│
└── utils/
    └── response.ts             # sendSuccess(), sendPaginated(), sendError(),
                                # getValidParam(), getValidQuery(), getValidJson()
```

---

## Entity Relationship Diagram (ERD)

```
┌─────────────────┐     ┌──────────────────────────┐
│   departments   │     │           user            │
├─────────────────┤     ├──────────────────────────┤
│ id (PK)         │◄────┤ id (PK)                  │
│ code (UQ)       │     │ name                     │
│ name            │     │ email (UQ)               │
│ color           │     │ role                     │
│ textColor       │     │ departmentCode (FK→dept) │
│ isDeleted       │     │ passwordHash             │
│ deletedAt       │     │ emailVerified            │
│ deletedBy       │     │ image                    │
└─────────────────┘     │ isDeleted                │
                        │ deletedAt                │
                        │ deletedBy                │
                        └──────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                projects                                  │
├──────────────────────────────────────────────────────────────────────────┤
│ id (PK) │ code (UQ) │ productName │ type │ status │ description         │
│ startDate │ departmentHeads (JSONB) │ createdBy (FK→user) │ isDeleted   │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            task_instances                                │
├──────────────────────────────────────────────────────────────────────────┤
│ id (PK) │ projectId (FK) │ masterTaskId (FK) │ parentId (FK, self)      │
│ code │ title │ level │ status │ creatorRole │ sortOrder                 │
│ plannedStartDate │ plannedEndDate │ actualStartDate │ actualEndDate      │
│ departmentAssignments (JSONB) │ dependencyIds (UUID[])                  │
│ unusedReason │ previousStatus │ progress │ isDeleted                    │
└──────────────────────────────────────────────────────────────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────────┐  ┌─────────────────┐
│  task_approvals │  │    task_comments    │  │activity_entries │
├─────────────────┤  ├─────────────────────┤  ├─────────────────┤
│ id (PK)         │  │ id (PK)             │  │ id (PK)         │
│ taskInstanceId  │  │ taskInstanceId (FK) │  │ projectId (FK)  │
│ userId (FK)     │  │ projectId (FK)      │  │ taskInstanceId  │
│ role            │  │ userId (FK)         │  │ userId (FK)     │
│ status          │  │ content             │  │ action          │
│ approvedAt      │  │ createdAt           │  │ description     │
│ attachments     │  │ editedAt            │  │ metadata (JSONB)│
└─────────────────┘  └─────────────────────┘  │ timestamp       │
                                               └─────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                              master_tasks                                │
├──────────────────────────────────────────────────────────────────────────┤
│ id (PK) │ code (UQ) │ title │ level │ parentId (FK, self)               │
│ projectTypes (text[]) │ departmentConfig (JSONB) │ approvalConfig (JSONB)│
│ creationConfig (JSONB) │ defaultDurationDays │ dependencyIds (text[])   │
│ sortOrder │ isDeleted                                                    │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                              media_assets                                │
├──────────────────────────────────────────────────────────────────────────┤
│ id (PK) │ filename │ mimeType │ size │ url │ bucket │ key               │
│ createdBy (FK→user) │ entityType │ entityId │ createdAt                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack Details

### HonoJS
- Ultrafast web framework built on Web Standards (Bun runtime)
- Middleware support via `app.use()`
- Context-based request/response handling
- `@hono/zod-validator` untuk typed validation middleware

### Drizzle ORM
- Type-safe SQL query builder
- Schema-first approach dengan TypeScript
- Migration tool (drizzle-kit)
- Relations API untuk foreign keys dan `db.query.*` joins

### JWT Authentication
- Token di-sign dengan `HS256` via `hono/jwt`
- Disimpan di httpOnly cookie `auth_token` (7 hari)
- Payload: `{ sub, name, email, role, departmentCode }`
- `requireAuth` middleware: verify token → inject ke context via `getCurrentUser(c)`

### PostgreSQL
- Relational database dengan JSONB support
- Soft delete pattern di semua entitas utama
- UUID primary keys via `crypto.randomUUID()`

---

## Error Handling

Domain errors di `src/lib/errors.ts` di-throw dari service layer dan ditangkap oleh global error handler:

| Error Class | HTTP Status |
|---|---|
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `ForbiddenError` | 403 |
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |

---

## API Design Principles

### 1. RESTful Endpoints

```
GET    /api/users              # List
POST   /api/users              # Create
GET    /api/users/:id          # Detail
PATCH  /api/users/:id          # Update (partial)
DELETE /api/users/:id          # Soft delete
```

### 2. Consistent Response Format

```json
// Success
{ "success": true, "data": { ... } }

// Paginated
{ "success": true, "data": [...], "meta": { "total": 23, "page": 1, "limit": 50 } }

// Error
{ "success": false, "error": { "message": "...", "code": "NOT_FOUND" } }
```

### 3. Authorization (RBAC)

| Role | Level | Permissions |
|---|---|---|
| ADMIN | 3 | Full access |
| MANAGER | 2 | View all, approve tasks, manage projects |
| SPV | 1 | View department tasks, approve staff submissions |
| STAFF | 0 | View assigned tasks, submit work |

---

## Key Business Logic

### Task State Machine

```
BACKLOG → TODO → IN_PROGRESS → IN_REVIEW → DONE
   │                                        ▲
   └───────────── UNUSED ←──────────────────┘
```

- `BACKLOG → TODO`: harus ada assignee + semua predecessor DONE
- `IN_PROGRESS → IN_REVIEW`: semua department creator submitted
- `IN_REVIEW → DONE`: semua approval chain APPROVED
- Rejection: reset approval chain → kembali ke `IN_PROGRESS`
- Status parent task: auto-derived dari children, tidak bisa di-set manual

### Approval Chain

Berdasarkan `creatorRole`:
- `MANAGER`: pre-approved
- `SPV`: [SPV submit → Manager approve]
- `STAFF`: [Staff submit → SPV approve → Manager approve]

### Soft Delete Pattern

Semua entitas utama (`user`, `departments`, `projects`, `task_instances`, `master_tasks`) menggunakan soft delete:

```typescript
isDeleted: boolean  // default false
deletedAt: timestamp
deletedBy: text (FK → user.id)
```

`activity_entries` adalah satu-satunya table tanpa soft delete (persistent audit log).

---

## Next Steps

1. [02-SETUP.md](./02-SETUP.md) - Project setup & dependencies
2. [03-DATABASE.md](./03-DATABASE.md) - Database schema & migrations
3. [04-AUTH.md](./04-AUTH.md) - Authentication (JWT)
4. [05-API-IMPLEMENTATION.md](./05-API-IMPLEMENTATION.md) - API routes
5. [06-BUSINESS-LOGIC.md](./06-BUSINESS-LOGIC.md) - Business logic services
6. [07-TESTING.md](./07-TESTING.md) - Testing strategy
7. [08-DEPLOYMENT.md](./08-DEPLOYMENT.md) - Deployment guide
