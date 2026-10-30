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

          // 3. Restart AlwaysData worker process cleanly (killing any duplicate processes)
          console.log('\n=== Step 3: Restarting AlwaysData site upstream cleanly ===');
          const remoteCmd = [
            'pkill -9 -f run_daemon 2>/dev/null || true',
            'rm -f /home/qistflow27/qistflow-worker/run_daemon.sh',
            'sleep 1',
            'echo "=== PROCESS STATUS ==="',
            'ps -u qistflow27 -f | grep node || true',
            'echo "Triggering AlwaysData site reload via curl..."',
            'curl -s https://qistflow27.alwaysdata.net/api/health || true',
            'echo "\n=== HEALTH CHECK COMPLETED ==="'
          ].join(' && ');

          conn.exec(remoteCmd, (execErr, stream) => {
            if (execErr) throw execErr;
            stream.on('close', (code) => {
              console.log('\nDeployment finished with code:', code);
              conn.end();
            }).on('data', d => process.stdout.write(d)).stderr.on('data', d => process.stderr.write(d));
          });
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
