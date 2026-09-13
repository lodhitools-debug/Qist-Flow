const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  'echo "=== Connected to AlwaysData ==="',
  // Step 1: Go to worker folder or pull latest code
  'if [ -d "/home/qistflow27/qistflow-worker/.git" ]; then cd /home/qistflow27/qistflow-worker && git fetch origin && git reset --hard origin/main && echo "Git pull complete"; else cd /home/qistflow27 && rm -rf qistflow-worker && git clone https://github.com/lodhitools-debug/Qist-Flow.git qistflow-worker && echo "Git clone complete"; fi',
  // Step 2: Install deps
  'cd /home/qistflow27/qistflow-worker && npm install --production=false 2>&1 | tail -3',
  // Step 3: Generate prisma
  'cd /home/qistflow27/qistflow-worker && npx --yes prisma generate 2>&1 | tail -2',
  // Step 4: Restart or start pm2 using npx
  'cd /home/qistflow27/qistflow-worker && (npx pm2 restart qistflow-worker 2>/dev/null && echo "Worker restarted") || (npx pm2 start ecosystem.config.js --only qistflow-worker && npx pm2 save && echo "Worker started fresh")',
  'echo "=== Deployment Complete! Worker is running ==="'
].join(' && ');

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(commands, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: 'ssh-qistflow27.alwaysdata.net',
  port: 22,
  username: 'qistflow27',
  password: '@Lodhi9900'
});
