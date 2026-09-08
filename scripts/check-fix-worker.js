const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  'cd /home/qistflow27/qistflow-worker',
  // Stop and delete old pm2 process
  'npx pm2 delete qistflow-worker 2>/dev/null || true',
  // Allow esbuild scripts (needed by tsx)
  'npm config set allow-scripts=esbuild --location=user',
  // Start fresh with tsx directly
  'npx pm2 start ecosystem.config.js --only qistflow-worker',
  'npx pm2 save',
  'sleep 8',
  'echo "=== Worker Logs ==="',
  'npx pm2 logs qistflow-worker --lines 30 --nostream 2>&1',
  'echo "=== PM2 Status ==="',
  'npx pm2 list'
].join(' && ');

conn.on('ready', () => {
  console.log('SSH Connected - Restarting worker with tsx...');
  conn.exec(commands, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('\nexit code:', code);
      conn.end();
    }).on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({
  host: 'ssh-qistflow27.alwaysdata.net',
  port: 22,
  username: 'qistflow27',
  password: '@Lodhi9900',
  readyTimeout: 20000
});
