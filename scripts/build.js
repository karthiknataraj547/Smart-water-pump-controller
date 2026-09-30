const fs = require('fs');
const cp = require('child_process');

console.log('[Build] Starting SmartPump production build...');
if (fs.existsSync('apps/web')) {
  console.log('[Build] Monorepo root context detected. Building apps/web...');
  cp.execSync('npm --prefix apps/web run build', { stdio: 'inherit' });
} else {
  console.log('[Build] Subdirectory context detected. Running next build...');
  cp.execSync('npx next build', { stdio: 'inherit' });
}
