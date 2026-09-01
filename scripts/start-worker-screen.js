const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'pkill -f worker.bundle.js || true',
    'sleep 1',
    'cd /home/qistflow27/qistflow-worker',
    'screen -dmS qistworker node dist/worker.bundle.js',
    'sleep 4',
    'screen -ls',
    'echo ---LOG---',
    'tail -n 15 /home/qistflow27/qistflow-worker/worker.log'
  ].join(' && ');
  conn.exec(cmd, (err, stream) => {
    stream.on('close', () => conn.end())
    .on('data', (d) => process.stdout.write(d))
    .stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({ host: 'ssh-qistflow27.alwaysdata.net', port: 22, username: 'qistflow27', password: '@Lodhi9900' });
