const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  'echo "=== Database check for session status ==="',
  // Use psql to check the connection status in the database
  'psql -d postgresql://postgres.tycxpujzrcxiwbmicvpz:%40uMARHAYATLODHI.908@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true -c "SELECT \\"userId\\", status, \\"updatedAt\\" FROM \\"WhatsAppSession\\";" 2>/dev/null || echo "psql failed"',
  'echo "=== AlwaysData Node.js Site Logs ==="',
  'find /home/qistflow27/admin/logs -type f -name "*.log" -mmin -30 2>/dev/null | xargs tail -n 20 2>/dev/null || echo "no logs found"',
  'echo "=== Check worker process ==="',
  'ps aux | grep node | grep -v grep'
].join(' && ');

conn.on('ready', () => {
  conn.exec(commands, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({ host: 'ssh-qistflow27.alwaysdata.net', port: 22, username: 'qistflow27', password: '@Lodhi9900' });
