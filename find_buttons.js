const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const buttonsWithoutActions = [];

walkDir('d:/QistFlow/src/app/(dashboard)', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('<button') && !line.includes('onClick') && !line.includes('type="submit"') && !line.includes('type=\'submit\'')) {
        // Look ahead for next 3 lines just in case it spans multiple lines
        const block = lines.slice(i, i+4).join(' ');
        if (!block.includes('onClick') && !block.includes('type="submit"')) {
            buttonsWithoutActions.push(`${filePath}:${i+1} => ${line.trim()}`);
        }
      }
    }
  }
});

console.log(buttonsWithoutActions.join('\n'));
