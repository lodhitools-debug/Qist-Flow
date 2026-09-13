const { Client } = require('ssh2');
const conn = new Client();
const commands = [
  'ls -la /home/qistflow27/qistflow-worker/whatsapp_sessions 2>/dev/null',
  'ls -la /home/qistflow27/qistflow-worker/whatsapp_sessions/session-cmthjb57u000llwmxk7r9itqx 2>/dev/null'
].join(' && ');

conn.on('ready', () => {
  conn.exec(commands, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({ host: 'ssh-qistflow27.alwaysdata.net', port: 22, username: 'qistflow27', password: '@Lodhi9900' });
