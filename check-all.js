const { execSync } = require('child_process');

const commands = [
  { cwd: 'backend', cmd: 'npm run lint' },
  { cwd: 'backend', cmd: 'npm run typecheck' },
  { cwd: 'backend', cmd: 'npm run build' },
  { cwd: 'frontend', cmd: 'npm run lint' },
  { cwd: 'frontend', cmd: 'npm run doctor' },
  { cwd: 'frontend', cmd: 'npm run astro:doctor' },
  { cwd: 'frontend', cmd: 'npx astro check' },
  { cwd: 'frontend', cmd: 'npm run typecheck' },
  { cwd: 'frontend', cmd: 'npm run build' },
];

let failed = false;

for (const { cwd, cmd } of commands) {
  console.log(`\n================================`);
  console.log(`Running: [${cwd}] ${cmd}`);
  console.log(`================================`);
  try {
    const output = execSync(cmd, { cwd, encoding: 'utf8', stdio: 'inherit' });
    // stdio: 'inherit' prints directly to console
  } catch (error) {
    console.error(`\n[!] Command FAILED: ${cmd} in ${cwd}`);
    failed = true;
    break; // stop on first failure so we can fix it
  }
}

if (!failed) {
  console.log(`\n✅ ALL CHECKS PASSED SUCCESSFULLY!`);
}
