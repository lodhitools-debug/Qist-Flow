const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

async function main() {
  console.log('=== 1. Bundling worker with esbuild ===');
  const esbuildCmd = [
    'npx esbuild scripts/start-worker.ts',
    '--bundle',
    '--platform=node',
    '--target=node18',
    '--outfile=dist/worker.bundle.js',
    '--external:@prisma/client',
    '--external:link-preview-js',
    '--external:jimp',
    '--external:qrcode-terminal',
    '--external:sharp',
    '--external:pino-pretty',
    '--external:bcryptjs'
  ].join(' ');

  execSync(esbuildCmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

  console.log('\n=== 2. Preparing clean deployment directory ===');
  const rootDir = path.resolve(__dirname, '..');
  const tempDir = path.join(rootDir, 'dist', 'alwaysdata_pkg');
  
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // Copy dist/worker.bundle.js
  fs.mkdirSync(path.join(tempDir, 'dist'), { recursive: true });
  fs.copyFileSync(
    path.join(rootDir, 'dist', 'worker.bundle.js'),
    path.join(tempDir, 'dist', 'worker.bundle.js')
  );

  // Copy node_modules/@prisma/client and node_modules/.prisma
  fs.mkdirSync(path.join(tempDir, 'node_modules', '@prisma', 'client'), { recursive: true });
  fs.cpSync(
    path.join(rootDir, 'node_modules', '@prisma', 'client'),
    path.join(tempDir, 'node_modules', '@prisma', 'client'),
    { recursive: true }
  );

  fs.mkdirSync(path.join(tempDir, 'node_modules', '.prisma', 'client'), { recursive: true });
  
  // Copy only relevant files from .prisma/client
  const prismaClientSrc = path.join(rootDir, 'node_modules', '.prisma', 'client');
  for (const file of fs.readdirSync(prismaClientSrc)) {
    // Skip Windows DLLs to keep package light
    if (file.endsWith('.dll.node') || file.includes('windows')) continue;
    const srcPath = path.join(prismaClientSrc, file);
    const dstPath = path.join(tempDir, 'node_modules', '.prisma', 'client', file);
    if (fs.statSync(srcPath).isDirectory()) {
      fs.cpSync(srcPath, dstPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }

  // Copy .env
  fs.copyFileSync(path.join(rootDir, '.env'), path.join(tempDir, '.env'));

  // Copy package.json
  const workerPkg = {
    name: 'qistflow-worker',
    version: '1.0.0',
    description: 'QistFlow WhatsApp Worker for AlwaysData',
    main: 'dist/worker.bundle.js',
    scripts: {
      start: 'node dist/worker.bundle.js'
    },
    dependencies: {
      '@prisma/client': '^5.22.0'
    }
  };
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(workerPkg, null, 2),
    'utf8'
  );

  // Create start.sh, stop.sh, status.sh
  const startSh = `#!/bin/bash
cd /home/qistflow27/qistflow-worker
# Kill any existing node worker
pkill -f "dist/worker.bundle.js" || true
sleep 1
# Start worker in background
export NODE_ENV=production
nohup node dist/worker.bundle.js >> /home/qistflow27/qistflow-worker/worker.log 2>&1 &
echo "Worker started with PID $!"
`;
  fs.writeFileSync(path.join(tempDir, 'start.sh'), startSh, { encoding: 'utf8', mode: 0o755 });

  const stopSh = `#!/bin/bash
pkill -f "dist/worker.bundle.js" || true
echo "Worker stopped."
`;
  fs.writeFileSync(path.join(tempDir, 'stop.sh'), stopSh, { encoding: 'utf8', mode: 0o755 });

  console.log('\n=== 3. Creating deploy.tar.gz archive ===');
  const tarPath = path.join(rootDir, 'dist', 'deploy.tar.gz');
  // Use tar command
  execSync(`tar -czf "${tarPath}" -C "${tempDir}" .`, { stdio: 'inherit' });
  const stats = fs.statSync(tarPath);
  console.log(`Archive created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n=== 4. Uploading and Starting on AlwaysData via SSH ===');
  const conn = new Client();
  
  conn.on('ready', () => {
    console.log('SSH connected! Starting SFTP upload...');
    conn.sftp((err, sftp) => {
      if (err) throw err;
      sftp.fastPut(tarPath, '/home/qistflow27/deploy.tar.gz', (err) => {
        if (err) throw err;
        console.log('Upload complete! Extracting & restarting on AlwaysData...');

        const remoteCommands = [
          'pkill -9 -f "worker.bundle.js" || true',
          'mkdir -p /home/qistflow27/qistflow-worker',
          'rm -rf /home/qistflow27/qistflow-worker/dist',
          'tar -xzf /home/qistflow27/deploy.tar.gz -C /home/qistflow27/qistflow-worker --overwrite',
          'chmod +x /home/qistflow27/qistflow-worker/start.sh',
          'chmod +x /home/qistflow27/qistflow-worker/stop.sh',
          'rm -f /home/qistflow27/deploy.tar.gz',
          '/home/qistflow27/qistflow-worker/start.sh',
          'sleep 2',
          'ps aux | grep node',
          'echo "--- WORKER LOG ---"',
          'tail -n 25 /home/qistflow27/qistflow-worker/worker.log'
        ].join('; ');

        conn.exec(remoteCommands, (err, stream) => {
          if (err) throw err;
          stream.on('close', (code) => {
            console.log('\n=== Remote execution finished with code:', code);
            conn.end();
          }).on('data', (d) => process.stdout.write(d)).stderr.on('data', (d) => process.stderr.write(d));
        });
      });
    });
  }).connect({
    host: 'ssh-qistflow27.alwaysdata.net',
    port: 22,
    username: 'qistflow27',
    password: '@Lodhi9900'
  });
}

main().catch(console.error);
