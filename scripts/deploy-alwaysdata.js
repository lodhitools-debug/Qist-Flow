const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  'echo "Connected to AlwaysData!"',
  'cd /home/qistflow27/ && (ls qistflow-worker 2>/dev/null || echo "not found")',
  'if [ -d "/home/qistflow27/qistflow-worker/.git" ]; then cd /home/qistflow27/qistflow-worker && git fetch origin && git reset --hard origin/main; else cd /home/qistflow27 && git clone https://github.com/lodhitools-debug/Qist-Flow.git qistflow-worker; fi',
  'cd /home/qistflow27/qistflow-worker && npm install --production',
  'pm2 restart all || echo "pm2 not found or nothing to restart"',
  'echo "Deployment Complete!"'
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
