const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

async function deploy() {
  console.log('=== Step 1: Bundling worker.bundle.js with esbuild ===');
  const bundleRes = spawnSync('npx', [
    'esbuild',
    'scripts/start-worker.ts',
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
  ], { shell: true, stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

  if (bundleRes.status !== 0) {
    throw new Error('Bundling failed!');
  }

  const bundlePath = path.resolve(__dirname, '..', 'dist', 'worker.bundle.js');
  const stats = fs.statSync(bundlePath);
  console.log(`Bundle built: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n=== Step 2: Connecting to AlwaysData via SSH ===');
  const conn = new Client();

  conn.on('ready', () => {
    console.log('SSH connected! Opening SFTP...');
    conn.sftp((err, sftp) => {
      if (err) throw err;

      const remoteDir = '/home/qistflow27/qistflow-worker';
      const remoteDist = remoteDir + '/dist';

      // 1. Upload worker.bundle.js
      console.log('Uploading worker.bundle.js...');
      sftp.fastPut(bundlePath, remoteDist + '/worker.bundle.js', (upErr) => {
        if (upErr) throw upErr;
        console.log('worker.bundle.js uploaded successfully!');

        // 2. Upload updated .env
        const envPath = path.resolve(__dirname, '..', '.env');
        console.log('Uploading .env...');
        sftp.fastPut(envPath, remoteDir + '/.env', (envErr) => {
          if (envErr) throw envErr;
          console.log('.env uploaded successfully!');

          // 3. Write start.sh with self-healing 24/7 daemon loop
          const startSh = `#!/bin/bash
cd /home/qistflow27/qistflow-worker
pkill -f "run_daemon.sh" 2>/dev/null || true
pkill -f "dist/worker.bundle.js" 2>/dev/null || true
sleep 1
export NODE_ENV=production
export IS_WORKER=true

cat << 'EOF' > run_daemon.sh
#!/bin/bash
while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting QistFlow Worker..." >> /home/qistflow27/qistflow-worker/worker.log
  node dist/worker.bundle.js >> /home/qistflow27/qistflow-worker/worker.log 2>&1
  EXIT_CODE=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Worker exited (code $EXIT_CODE). Auto-restarting in 3s..." >> /home/qistflow27/qistflow-worker/worker.log
  sleep 3
done
EOF
chmod +x run_daemon.sh
nohup ./run_daemon.sh > /dev/null 2>&1 &
echo "24/7 Auto-Restarting Worker Daemon started!"
`;

          const startShStream = sftp.createWriteStream(remoteDir + '/start.sh');
          startShStream.on('close', () => {
            console.log('start.sh written!');

            // 4. Launch remote worker daemon
            console.log('\n=== Step 3: Launching 24/7 Worker Daemon on AlwaysData ===');
            const remoteCmd = [
              'chmod +x /home/qistflow27/qistflow-worker/start.sh',
              '/home/qistflow27/qistflow-worker/start.sh',
              'sleep 3',
              'echo "=== PROCESS STATUS ==="',
              'ps -u qistflow27 -f | grep -E "run_daemon|worker.bundle.js"',
              'echo "=== WORKER LOG OUTPUT ==="',
              'tail -n 25 /home/qistflow27/qistflow-worker/worker.log'
            ].join(' && ');

            conn.exec(remoteCmd, (execErr, stream) => {
              if (execErr) throw execErr;
              stream.on('close', (code) => {
                console.log('\nDeployment finished with code:', code);
                conn.end();
              }).on('data', d => process.stdout.write(d)).stderr.on('data', d => process.stderr.write(d));
            });
          });
          startShStream.write(startSh);
          startShStream.end();
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

deploy().catch(console.error);
