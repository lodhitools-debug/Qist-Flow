const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH Client ready, initiating SFTP...');
  conn.sftp((err, sftp) => {
    if (err) throw err;
    console.log('SFTP started, uploading deploy.tar.gz...');
    sftp.fastPut('deploy.tar.gz', '/home/qistflow27/deploy.tar.gz', (err) => {
      if (err) throw err;
      console.log('Upload complete! Extracting...');
      
      const commands = [
        'rm -rf /home/qistflow27/qistflow-worker',
        'mkdir -p /home/qistflow27/qistflow-worker',
        'tar -xzf /home/qistflow27/deploy.tar.gz -C /home/qistflow27/qistflow-worker',
        'cd /home/qistflow27/qistflow-worker',
        'npm install pm2 -g --no-audit --no-fund || npm install pm2 --no-audit --no-fund',
        './node_modules/.bin/pm2 restart worker || ./node_modules/.bin/pm2 start "npx tsx scripts/start-worker.ts" --name worker || pm2 start "npx tsx scripts/start-worker.ts" --name worker',
        'rm /home/qistflow27/deploy.tar.gz',
        'echo "AlwaysData setup complete!"'
      ].join(' && ');

      conn.exec(commands, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
          console.log('Extraction and restart complete with code:', code);
          conn.end();
        }).on('data', (data) => {
          process.stdout.write(data);
        }).stderr.on('data', (data) => {
          process.stderr.write(data);
        });
      });
    });
  });
}).connect({
  host: 'ssh-qistflow27.alwaysdata.net',
  port: 22,
  username: 'qistflow27',
  password: '@Lodhi9900'
});
