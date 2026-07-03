const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const version = {
  hash: getGitHash(),
  builtAt: new Date().toISOString(),
};

const outPath = path.join(__dirname, '..', 'public', 'version.json');
fs.writeFileSync(outPath, JSON.stringify(version, null, 2));
console.log('Generated version.json:', version);
