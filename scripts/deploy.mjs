/**
 * Publishes dist/ to the gh-pages branch.
 *
 * Interim solution: the Actions workflow in .github/ is the better path, but it
 * needs the `workflow` OAuth scope. Once `gh auth refresh -s workflow` has been
 * run and .github/ is committed, this script can go.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const REMOTE = 'https://github.com/AliMuhammadAslam/AliMuhammadAslam.github.io.git';
const dist = resolve('dist');

const run = (args, cwd) =>
  execFileSync('git', args, { cwd, stdio: 'inherit' });

if (!existsSync(dist)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

// Pages runs Jekyll by default, which strips the _-prefixed paths Vite emits.
writeFileSync(resolve(dist, '.nojekyll'), '');

// Start from a clean history each time; this branch is build output, not source.
rmSync(resolve(dist, '.git'), { recursive: true, force: true });

run(['init', '-b', 'gh-pages', '-q'], dist);
run(['add', '-A'], dist);
run(
  ['-c', 'user.name=AliMuhammadAslam', '-c', 'user.email=aaalimohdaslam@gmail.com',
   'commit', '-q', '-m', `Build ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`],
  dist
);
run(['push', '-f', REMOTE, 'gh-pages'], dist);

console.log('\nPublished → https://alimuhammadaslam.github.io/');
