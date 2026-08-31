const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  'cd /home/qistflow27/qistflow-worker',
  'echo "NPM install with low memory settings..."',
  'npm cache clean --force',
  'NODE_OPTIONS="--max-old-space-size=80" npm install --omit=dev --no-audit --no-fund --prefer-offline',
  'npx prisma generate',
  'pm2 restart worker || pm2 start "npx tsx scripts/start-worker.ts" --name worker',
  'pm2 save',
  'pm2 status'
].join(' && ');

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(commands, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code);
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
