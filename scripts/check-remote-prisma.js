const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const commands = [
    'cat /home/qistflow27/qistflow-worker/node_modules/@prisma/client/package.json | grep version',
    'ls -lh /home/qistflow27/qistflow-worker/node_modules/.prisma/client/'
  ].join(' && ');
  
  conn.exec(commands, (execErr, stream) => {
    if (execErr) { console.error(execErr); conn.end(); return; }
    stream.on('close', () => { conn.end(); })
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({ 
  host: 'ssh-qistflow27.alwaysdata.net', 
  port: 22, 
  username: 'qistflow27', 
  password: '@Lodhi9900' 
});
