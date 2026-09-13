const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const bundlePath = path.join(__dirname, '..', 'dist', 'worker.bundle.js');
const bundleContent = fs.readFileSync(bundlePath);

console.log(`Bundle size: ${(bundleContent.length / 1024 / 1024).toFixed(1)} MB`);

conn.on('ready', () => {
  console.log('SSH Connected - Uploading bundle via SFTP...');
  
  conn.sftp((err, sftp) => {
    if (err) { console.error('SFTP error:', err); conn.end(); return; }
    
    // 1. Upload worker.bundle.js
    const remoteDist = '/home/qistflow27/qistflow-worker/dist';
    
    // Create dist dir
    sftp.mkdir(remoteDist, (mkErr) => {
      // Ignore error if dir exists
      
      const writeStream = sftp.createWriteStream(remoteDist + '/worker.bundle.js');
      writeStream.on('close', () => {
        console.log('Bundle uploaded!');
        
        // 2. Update ecosystem to use bundle instead of tsx
        const ecosystemContent = `module.exports = {
  apps: [
    {
      name: "qistflow-worker",
      script: "dist/worker.bundle.js",
      cwd: "/home/qistflow27/qistflow-worker",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        IS_WORKER: "true",
      },
    },
  ],
};
`;
        const ecoStream = sftp.createWriteStream('/home/qistflow27/qistflow-worker/ecosystem.config.js');
        ecoStream.on('close', () => {
          console.log('Ecosystem config updated!');
          
          // 3. Stop old worker, clear logs, start new
          const commands = [
            'cd /home/qistflow27/qistflow-worker',
            'npx pm2 delete qistflow-worker 2>/dev/null || true',
            '> /home/qistflow27/.pm2/logs/qistflow-worker-error.log',
            '> /home/qistflow27/.pm2/logs/qistflow-worker-out.log',
            'npx pm2 start ecosystem.config.js --only qistflow-worker',
            'npx pm2 save',
            'sleep 5',
            'echo "=== PM2 STATUS ==="',
            'npx pm2 list',
            'echo "=== WORKER LOGS ==="',
            'npx pm2 logs qistflow-worker --lines 15 --nostream 2>&1'
          ].join(' && ');
          
          conn.exec(commands, (execErr, stream) => {
            if (execErr) { console.error(execErr); conn.end(); return; }
            stream.on('close', () => { console.log('\nDone!'); conn.end(); })
              .on('data', d => process.stdout.write(d))
              .stderr.on('data', d => process.stderr.write(d));
          });
        });
        ecoStream.write(ecosystemContent);
        ecoStream.end();
      });
      
      writeStream.on('error', (wErr) => {
        console.error('Upload error:', wErr);
        conn.end();
      });
      
      writeStream.write(bundleContent);
      writeStream.end();
    });
  });
}).connect({ 
  host: 'ssh-qistflow27.alwaysdata.net', 
  port: 22, 
  username: 'qistflow27', 
  password: '@Lodhi9900' 
});
