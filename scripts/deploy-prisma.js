const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH Connected - Generating prisma client...');
  
  const commands = [
    'cd /home/qistflow27/qistflow-worker',
    'npx --yes prisma@5.22.0 generate 2>&1',
    'npx pm2 restart qistflow-worker',
    'sleep 5',
    'npx pm2 logs qistflow-worker --lines 20 --nostream 2>&1'
  ].join(' && ');
  
  conn.exec(commands, (execErr, stream) => {
    if (execErr) { console.error(execErr); conn.end(); return; }
    stream.on('close', () => { console.log('\nDone!'); conn.end(); })
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({ 
  host: 'ssh-qistflow27.alwaysdata.net', 
  port: 22, 
  username: 'qistflow27', 
  password: '@Lodhi9900' 
});
