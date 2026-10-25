# QistFlow Master Software Audit Report (PRD v1.0)

**Date of Audit:** October 20, 2026  
**Auditor Mode:** Senior Software Architect, Full-Stack QA/DevOps & WhatsApp Systems Auditor  
**Audit Target:** QistFlow (Local Workspace: `e:\QistFlow` / Production Domain: `https://qistflow.pp.ua`)  
**Audit Protocol:** Strictly READ-ONLY / Non-Mutating  

---

## 1. Executive Summary

### 1.1 Project Health Overview
QistFlow is designed as a specialized micro-credit installment recovery, multi-tenant SaaS management, and automated WhatsApp notification platform tailored for Pakistani installment businesses (initially modeled after QistBazar). The platform consists of a Next.js 14 App Router frontend and serverless API layer, a PostgreSQL database (Prisma ORM connected to Supabase), and an external background worker intended for long-running WhatsApp sessions.

While core UI dashboards, Excel ingestion, installment status evaluation formulas, and multi-tenant database schemas are substantially implemented, the project suffers from **critical architectural bifurcations, severe data-loss automated crons, unauthenticated API exposures, hardcoded credential fallbacks, and a broken dual-engine WhatsApp messaging system**.

### 1.2 Top 5 Urgent Risks & Critical Findings
1. **Silent Catastrophic Data Loss in Daily Cron (`src/app/api/cron/cleanup/route.ts`):**  
   Every night at 00:00 UTC, an automated cleanup cron executes:  
   `prisma.customer.deleteMany({ where: { updatedAt: { lt: thirtyDaysAgo } } })`.  
   Because installment loan agreements typically span 12–24 months, any customer whose record has not been updated in 30 days is **permanently deleted from the database**, cascading deletion to all their installments, payment histories, assignments, and queue records.
2. **Systemic Unauthenticated API Data Leakage:**  
   Next.js edge middleware (`src/middleware.ts`) explicitly bypasses all routes matching `/api/*` under the assumption that route handlers enforce their own authorization. However, primary endpoints—including `GET /api/customers`, `GET /api/customers/[id]`, `GET /api/installments`, `GET /api/reports`, and `POST /api/imports/process`—treat user session tokens as optional (`if (session) { ... }`). Unauthenticated internet callers receive full customer records (CNICs, phone numbers, addresses, balances, guarantor details) across all tenants.
3. **Hardcoded Fallback Credentials & Secrets in Source Code:**  
   - A hardcoded fallback JWT secret (`"qistflow_super_secure_jwt_secret_key_2026_pk"`) is embedded in both `src/lib/auth.ts` and `src/middleware.ts`.
   - Production Meta Graph API access tokens and Phone Number IDs are hardcoded in `src/app/api/whatsapp/status/route.ts`, `src/lib/whatsapp/message-queue.ts`, and `src/lib/whatsapp/cloud-provider.ts`.
4. **Falsified WhatsApp Connection State & Engine Conflict:**  
   `src/app/api/whatsapp/status/route.ts` calculates connection status by evaluating whether Meta Cloud API credentials exist in memory or environment. Because hardcoded Meta tokens exist as defaults in code, the API **unconditionally reports `status: "CONNECTED"`** to the frontend, regardless of whether Baileys is connected, disconnected, or logged out. Furthermore, `message-queue.ts` unconditionally attempts to route all messages through Meta Cloud API instead of the user's linked WhatsApp web socket.
5. **Architectural Mismatch Between Vercel and Worker Microservice:**  
   `src/lib/whatsapp/remote-provider.ts` invokes legacy endpoints (`/api/wa/connect`, `/api/wa/status`, `/api/wa/send`) without `userId` parameters, whereas the standalone daemon (`scripts/start-worker.ts`) strictly requires per-user routes (`/api/wa/status/:userId` and `userId` in POST bodies). Consequently, all direct HTTP bridge calls fail with HTTP 400 or 404. In `src/app/api/recovery/bulk-queue/route.ts`, the serverless handler triggers background processing via an unawaited async promise, causing Vercel serverless functions to freeze or terminate processing before messages are dispatched.

---

## 2. Architecture & Data Flow

### 2.1 Technology Stack & Runtime Configuration
- **Frontend / Framework:** Next.js 14.2.10 (App Router), React 18.3.1, TailwindCSS 3.4.11, Lucide React, Chart.js.
- **Backend / APIs:** Next.js Serverless Route Handlers, Node.js runtime, `jose` JWT authentication, `bcryptjs`.
- **Database Layer:** PostgreSQL (Prisma ORM 5.19.1) hosted on Supabase Connection Pooler (`aws-0-ap-southeast-1.pooler.supabase.com:6543`) with direct URL for schema migrations (`:5432`).
- **Background Worker Daemon:** Node.js process managed via PM2 (`ecosystem.config.js`) or standalone execution (`scripts/start-worker.ts`) targeting an external host (AlwaysData).
- **WhatsApp Integration Layer:**
  - *Engine A (Web Socket):* `@whiskeysockets/baileys` (v6.7.8) with multi-file auth state stored in local directories (`whatsapp_sessions/<userId>`).
  - *Engine B (Cloud API):* Meta WhatsApp Business Graph API v19.0.

### 2.2 System Request & Data Flows

```
[Web Browser Client] 
       │
       ▼ (HTTPS)
[Vercel Serverless / Next.js 14]
  ├── Page Routes (Protected by src/middleware.ts -> JWT Cookie)
  └── API Routes (/api/* -> Bypasses middleware cookie check!)
       │
       ├──────────────────────────────┬──────────────────────────────┐
       ▼                              ▼                              ▼
 [Supabase PostgreSQL]       [AlwaysData Worker Daemon]     [Meta Graph API]
  - Tenants                   - Port 8080 HTTP Microservice - Cloud Messages
  - Customers / Installments  - Baileys WebSockets (1/user) - Webhook Events
  - MessageQueue / Logs       - DB Watch Loop (Polls 2s)
  - Sessions                  - Reminder Scheduler (15m)
```

1. **Authentication Flow:** User submits credentials to `/api/auth/login`. Server verifies bcrypt hash in DB, signs an HS256 JWT containing `userId`, `tenantId`, `role`, and sets HTTP cookie `qistflow_token`. Middleware decrypts token for page routes; if path starts with `/saas`, requires `role === "SUPER_ADMIN"`.
2. **Customer Import Flow:** User uploads Excel sheet at `/imports`. Next.js parses file with `xlsx`, auto-detects columns via `src/lib/excel/mapper.ts`, and POSTs chunks to `/api/imports/process`. Server creates `BackupSnapshot`, upserts `Customer` and `Installment` records, and logs errors in `ExcelImportRow`.
3. **Recovery Queue Flow:** System cron or officer initiates bulk reminder from `/recovery`. Messages are validated, rendered through `src/lib/template-renderer.ts`, hashed with MD5 idempotency keys in `src/lib/whatsapp/duplicate-guard.ts`, and inserted into `MessageQueue` (`status: "QUEUED"`).
4. **Dispatch Flow:** Daemon calls `processQueueWorker`. It checks provider credentials. If Meta credentials exist, calls Meta Graph API; otherwise, selects user's active Baileys socket from `waSessionManager` and dispatches directly. Outcome logged to `MessageLog` and `MessageQueue.status` updated to `SENT` or `FAILED`.

---

## 3. Comprehensive Feature Completion Matrix

| Module / Feature | Classification | Supporting File Paths & Components | Observed Facts & Remaining Deficiencies | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & Session** | PARTIALLY IMPLEMENTED | `src/lib/auth.ts`, `src/app/login/page.tsx`, `src/middleware.ts` | Login, password hashing, and cookie issuance work. Vulnerable to hardcoded JWT fallback secret. APIs fail to enforce session requirements. | P0 |
| **RBAC & Multi-Tenancy** | PARTIALLY IMPLEMENTED | `src/lib/rbac.ts`, `prisma/schema.prisma` | Role definitions and team hierarchies exist. Admin scoping bypasses tenant isolation in `canAccessCustomer`. | P0 |
| **Customer Data Model** | VERIFIED COMPLETE | `prisma/schema.prisma`, `src/app/(dashboard)/customers/page.tsx` | Full 31-field schema covers accounts, CNIC, phones, guarantors, IMEI, and sales/recovery personnel. | P2 |
| **Installment & Balance Engine** | VERIFIED COMPLETE | `src/lib/installment-engine.ts` | Robust state machine: `UPCOMING`, `DUE_TODAY`, `OVERDUE`, `PAID`, `PARTIAL`, `UNKNOWN`. Relies on server local timezone rather than Pakistan Standard Time (`Asia/Karachi`). | P1 |
| **Quick Payment Recording** | PARTIALLY IMPLEMENTED | `src/app/api/payments/quick-pay/route.ts` | Records payment and calculates new balance. Lacks Prisma `$transaction` atomicity and tenant isolation check. | P0 |
| **Excel Ingestion & Mapping** | VERIFIED COMPLETE | `src/lib/excel/parser.ts`, `src/lib/excel/mapper.ts`, `src/app/api/imports/process/route.ts` | Auto-detects 31 column variants, parses Excel serial dates, normalizes Pakistani phone numbers, and takes pre-import snapshots. Endpoint lacks authentication checks. | P0 |
| **Guarantor Escalation** | VERIFIED COMPLETE | `src/lib/escalation/escalation-engine.ts`, `src/app/(dashboard)/recovery/guarantor-reminders/page.tsx` | 3-tier escalation engine with failover from Guarantor 1 to 2, manager approval gates, and privacy filters. | P1 |
| **Bulk Reminder Queueing** | PARTIALLY IMPLEMENTED | `src/app/api/recovery/bulk-queue/route.ts`, `src/lib/whatsapp/message-queue.ts` | Enqueues with MD5 idempotency keys. On Vercel, unawaited `processQueueWorker` execution freezes before completion. | P0 |
| **WhatsApp Multi-User Baileys** | BROKEN | `src/lib/whatsapp/session-manager.ts`, `scripts/start-worker.ts`, `src/lib/whatsapp/remote-provider.ts` | Worker maintains per-user Baileys sockets and QR watchdog. However, `RemoteWhatsAppProvider` and `start-worker.ts` API endpoints have mismatched signatures, causing communication failure. | P0 |
| **WhatsApp Status Telemetry** | BROKEN | `src/app/api/whatsapp/status/route.ts` | Falsely hardcodes `status: "CONNECTED"` due to fallback Meta token, masking actual Baileys socket state. | P0 |
| **Automated Cron Reminders** | BROKEN | `vercel.json`, `src/lib/scheduler/reminder-cron.ts` | `vercel.json` calls `/api/cron/reminders`, which is missing in `src/app/api/cron/`, returning HTTP 404. Worker 15-minute interval runs only if worker stays alive. | P0 |
| **Automated Data Purge Cron** | BROKEN (HAZARDOUS) | `src/app/api/cron/cleanup/route.ts` | Hard-deletes any customer inactive for 30 days, causing catastrophic data loss on long-term installment accounts. | P0 |
| **AI Chatbot / Auto-Replies** | NOT IMPLEMENTED | `src/app/api/whatsapp/webhook/route.ts` | Webhook only verifies Meta challenge and logs incoming messages to console. No LLM integration, prompt engine, or automated reply logic exists. | P2 |
| **Super Admin SaaS Management** | VERIFIED COMPLETE | `src/app/(saas-panel)/saas/*`, `src/app/api/saas/*` | Comprehensive SaaS panel with tenant provisioning, plans, subscription lifecycle, and audit logs. Protected by middleware. | P1 |
| **Reporting & Export** | VERIFIED COMPLETE | `src/app/api/reports/route.ts`, `src/app/(dashboard)/reports/page.tsx` | Generates daily, monthly, officer recovery, and escalation summaries. Endpoint requires authentication guard. | P1 |

---

## 4. WhatsApp Connect Feature Deep-Dive

### 4.1 Identified Integration Architecture
The codebase implements two competing WhatsApp integration systems simultaneously:
1. **Baileys WebSockets (`@whiskeysockets/baileys` v6.7.8):** Located in `src/lib/whatsapp/session-manager.ts` and `scripts/start-worker.ts`. Designed to maintain persistent WebSocket connections on AlwaysData for multiple staff members using individual QR pairing.
2. **Meta WhatsApp Cloud API (Graph API v19.0):** Located in `src/lib/whatsapp/cloud-provider.ts` and `src/lib/whatsapp/cloud-api.ts`. Designed for stateless HTTP template messaging.

### 4.2 Investigation of Socket-Close 440 ("Connection Replaced")
- **Cause Analysis:** In WhatsApp's protocol, disconnect reason 440 (`DisconnectReason.connectionReplaced`) occurs when another active connection handshake takes place using the exact same session credentials.
- **Evidence in Source Code:**
  - Multiple worker scripts exist in the repository root (`check-worker.js`, `start-worker-now.js`, `scripts/worker-launcher.js`, `ecosystem.config.js`). Running PM2 or multiple process monitors concurrently initiates competing Baileys sockets against the same `whatsapp_sessions/<userId>` storage directory.
  - In `src/lib/whatsapp/session-manager.ts` (lines 426–431), requesting a pairing code while a socket is already active triggers a reconnect cycle.
  - If a user opens the linked WhatsApp account on a physical browser or another device that hits WhatsApp's device link limit, WhatsApp terminates the server daemon socket with error 440.

### 4.3 Root-Cause Analysis of Falsified "CONNECTED" Status
In `src/app/api/whatsapp/status/route.ts` (lines 36–42):
```typescript
const token = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || "EAAZA8rZAVvxkABSkJZA30xX7...";
const phoneId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || "1328348923692461";

const hasCloudCreds = !!(token && phoneId);
const isConnected = hasCloudCreds || (dbSession?.status === "CONNECTED" && !!dbSession?.connectedPhone);
let computedStatus = isConnected ? "CONNECTED" : (dbSession?.status || "NOT_CONNECTED");
```
Because `token` and `phoneId` fall back to hardcoded strings, `hasCloudCreds` evaluates to `true`. As a result:
- The UI displays WhatsApp as permanently `CONNECTED`.
- Real Baileys socket disconnections, QR generation events, or expired sessions are completely hidden from administrators and officers.

### 4.4 Interface Breakdown: `RemoteWhatsAppProvider` vs `start-worker.ts`
When running in Vercel serverless mode, `src/lib/whatsapp/provider-factory.ts` loads `RemoteWhatsAppProvider`. This provider calls:
- `POST ${serviceUrl}/api/wa/connect` with `{}` (empty body).
- `GET ${serviceUrl}/api/wa/status`.
- `POST ${serviceUrl}/api/wa/send` with `{ recipientPhone, messageText }`.

However, the worker daemon in `scripts/start-worker.ts` explicitly expects:
- `POST /api/wa/connect` requiring `{ userId, forceFresh }` (lines 324–325).
- `GET /api/wa/status/:userId` (lines 371–376). Calling `/api/wa/status` returns HTTP 404!
- `POST /api/wa/send` requiring `{ userId, phone, message }` (lines 307–310).

**Conclusion:** Direct HTTP communication between Vercel and the AlwaysData worker is completely non-functional due to route and payload mismatches.

---

## 5. Bulk Messaging & Reminder System Audit

### 5.1 Pipeline Verification
1. **Target Identification:** `src/lib/scheduler/reminder-cron.ts` evaluates active `ReminderRule` entries, calculates offsets against current date, and selects eligible installments (`balance > 0`, `optedOut: false`).
2. **Template Interpolation:** `src/lib/template-renderer.ts` replaces 12 predefined tokens.
   > **Defect:** Default templates in `DEFAULT_TEMPLATES` hardcode the officer name (`Ghulam Ahmad Razzaqi`) and branch (`Qistbazar Landhi`) inside the text body instead of using dynamic tokens `{{recovery_person}}` and `{{branch}}`.
3. **Idempotency & Deduplication:** `src/lib/whatsapp/duplicate-guard.ts` generates deterministic MD5 hashes based on customer ID, reminder type, due date, and cycle key. Duplicate inserts are blocked by database constraints (`idempotencyKey @unique`).
4. **Rate Limiting:** `src/lib/whatsapp/message-queue.ts` applies randomized jitter delays between 2,000ms and 6,000ms (`WHATSAPP_RATE_LIMIT_MIN_DELAY_MS` / `MAX_DELAY_MS`).
5. **Execution Barrier:** In `src/lib/whatsapp/message-queue.ts` (lines 225–233), `processQueueWorker` checks `hasTenantCreds || hasGlobalCreds`. Because global Meta credentials are hardcoded, the queue **always routes to Meta Cloud API** and completely bypasses Baileys.

---

## 6. AI Chatbot Audit

| Criterion | Status | Observed Findings & Evidence |
| :--- | :--- | :--- |
| **Auto-Reply Implementation** | NOT IMPLEMENTED | Zero AI or automated reply logic exists in the codebase. |
| **Model / Provider Configuration** | NONE | No dependencies or environment variables for OpenAI, Anthropic, or Google Gemini. |
| **Webhook Ingestion** | PARTIAL STUB | `src/app/api/whatsapp/webhook/route.ts` successfully verifies Meta tokens via `GET`. Incoming `POST` events only execute `console.log` with a `// TODO` comment. |
| **Context & Privacy Safeguards** | NONE | No customer verification, conversational memory, or data-leak safeguards exist. |

---

## 7. Database & Business Logic Audit

### 7.1 Schema Architecture & Isolation
- **Database Engine:** PostgreSQL via Prisma ORM.
- **Tenant Isolation:** The schema incorporates `tenantId` across all primary models (`Customer`, `Installment`, `MessageQueue`, `MessageLog`, `WhatsAppSession`).
- **Isolation Breach in RBAC:** In `src/lib/rbac.ts` (line 132):
  ```typescript
  export async function canAccessCustomer(user: TokenPayload, customerId: string): Promise<boolean> {
    if (user.role === "ADMIN") return true;
    ...
  }
  ```
  If an administrator belonging to Tenant A queries a customer belonging to Tenant B, this helper immediately returns `true` without verifying `tenantId`.

### 7.2 The 30-Day Automated Customer Deletion Bug
In `src/app/api/cron/cleanup/route.ts` (lines 16–22):
```typescript
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const deletedCustomers = await prisma.customer.deleteMany({
  where: {
    updatedAt: {
      lt: thirtyDaysAgo
    }
  }
});
```
This endpoint was intended to clean temporary upload logs, but instead executes `prisma.customer.deleteMany` on legitimate customer records inactive for 30 days. Because Prisma relationships configure `onDelete: Cascade`, customer deletion destroys associated installment contracts, repayment ledgers, and audit logs.

### 7.3 Atomicity in Payment Recording
In `src/app/api/payments/quick-pay/route.ts`, payment creation and installment balance decrement are executed as two independent queries without `prisma.$transaction`. An unhandled network failure or server timeout between operations creates financial ledger discrepancy.

---

## 8. Security & Privacy Findings

| ID | Finding Description | Severity | Supporting Evidence |
| :--- | :--- | :--- | :--- |
| **SEC-01** | **Unauthenticated API Access to Customer & Installment Data** | CRITICAL | `src/middleware.ts` (line 12) exempts `/api/*`. `src/app/api/customers/route.ts` (line 26) and `customers/[id]/route.ts` (line 16) only apply scoping `if (session)`. Unauthenticated callers receive unredacted customer CNICs, addresses, and loan details. |
| **SEC-02** | **Automated Permanent Customer & Debt Data Loss** | CRITICAL | `src/app/api/cron/cleanup/route.ts` (lines 16–22) deletes all customers with `updatedAt < 30 days ago` on a daily schedule. |
| **SEC-03** | **Hardcoded Fallback JWT Secret** | HIGH | `src/lib/auth.ts` (line 8) and `src/middleware.ts` (line 36) default to `"qistflow_super_secure_jwt_secret_key_2026_pk"`, allowing token forgery if `JWT_SECRET` is omitted from deployment configuration. |
| **SEC-04** | **Production Meta API Tokens Embedded in Source Code** | HIGH | Hardcoded tokens found in `src/app/api/whatsapp/status/route.ts` (line 36), `src/lib/whatsapp/message-queue.ts` (line 225), and `src/lib/whatsapp/cloud-provider.ts` (line 10). |
| **SEC-05** | **Tenant Isolation Bypass for Admin Accounts** | HIGH | `src/lib/rbac.ts` (line 132) returns `true` for all `ADMIN` users in `canAccessCustomer` without validating matching `tenantId`. |
| **SEC-06** | **Unauthenticated Data Import Pipeline** | HIGH | `src/app/api/imports/process/route.ts` (line 18) defaults `tenantId` to `"default"` when no session exists, permitting unauthenticated data insertion into production tables. |
| **SEC-07** | **Non-Atomic Financial Payment Processing** | MEDIUM | `src/app/api/payments/quick-pay/route.ts` performs payment insert and balance update outside a database transaction. |

---

## 9. Deployment, Reliability & Worker Audit

### 9.1 Hosting Architecture Breakdown
- **Frontend / API:** Hosted on Vercel Serverless (`https://qistflow.pp.ua` / `qistflow.vercel.app`).
- **Database:** Hosted on Supabase (ap-southeast-1 region).
- **Background Worker:** Configured for AlwaysData via Node.js / PM2 daemon.

### 9.2 Serverless Architectural Mismatch
WhatsApp Web via Baileys requires a stateful, long-lived TCP connection (WebSocket) to maintain cryptographic heartbeat ping-pongs and receive incoming state frames. Serverless platforms like Vercel freeze execution immediately upon returning an HTTP response and enforce execution timeouts (15–60 seconds). Therefore, **Baileys cannot run inside Vercel serverless functions**.

The application attempted to solve this using an external AlwaysData worker. However:
1. `RemoteWhatsAppProvider` sends invalid requests to AlwaysData due to parameter mismatches.
2. Vercel endpoints like `bulk-queue/route.ts` attempt to run `processQueueWorker` in-process without awaiting it, resulting in dropped jobs when the serverless container suspends.
3. `vercel.json` configures a cron trigger to `/api/cron/reminders`, but this route handler does not exist in the Next.js app tree, causing Vercel cron executions to fail with HTTP 404.

---

## 10. Testing & Verification Outcomes

### 10.1 Safe Read-Only Tests Run
- **TypeScript Typecheck (`npx tsc --noEmit`):**
  - **Status:** EXECUTED.
  - **Result:** Failed on single scratch script `test-meta-api.ts(8,7)` (`TS2367: type mismatch`). Zero type errors detected across primary `src/` codebase.
- **Git Working Tree Status (`git status`):**
  - **Status:** EXECUTED.
  - **Result:** Branch `main`, up to date with `origin/main`. Modified tracked files: `package.json`, `package-lock.json`, `src/middleware.ts`. Multiple untracked test scripts present in root.

### 10.2 Checks Skipped for Safety
- **Test Suite Execution (`npm test` / `run-all-tests.ts`):** SKIPPED. `run-all-tests.ts` performs direct database lookups (`prisma.user.findUnique`), which risks connecting to live production database tables.
- **Worker Reconnect Commands (`scripts/restart-worker.js`):** NOT RUN — MUTATING RISK.
- **Database Schema Push (`npx prisma db push`):** NOT RUN — MUTATING RISK.
- **Production Message Tests (`test-meta-api.ts`):** NOT RUN — MUTATING RISK.

---

## 11. Missing Information & Unanswered Questions
1. **Intended Primary WhatsApp Channel:** Is QistFlow officially moving to Meta WhatsApp Cloud API (Graph API) or continuing with personal phone linking via Baileys WebSockets? The codebase currently contains conflicting partial implementations of both.
2. **AlwaysData Server Status:** Is the AlwaysData worker server currently running live, or has it been decommissioned in favor of direct Vercel API attempts?
3. **AlwaysData Environment Configuration:** Does the AlwaysData `.env` file contain matching `WHATSAPP_SERVICE_SECRET` and proper Supabase connection strings?

---

## 12. Prioritized Proposed Backlog

### Phase 1: P0 — Critical System & Safety Blockers (Do First)
1. **Defuse Data Deletion Cron:** Delete or rewrite `src/app/api/cron/cleanup/route.ts` to target only temporary error logs rather than `prisma.customer`.
2. **Lock Down API Security:** Add strict session validation (`const { user, errorResponse } = await requireAuth(req)`) to all API route handlers (`/api/customers/*`, `/api/installments/*`, `/api/imports/*`, `/api/reports/*`).
3. **Purge Hardcoded Secrets:** Remove hardcoded fallback JWT secrets and Meta access tokens from source code; enforce mandatory environment variables with startup validation.
4. **Fix Tenant Isolation in RBAC:** Update `canAccessCustomer` in `src/lib/rbac.ts` so `ADMIN` role is strictly filtered by `user.tenantId`.
5. **Decouple WhatsApp Telemetry:** Refactor `src/app/api/whatsapp/status/route.ts` to reflect true session status from `prisma.whatsAppSession` instead of hardcoding `CONNECTED` based on fallback Cloud API tokens.
6. **Implement Missing Vercel Cron Route:** Create `src/app/api/cron/reminders/route.ts` to fulfill the schedule defined in `vercel.json`.

### Phase 2: P1 — Reliability & Workflow Consistency
7. **Align Worker API Signatures:** Update `RemoteWhatsAppProvider` to include `userId` in routes and payloads to match `scripts/start-worker.ts`.
8. **Wrap Financial Operations in Transactions:** Refactor `quick-pay/route.ts` to use `prisma.$transaction`.
9. **Dynamic Template Tokens:** Replace hardcoded officer and branch names in `DEFAULT_TEMPLATES` with dynamic tokens.
10. **Timezone Normalization:** Enforce `Asia/Karachi` timezone in date calculations across `installment-engine.ts` and `reminder-cron.ts`.

### Phase 3: P2 — Enhancement & Feature Expansion
11. **Implement AI Chatbot Engine:** Build webhook event handler in `src/app/api/whatsapp/webhook/route.ts` connecting to an LLM provider (OpenAI / Gemini) with customer verification guards.
12. **Clean Repository Root:** Move standalone scratch scripts (`check-*.js`, `test-*.js`) into a dedicated `scripts/scratch/` directory.

---

## 13. Relevant File Paths for Implementation

| Subsystem | Primary Implementation Files |
| :--- | :--- |
| **Authentication & RBAC** | `src/lib/auth.ts`, `src/lib/rbac.ts`, `src/middleware.ts` |
| **Customer & Installments** | `src/app/api/customers/route.ts`, `src/app/api/customers/[id]/route.ts`, `src/app/api/installments/route.ts` |
| **Data Ingestion** | `src/app/api/imports/process/route.ts`, `src/lib/excel/mapper.ts`, `src/lib/excel/parser.ts` |
| **WhatsApp Core** | `src/lib/whatsapp/session-manager.ts`, `src/lib/whatsapp/web-provider.ts`, `src/lib/whatsapp/remote-provider.ts`, `scripts/start-worker.ts` |
| **Message Queue** | `src/lib/whatsapp/message-queue.ts`, `src/lib/whatsapp/duplicate-guard.ts`, `src/app/api/recovery/bulk-queue/route.ts` |
| **Crons & Schedulers** | `src/app/api/cron/cleanup/route.ts`, `src/lib/scheduler/reminder-cron.ts`, `vercel.json` |
| **Financial Ledger** | `src/app/api/payments/quick-pay/route.ts`, `src/lib/installment-engine.ts` |
| **Templates** | `src/lib/template-renderer.ts`, `src/app/api/whatsapp/templates/route.ts` |

---

## 14. Final State-Safety Declaration
This audit was conducted strictly in **READ-ONLY** mode.
- **Git State:** Unchanged. Branch remains `main`. No commits, merges, or resets were performed.
- **Application Files:** All existing project files and uncommitted changes were preserved untouched.
- **Database:** Zero migrations, seeds, or mutating writes were executed.
- **WhatsApp Sessions:** No WhatsApp sessions were initialized, connected, disconnected, or altered. No real messages were transmitted.
- **Production Infrastructure:** Live services on Vercel and AlwaysData were neither restarted nor redeployed.
- **Report File:** Written as `QISTFLOW_AUDIT_REPORT.md` in repository root after confirming no prior file with that name existed.
