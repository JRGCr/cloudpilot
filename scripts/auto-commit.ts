#!/usr/bin/env tsx
/**
 * Auto-commit script - watches for changes and commits automatically
 *
 * Usage:
 *   pnpm auto-commit                    Start watching with defaults
 *   pnpm auto-commit --interval 60      Batch changes over 60 seconds
 *   pnpm auto-commit --dry-run          Log without committing
 */

import { execSync } from 'node:child_process';
import { watch } from 'node:fs';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT_DIR = process.cwd();
const LOGS_DIR = join(ROOT_DIR, 'logs');

// Default patterns to exclude
const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'logs',
  'coverage',
  '.wrangler',
  'test-results',
  'playwright-report',
  '.pnpm-store',
];

interface Options {
  interval: number;
  excludes: string[];
  dryRun: boolean;
  verbose: boolean;
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(`[${timestamp}] ${message}`);
}

function logToFile(message: string) {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }

  const entry = {
    id: Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    level: 'info',
    source: 'git',
    message,
  };

  appendFileSync(join(LOGS_DIR, 'git.log'), `${JSON.stringify(entry)}\n`);
}

function isExcluded(filepath: string, excludes: string[]): boolean {
  const parts = filepath.split('/');
  return excludes.some((pattern) =>
    parts.some((part) => part === pattern || part.startsWith(pattern)),
  );
}

function getGitStatus(): string[] {
  try {
    const output = execSync('git status --porcelain', {
      encoding: 'utf-8',
      cwd: ROOT_DIR,
    });
    return output
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.slice(3).trim());
  } catch {
    return [];
  }
}

function generateCommitMessage(files: string[]): string {
  if (files.length === 0) {
    return '';
  }

  // Filter out lockfiles
  const relevantFiles = files.filter(
    (f) => !f.includes('pnpm-lock.yaml') && !f.includes('package-lock.json'),
  );

  if (relevantFiles.length === 0) {
    return ''; // Skip commit if only lockfiles changed
  }

  if (relevantFiles.length === 1) {
    return `chore(auto): update ${relevantFiles[0]}`;
  }

  if (relevantFiles.length <= 5) {
    const names = relevantFiles.map((f) => f.split('/').pop()).join(', ');
    return `chore(auto): update ${names}`;
  }

  // Group by directory
  const dirs = new Set<string>();
  for (const file of relevantFiles) {
    const parts = file.split('/');
    if (parts.length > 1) {
      dirs.add(parts.slice(0, 2).join('/'));
    } else {
      dirs.add('root');
    }
  }

  const dirList = Array.from(dirs).slice(0, 3).join(', ');
  return `chore(auto): update ${relevantFiles.length} files in ${dirList}`;
}

function commit(message: string, dryRun: boolean): boolean {
  if (dryRun) {
    log(`[DRY RUN] Would commit: ${message}`);
    return true;
  }

  try {
    // Stage all changes
    execSync('git add -A', { cwd: ROOT_DIR, stdio: 'pipe' });

    // Commit with message
    execSync(`git commit -m "${message}"`, { cwd: ROOT_DIR, stdio: 'pipe' });

    // Get commit hash
    const hash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      cwd: ROOT_DIR,
    }).trim();

    log(`Committed: ${hash} - ${message}`);
    logToFile(`Commit ${hash}: ${message}`);

    return true;
  } catch (err) {
    const error = err as { stderr?: string; message?: string };
    if (error.stderr?.includes('nothing to commit')) {
      log('Nothing to commit');
      return false;
    }
    log(`Commit failed: ${error.message || error.stderr}`);
    return false;
  }
}

async function autoCommit(options: Options): Promise<void> {
  log(`Starting auto-commit watcher (interval: ${options.interval}s)`);
  if (options.dryRun) {
    log('DRY RUN mode - no commits will be made');
  }

  const changedFiles = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function scheduleCommit() {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      const files = Array.from(changedFiles);
      changedFiles.clear();
      timer = null;

      if (files.length === 0) return;

      const message = generateCommitMessage(files);
      if (message) {
        commit(message, options.dryRun);
      }
    }, options.interval * 1000);
  }

  // Watch for changes
  const watcher = watch(ROOT_DIR, { recursive: true }, (event, filename) => {
    if (!filename) return;

    // Skip excluded paths
    if (isExcluded(filename, options.excludes)) return;

    // Skip hidden files
    if (filename.startsWith('.') || filename.includes('/.')) return;

    if (options.verbose) {
      log(`${event}: ${filename}`);
    }

    changedFiles.add(filename);
    scheduleCommit();
  });

  // Also check for existing uncommitted changes on startup
  const existingChanges = getGitStatus();
  for (const file of existingChanges) {
    if (!isExcluded(file, options.excludes)) {
      changedFiles.add(file);
    }
  }

  if (changedFiles.size > 0) {
    log(`Found ${changedFiles.size} existing change(s), scheduling commit...`);
    scheduleCommit();
  }

  // Handle shutdown
  process.on('SIGINT', () => {
    log('Stopping auto-commit watcher...');
    watcher.close();

    // Commit any pending changes
    if (changedFiles.size > 0) {
      const files = Array.from(changedFiles);
      const message = generateCommitMessage(files);
      if (message) {
        commit(message, options.dryRun);
      }
    }

    process.exit(0);
  });

  log('Watching for changes... (Ctrl+C to stop)');
}

// Parse arguments
const args = process.argv.slice(2);

function getArg(names: string[]): string | undefined {
  for (const name of names) {
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1]) {
      return args[idx + 1];
    }
  }
  return undefined;
}

function hasFlag(names: string[]): boolean {
  return names.some((name) => args.includes(name));
}

if (hasFlag(['--help', '-h'])) {
  log(`
Auto-Commit Tool

Watches for file changes and automatically creates commits.

Usage:
  pnpm auto-commit [options]

Options:
  --interval <seconds>    Batch window in seconds (default: 30)
  --exclude <pattern>     Additional pattern to exclude (can be repeated)
  --dry-run               Log without actually committing
  --verbose               Log all file change events
  --help, -h              Show this help

Default excludes:
  ${DEFAULT_EXCLUDES.join(', ')}

Commit message format:
  - Single file: "chore(auto): update path/to/file.ts"
  - 2-5 files: "chore(auto): update file1.ts, file2.ts, file3.ts"
  - 6+ files: "chore(auto): update N files in src/routes, src/services"

Examples:
  pnpm auto-commit
  pnpm auto-commit --interval 60
  pnpm auto-commit --dry-run --verbose
`);
} else {
  const excludes = [...DEFAULT_EXCLUDES];

  // Add custom excludes
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--exclude' && args[i + 1]) {
      excludes.push(args[i + 1]);
    }
  }

  autoCommit({
    interval: Number.parseInt(getArg(['--interval']) || '30', 10),
    excludes,
    dryRun: hasFlag(['--dry-run']),
    verbose: hasFlag(['--verbose']),
  });
}
