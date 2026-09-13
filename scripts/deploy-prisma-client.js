const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

// Only upload the schema-specific files (not the large .so.node binaries already on server)
const localPrismaClient = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');
const localAtPrismaClient = path.join(__dirname, '..', 'node_modules', '@prisma', 'client');

const filesToUpload = [
  // Updated generated client files with correct schema
  { local: path.join(localPrismaClient, 'index.js'),      remote: '/home/qistflow27/qistflow-worker/node_modules/.prisma/client/index.js' },
  { local: path.join(localPrismaClient, 'index.d.ts'),    remote: '/home/qistflow27/qistflow-worker/node_modules/.prisma/client/index.d.ts' },
  { local: path.join(localPrismaClient, 'schema.prisma'), remote: '/home/qistflow27/qistflow-worker/node_modules/.prisma/client/schema.prisma' },
  { local: path.join(localPrismaClient, 'edge.js'),       remote: '/home/qistflow27/qistflow-worker/node_modules/.prisma/client/edge.js' },
  // Also update @prisma/client
  { local: path.join(localAtPrismaClient, 'index.js'),    remote: '/home/qistflow27/qistflow-worker/node_modules/@prisma/client/index.js' },
  { local: path.join(localAtPrismaClient, 'index.d.ts'),  remote: '/home/qistflow27/qistflow-worker/node_modules/@prisma/client/index.d.ts' },
];

function uploadFile(sftp, { local, remote }, cb) {
  const content = fs.readFileSync(local);
  const ws = sftp.createWriteStream(remote);
  ws.on('close', () => { console.log(`  ✅ ${path.basename(local)} uploaded`); cb(); });
  ws.on('error', (err) => { console.error(`  ❌ Error uploading ${local}:`, err); cb(err); });
  ws.write(content);
  ws.end();
}

conn.on('ready', () => {
  console.log('SSH Connected - Uploading fresh Prisma client files...');
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    
    let i = 0;
    function next() {
      if (i >= filesToUpload.length) {
        console.log('\nAll files uploaded! Restarting worker...');
        const cmds = [
          'cd /home/qistflow27/qistflow-worker',
          '> /home/qistflow27/.pm2/logs/qistflow-worker-error.log',
          '> /home/qistflow27/.pm2/logs/qistflow-worker-out.log',
          'npx pm2 restart qistflow-worker',
          'sleep 8',
          'echo "=== PM2 Status ==="',
          'npx pm2 list',
          'echo "=== Worker Out Log ==="',
          'tail -20 /home/qistflow27/.pm2/logs/qistflow-worker-out.log',
          'echo "=== Worker Error Log ==="',
          'tail -10 /home/qistflow27/.pm2/logs/qistflow-worker-error.log',
          'echo "=== Health ==="',
          'curl -s http://localhost:8080/health 2>&1 || echo "not responding"'
        ].join(' && ');
        conn.exec(cmds, (e, stream) => {
          if (e) { console.error(e); conn.end(); return; }
          stream.on('close', () => { console.log('Done!'); conn.end(); })
            .on('data', d => process.stdout.write(d))
            .stderr.on('data', d => process.stderr.write(d));
        });
        return;
      }
      uploadFile(sftp, filesToUpload[i++], (err) => { if (!err) next(); });
    }
    next();
  });
}).connect({ host: 'ssh-qistflow27.alwaysdata.net', port: 22, username: 'qistflow27', password: '@Lodhi9900' });
