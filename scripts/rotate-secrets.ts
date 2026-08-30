import crypto from "crypto";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env");

const jwt = crypto.randomBytes(32).toString("hex");
const nextauth = crypto.randomBytes(32).toString("hex");
const wa = crypto.randomBytes(32).toString("hex");
const cron = crypto.randomBytes(24).toString("hex");
const adminPass = crypto.randomBytes(18).toString("base64url") + "!#9A";

const envContent = `# ==============================================================================
# QistFlow Production Environment Configuration (.env)
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Database Connection (Supabase PostgreSQL)
# ------------------------------------------------------------------------------
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# ------------------------------------------------------------------------------
# 2. Rotated Authentication & Cryptographic Secrets
# ------------------------------------------------------------------------------
JWT_SECRET="${jwt}"
NEXTAUTH_SECRET="${nextauth}"
CRON_SECRET="${cron}"

# ------------------------------------------------------------------------------
# 3. Application URLs & Hosting
# ------------------------------------------------------------------------------
NEXTAUTH_URL="https://qist-flow.vercel.app"
NEXT_PUBLIC_APP_URL="https://qist-flow.vercel.app"
NODE_ENV="production"
PORT=3000

# ------------------------------------------------------------------------------
# 4. AlwaysData Persistent WhatsApp Worker Bridge
# ------------------------------------------------------------------------------
WHATSAPP_SERVICE_URL="https://qistflow-worker.alwaysdata.net"
WHATSAPP_SERVICE_SECRET="${wa}"
WHATSAPP_SESSION_PATH="./whatsapp_auth"

# ------------------------------------------------------------------------------
# 5. WhatsApp Safety & Anti-Ban Rate Limiting
# ------------------------------------------------------------------------------
WHATSAPP_RATE_LIMIT_MIN_DELAY_MS=6000
WHATSAPP_RATE_LIMIT_MAX_DELAY_MS=14000
WHATSAPP_DAILY_MAX_MESSAGES=250

# ------------------------------------------------------------------------------
# 6. Initial Production Administrator Bootstrap
# ------------------------------------------------------------------------------
INITIAL_ADMIN_EMAIL="admin@qistflow.com"
INITIAL_ADMIN_PASSWORD="${adminPass}"
INITIAL_ADMIN_NAME="System Administrator"
`;

fs.writeFileSync(envPath, envContent, "utf-8");
console.log("✅ Successfully rotated all production secrets in .env without printing them to logs.");
