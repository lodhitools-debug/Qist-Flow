# QistFlow Production Deployment Guide (Vercel + AlwaysData + Supabase)

This document provides step-by-step instructions for deploying and running QistFlow in production with **Google OAuth** and **dynamic Admin onboarding**.

---

## 1. Architecture Overview

- **Web Frontend & APIs**: Hosted on **Vercel** (Next.js 14 App Router, Serverless functions).
- **Persistent WhatsApp Worker**: Hosted on **AlwaysData** (Node.js daemon, Baileys socket, `./whatsapp_auth`, `/health` telemetry, background queue processor).
- **Production Database**: **Supabase PostgreSQL** (Relational storage, connection pooler, message queue, audit logs).

---

## 2. Supabase Database Setup & Clean Seed

1. Push schema tables and indexes to Supabase:
   ```bash
   npx prisma db push
   ```
2. Seed message templates and reminder rules (no hardcoded demo users):
   ```bash
   npx tsx prisma/seed.ts
   ```

---

## 3. Google OAuth 2.0 Configuration

To enable **"Sign in with Google"** for the Administrator and staff:

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Create a new Project (e.g. `QistFlow Recovery`).
3. Go to **APIs & Services → OAuth consent screen**:
   - User Type: **External** (or Internal for Google Workspace).
   - App Name: `QistFlow`.
   - Developer email: Your email.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application Type: **Web application**.
   - Name: `QistFlow Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for local development)
     - `https://your-domain.vercel.app` (for production)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/google/callback`
     - `https://your-domain.vercel.app/api/auth/google/callback`
5. Copy your **Client ID** and **Client Secret**.

---

## 4. AlwaysData WhatsApp Worker Deployment

1. **Deploy Repository**:
   Clone the repository to your AlwaysData user home directory (e.g. `/home/youruser/qistflow`).

2. **Install Dependencies**:
   ```bash
   npm install --production=false
   npx prisma generate
   ```

3. **Configure Environment Variables (`.env`) on AlwaysData**:
   ```ini
   DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].supabase.com:5432/postgres"
   IS_WORKER="true"
   WORKER_HTTP_PORT="8080"
   WHATSAPP_SERVICE_SECRET="your_shared_secret_token"
   ```

4. **Start Worker with PM2**:
   ```bash
   npm run worker
   # or with PM2 daemon:
   npx pm2 start ecosystem.config.js --only qistflow-worker
   npx pm2 save
   ```

5. **Verify Worker Health**:
   ```bash
   curl http://localhost:8080/health
   # Returns JSON: {"status":"ok","workerStatus":"running","whatsAppConnectionState":"DISCONNECTED"...}
   ```

---

## 5. Vercel Web Deployment

1. **Import GitHub Repository** on [vercel.com](https://vercel.com).
2. **Framework Preset**: Next.js.
3. **Environment Variables**:
   | Variable | Value Description |
   | :--- | :--- |
   | `DATABASE_URL` | Supabase connection pooler URL (`:6543`) |
   | `DIRECT_URL` | Supabase direct connection URL (`:5432`) |
   | `JWT_SECRET` | 64+ character random secret string |
   | `NEXTAUTH_SECRET` | 64+ character random secret string |
   | `NEXT_PUBLIC_APP_URL` | Your production URL (e.g. `https://your-domain.vercel.app`) |
   | `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
   | `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
   | `ADMIN_EMAIL` | *(Optional)* Your Google account email to auto-assign Admin |
   | `WHATSAPP_SERVICE_URL` | AlwaysData HTTP URL (e.g. `https://your-worker.alwaysdata.net`) |
   | `WHATSAPP_SERVICE_SECRET` | Same `WHATSAPP_SERVICE_SECRET` configured on AlwaysData |
4. Click **Deploy**.

---

## 6. First-Time Admin Login & WhatsApp QR Code Pairing

1. Open your live application in the browser (`https://your-domain.vercel.app` or `http://localhost:3000`).
2. Click **"Sign in with Google"** (or use the initial Admin setup form to create your master password).
   - Because no admin exists yet, the first Google sign-in automatically grants you **ADMIN** permissions.
3. Navigate to **WhatsApp → Connect Device** (`/whatsapp/connection`).
4. On your recovery mobile phone, open **WhatsApp → Settings → Linked Devices → Link a Device**.
5. Scan the QR code displayed on the screen.
6. The state will transition to **CONNECTED** within 3 seconds.

---

## 7. Verification Commands

Run locally or in CI:
```bash
# 1. Full 59-point automated test suite
npm test

# 2. TypeScript type check
npx tsc --noEmit

# 3. Next.js production build test
npm run build
```
