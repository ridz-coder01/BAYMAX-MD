const simpleGit = require('simple-git');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// ================= CONFIG =================
const REPO_URL = 'https://github.com/ridz-coder/BAYMAX-MD.git'; // Public repo URL
const LOCAL_DIR = path.join(__dirname, 'BAYMAX-MD'); // Local folder
const BRANCH = 'main'; // Branch to clone/pull
const AUTO_RESTART = true; // Restart app on updates
// =========================================

const git = simpleGit();

async function deploy() {
  // Clone or pull repo
  if (!fs.existsSync(LOCAL_DIR)) {
    console.log('Cloning repository...');
    await git.clone(REPO_URL, LOCAL_DIR, ['--branch', BRANCH, '--depth', '1']);
    console.log('Repository cloned.');
  } else {
    console.log('Repository exists. Pulling latest changes...');
    const gitLocal = simpleGit(LOCAL_DIR);
    await gitLocal.pull('origin', BRANCH);
    console.log('Repository updated.');
  }

  // Install dependencies if package.json exists
  const packageJsonPath = path.join(LOCAL_DIR, 'package.json');
  let startCommand = 'node index.js'; // default fallback

  if (fs.existsSync(packageJsonPath)) {
    console.log('Installing dependencies...');
    exec('npm install', { cwd: LOCAL_DIR }, (err, stdout, stderr) => {
      if (err) console.error('npm install error:', err);
      else console.log(stdout);
      console.log('Dependencies installed.');

      // Detect start command
      const pkg = require(packageJsonPath);
      if (pkg.scripts && pkg.scripts.start) {
        startCommand = 'npm start';
        console.log('Detected start script from package.json.');
      }

      runApp(startCommand);
    });
  } else {
    console.log('No package.json found, using default start command.');
    runApp(startCommand);
  }
}

// Function to run and optionally auto-restart the app
let appProcess = null;
function runApp(command) {
  if (appProcess) appProcess.kill();

  console.log(`Starting app: ${command}`);
  appProcess = exec(command, { cwd: LOCAL_DIR });

  appProcess.stdout.on('data', (data) => process.stdout.write(data));
  appProcess.stderr.on('data', (data) => process.stderr.write(data));
  appProcess.on('close', (code) => {
    console.log(`App exited with code ${code}`);
    if (AUTO_RESTART) {
      console.log('Restarting app...');
      runApp(command);
    }
  });
}

// Watch for repo changes to auto-update
fs.watch(LOCAL_DIR, { recursive: true }, async () => {
  console.log('Detected changes in repo, pulling updates...');
  const gitLocal = simpleGit(LOCAL_DIR);
  await gitLocal.pull('origin', BRANCH);
});

deploy();
