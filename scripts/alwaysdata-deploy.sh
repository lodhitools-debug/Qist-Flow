#!/bin/bash
# ============================================================
# QistFlow AlwaysData Worker Update & Restart Script
# Run this in AlwaysData SSH terminal:
#   bash scripts/alwaysdata-deploy.sh
# ============================================================

set -e
echo "=========================================="
echo "🚀 QistFlow Worker Update & Restart"
echo "=========================================="

# 1. Pull latest code from GitHub
echo ""
echo "📥 Step 1: Pulling latest code from GitHub..."
git pull origin main
echo "✅ Code updated."

# 2. Install/update dependencies
echo ""
echo "📦 Step 2: Installing dependencies..."
npm install --production=false
echo "✅ Dependencies installed."

# 3. Regenerate Prisma client
echo ""
echo "🔧 Step 3: Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated."

# 4. Stop old worker if running (PM2)
echo ""
echo "🛑 Step 4: Stopping old worker..."
npx pm2 stop qistflow-worker 2>/dev/null || echo "   (No existing worker found - OK)"
npx pm2 delete qistflow-worker 2>/dev/null || true

# 5. Start new worker with PM2
echo ""
echo "▶️  Step 5: Starting new multi-user worker..."
npx pm2 start ecosystem.config.js --only qistflow-worker
npx pm2 save

# 6. Verify
echo ""
echo "🔍 Step 6: Verifying worker health..."
sleep 4
curl -s http://localhost:8080/health | python3 -m json.tool 2>/dev/null || \
  curl -s http://localhost:8080/health || \
  echo "⚠️  Health check failed - check: npx pm2 logs qistflow-worker"

echo ""
echo "=========================================="
echo "✅ Deploy complete!"
echo "   Check logs: npx pm2 logs qistflow-worker"
echo "=========================================="
