const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
const localBundle = 'd:\\QistFlow\\dist\\worker.bundle.js';
const remotePath = '/home/qistflow27/qistflow-worker/dist/worker.bundle.js';

conn.on('ready', () => {
  console.log('SSH Connected - Uploading bundle...');
  conn.sftp((err, sftp) => {
    if (err) throw err;

    const localSize = fs.statSync(localBundle).size;
    console.log(`Uploading ${(localSize / 1024 / 1024).toFixed(1)}MB bundle...`);

    const ws = sftp.createWriteStream(remotePath, { flags: 'w' });
    const rs = fs.createReadStream(localBundle);

    ws.on('close', () => {
      console.log('Upload complete! Verifying...');
      // AlwaysData auto-restarts when the file changes
      conn.exec(
        'ls -lh /home/qistflow27/qistflow-worker/dist/worker.bundle.js && sleep 5 && curl -s http://localhost:8100/health 2>/dev/null || echo "waiting for restart..."',
        (e, stream) => {
          if (e) throw e;
          stream.on('close', () => conn.end())
            .on('data', d => process.stdout.write(d))
            .stderr.on('data', d => process.stderr.write(d));
        }
      );
    });

    ws.on('error', err => {
      console.error('Upload error:', err);
      conn.end();
    });

    rs.pipe(ws);
    
    let uploaded = 0;
    rs.on('data', chunk => {
      uploaded += chunk.length;
      process.stdout.write(`\rUploaded: ${(uploaded / 1024 / 1024).toFixed(1)}MB / ${(localSize / 1024 / 1024).toFixed(1)}MB`);
    });
  });
}).connect({ host: 'ssh-qistflow27.alwaysdata.net', port: 22, username: 'qistflow27', password: '@Lodhi9900' });
