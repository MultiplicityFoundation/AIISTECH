'use strict';

const { REPO_ROOT } = require('./fileSystem');

const MAX_SESSIONS = 2;
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const sessions     = new Map();       // id → { pty, idleTimer }

let nextId = 1;

// Security note: `bash --restricted` (rbash) prevents `cd` outside cwd, PATH reassignment,
// and I/O redirection. However rbash has known bypass vectors (e.g. BASH_ENV, SHELLOPTS,
// command-completion hooks). Defense-in-depth measures applied here:
//   1. Minimal PATH (/usr/local/bin:/usr/bin:/bin only)
//   2. BASH_ENV and ENV unset to block profile/rc sourcing
//   3. SHELLOPTS unset to prevent inheriting set options
//   4. cwd locked to REPO_ROOT
//   5. No parent-environment secrets (STUDIO_PASSWORD, SYNC_SECRET, etc.) passed to PTY

function _resetIdle(id) {
  const session = sessions.get(id);
  if (!session) return;
  clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(() => kill(id), IDLE_TIMEOUT);
}

function create() {
  if (sessions.size >= MAX_SESSIONS) {
    const err = new Error('Maximum concurrent terminal sessions reached');
    err.status = 429;
    throw err;
  }

  // node-pty is an optional native dependency; require lazily so tests can stub it
  const pty = require('node-pty');
  const id  = String(nextId++);

  const safeEnv = {
    HOME:                process.env.HOME || '/tmp',
    TERM:                'xterm-256color',
    PATH:                '/usr/local/bin:/usr/bin:/bin',
    LANG:                process.env.LANG || 'en_US.UTF-8',
    MULTIPLIC_REPO_PATH: REPO_ROOT,
    // Explicitly block known rbash bypass vectors
    BASH_ENV:            '',
    ENV:                 '',
    SHELLOPTS:           '',
  };

  const ptyProcess = pty.spawn('bash', ['--restricted', '--noprofile', '--norc'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd:  REPO_ROOT,
    env:  safeEnv,
  });

  const idleTimer = setTimeout(() => kill(id), IDLE_TIMEOUT);
  sessions.set(id, { pty: ptyProcess, idleTimer });

  return { id, pty: ptyProcess };
}

function get(id) {
  return sessions.get(id) || null;
}

function resize(id, cols, rows) {
  const session = sessions.get(id);
  if (!session) return;
  session.pty.resize(cols, rows);
  _resetIdle(id);
}

function kill(id) {
  const session = sessions.get(id);
  if (!session) return;
  clearTimeout(session.idleTimer);
  try { session.pty.kill(); } catch { /* already dead */ }
  sessions.delete(id);
}

function listIds() {
  return Array.from(sessions.keys());
}

module.exports = { create, get, resize, kill, listIds, MAX_SESSIONS };
