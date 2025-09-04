const simpleGit = require('simple-git');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load deployer config
const config = require('./config');

// ================= CONFIG =================
const REPO_URL = 'https://github.com/ridz-coder/BAYMAX-MD.git'; // Public repo
const LOCAL_DIR = path.join(__dirname, 'BAYMAX-MD');   // Local folder
const BRANCH = 'main';                                   // Branch to clone
const AUTO_RESTART = true;                               // Restart on updates
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
    const install = spawn('npm', ['install'], { cwd: LOCAL_DIR, stdio: 'inherit' });

    install.on('close', () => {
      console.log('Dependencies installed.');
      const pkg = require(packageJsonPath);
      if (pkg.scripts && pkg.scripts.start) {
        startCommand = 'npm start';
        console.log('Detected start script from package.json.');
      }
      runBot(startCommand);
    });
  } else {
    console.log('No package.json found, using default start command.');
    runBot(startCommand);
  }
}

// Function to run the bot with deployer config
let botProcess = null;
function runBot(command) {
  if (botProcess) botProcess.kill();

  console.log(`Starting bot: ${command}`);

  // Inject deployer config as environment variables
  const env = {
    ...process.env,
    SESSION_ID: config.SESSION_ID,
    PREFIX: config.PREFIX,
  };

  botProcess = spawn(command.split(' ')[0], command.split(' ').slice(1), {
    cwd: LOCAL_DIR,
    stdio: 'inherit',
    env,
  });

  botProcess.on('close', (code) => {
    console.log(`Bot exited with code ${code}`);
    if (AUTO_RESTART) {
      console.log('Restarting bot...');
      runBot(command);
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