const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  'cd /home/qistflow27/qistflow-worker',
  'rm -rf node_modules package-lock.json',
  'echo "Installing dependencies one by one to save RAM..."',
  'npm install @prisma/client@latest --no-audit --no-fund --prefer-offline',
  'npm install @whiskeysockets/baileys@latest --no-audit --no-fund --prefer-offline',
  'npm install express --no-audit --no-fund --prefer-offline',
  'npm install bcryptjs --no-audit --no-fund --prefer-offline',
  'npm install qrcode-terminal --no-audit --no-fund --prefer-offline',
  'npx prisma generate',
  'npm install pm2 -g --no-audit --no-fund || npm install pm2 --no-audit --no-fund',
  './node_modules/.bin/pm2 start "npx tsx scripts/start-worker.ts" --name worker || pm2 start "npx tsx scripts/start-worker.ts" --name worker'
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
