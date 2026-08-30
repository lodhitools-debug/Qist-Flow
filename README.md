# QistFlow — Smart Recovery & WhatsApp Reminder System

![QistFlow](https://img.shields.io/badge/QistFlow-v1.0.0-emerald)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-teal)
![Prisma](https://img.shields.io/badge/Prisma-5.22-indigo)
![Baileys](https://img.shields.io/badge/Baileys-WhatsApp-green)

**QistFlow** is a modern, production-grade recovery management and automated WhatsApp reminder platform purpose-built for installment businesses (specifically designed and tested on **QistBazar** Excel operations).

---

## 🌟 Key Features

### 1. QistBazar Excel Import Engine
- Built directly around the reference report: `ud-recovery_QBLAN_without_2026-08-30.xlsx`.
- **Dynamic 31-Column Mapping**: Auto-detects header positions with admin remapping UI.
- **5-Step Import Pipeline**: Upload → Auto-Map → Validate → Preview → Snapshot & Process.
- **Validation Engine**: Flags invalid phone numbers, missing due dates, duplicate accounts, and provides an instant **Error Report (.xlsx) Download**.
- **Automated Database Snapshots**: Backs up database state prior to every Excel import for rollback safety.

### 2. Installment & Recovery Status Engine
- Computes real-time status: `UPCOMING`, `DUE_TODAY`, `OVERDUE`, `PAID`, `PARTIAL`, `UNKNOWN`.
- Evaluates actual payment dates, remaining balance, and short/excess amounts without guessing.
- Prevents overdue messages from being sent to customers with unknown payment status.
- Supports staff manual status overrides and notes.

### 3. WhatsApp Web QR Connection & Anti-Ban Safety
- Live QR code pairing with automatic multi-file session persistence.
- **Anti-Ban Throttling**: Randomized jitter delays (6s–14s) between messages and daily caps (250 msgs/day).
- **Idempotent Duplicate Prevention**: Md5 hash check `(customerId + type + dueDate + cycle)` ensures customers never receive duplicate reminders on server reboots or re-imports.
- **Modular Provider Abstraction**: Switch between WhatsApp Web (Baileys) and Meta WhatsApp Cloud API effortlessly.

### 4. Automated Reminder Scheduler
- Configurable rules: 1 Day Before Due, Due Today, 1d Overdue, 3d Overdue, 7d Overdue (Urgent), 15d+ Overdue.
- Enforces active business hour time windows (e.g., 10:00 AM – 07:00 PM).
- Background worker processes message queues with automatic retries on network drops.

### 5. Multi-Channel Reporting & Export
- Daily Recovery, Monthly Volume, Recovery Officer Leaderboards, and WhatsApp Delivery Analytics.
- **1-Click Export to Excel (`.xlsx`) and PDF (`.pdf`)**.

---

## 🚀 Quick Start (Local Development)

### 1. Clone & Install Dependencies
```bash
git clone <repo-url> qistflow
cd qistflow
npm install
```

### 2. Environment Configuration
Create `.env` (or copy `.env.example`):
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="qistflow_super_secure_jwt_secret_key_2026_pk"
WHATSAPP_SESSION_PATH="./whatsapp_auth"
WHATSAPP_RATE_LIMIT_MIN_DELAY_MS=6000
WHATSAPP_RATE_LIMIT_MAX_DELAY_MS=14000
WHATSAPP_DAILY_MAX_MESSAGES=250
PORT=3000
NODE_ENV="development"
```

### 3. Initialize Database & Seed
```bash
npx prisma db push
npm run prisma:seed
```

Default credentials:
- **Admin**: `admin@qistflow.com` / `admin123`
- **Manager**: `manager@qistflow.com` / `manager123`
- **Officer**: `officer@qistflow.com` / `officer123`

### 4. Start Next.js Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 5. (Optional) Run Background WhatsApp & Scheduler Worker
In a separate terminal:
```bash
npm run worker
```

---

## 🧪 Testing with Real QistBazar Excel Files

To test the parser and mapping engine against the real `ud-recovery_QBLAN_without_2026-08-30.xlsx` file:
```bash
npm run test:excel
```

---

## 🌐 AlwaysData & Production Deployment

### 1. AlwaysData PostgreSQL Database
1. Log into your **AlwaysData Admin Panel**.
2. Navigate to **Databases** → **PostgreSQL** → **Add a Database** (e.g. `qistflow_db`).
3. Add a database user with full privileges.
4. Copy the connection string to `.env`:
   ```env
   DATABASE_URL="postgresql://username:password@postgresql-username.alwaysdata.net:5432/qistflow_db?schema=public"
   ```
5. Run migrations:
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts
   ```

### 2. Node.js Application Setup on AlwaysData
1. Navigate to **Web** → **Sites** → **Add a Site**.
2. Type: **Node.js**.
3. Set working directory: `/home/username/qistflow`.
4. Command: `npm run start` (or use PM2).

### 3. PM2 Process Management
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🔒 Security & Data Compliance
- Sensitive customer data (CNIC, phone numbers, addresses) are protected by JWT authentication and role-based access control.
- Passwords hashed with bcrypt (salt rounds: 10).
- WhatsApp session secrets are kept strictly server-side.
- Customer opt-outs (`STOP`/unsubscribe) are honored across all queues.

---

## 📄 License
Proprietary software developed for **QistFlow** / **QistBazar Recovery Operations**.
