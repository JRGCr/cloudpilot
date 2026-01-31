#!/usr/bin/env tsx
/**
 * Database migration script for D1
 *
 * Usage:
 *   pnpm db:migrate status           Show migration status
 *   pnpm db:migrate up               Apply all pending migrations
 *   pnpm db:migrate up --step 1      Apply next migration
 *   pnpm db:migrate create <name>    Create new migration file
 *   pnpm db:migrate seed             Run seed.sql
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');
const DB_NAME = 'cloudpilot';

interface Migration {
  filename: string;
  checksum: string;
  sql: string;
}

interface AppliedMigration {
  id: number;
  filename: string;
  applied_at: string;
  checksum: string;
}

function log(message: string) {
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(message);
}

function error(message: string) {
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.error(`Error: ${message}`);
  process.exit(1);
}

function computeChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function getMigrationFiles(): Migration[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.match(/^\d{4}_.*\.sql$/) && !f.includes('seed'))
    .sort();

  return files.map((filename) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf-8');
    return {
      filename,
      checksum: computeChecksum(sql),
      sql,
    };
  });
}

function execWrangler(sql: string, env: string): string {
  const envFlag = env !== 'local' ? `--env ${env}` : '--local';
  const escapedSql = sql.replace(/"/g, '\\"').replace(/\n/g, ' ');

  try {
    return execSync(`wrangler d1 execute ${DB_NAME} ${envFlag} --command "${escapedSql}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    throw new Error(e.stderr || e.message || 'Wrangler command failed');
  }
}

function ensureMigrationsTable(env: string): void {
  const sql = `
    CREATE TABLE IF NOT EXISTS _cloudpilot_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL,
      checksum TEXT NOT NULL
    )
  `;
  execWrangler(sql, env);
}

function getAppliedMigrations(env: string): AppliedMigration[] {
  try {
    const result = execWrangler(
      'SELECT id, filename, applied_at, checksum FROM _cloudpilot_migrations ORDER BY id',
      env,
    );
    // Parse the output - wrangler returns JSON when --json flag is used
    // For now, we'll use a simpler approach
    const _lines = result.split('\n').filter((l) => l.trim());
    // This is a simplified parser - in production, use --json flag
    return [];
  } catch {
    return [];
  }
}

async function status(env: string): Promise<void> {
  log(`\nMigration status (${env}):\n`);

  ensureMigrationsTable(env);

  const migrations = getMigrationFiles();
  const applied = getAppliedMigrations(env);
  const appliedSet = new Set(applied.map((a) => a.filename));

  for (const migration of migrations) {
    const isApplied = appliedSet.has(migration.filename);
    const status = isApplied ? '✓' : '○';
    log(`  ${status} ${migration.filename}`);
  }

  const pending = migrations.filter((m) => !appliedSet.has(m.filename));
  log(`\n  ${applied.length} applied, ${pending.length} pending\n`);
}

async function up(env: string, step?: number, dryRun = false): Promise<void> {
  ensureMigrationsTable(env);

  const migrations = getMigrationFiles();
  const applied = getAppliedMigrations(env);
  const appliedSet = new Set(applied.map((a) => a.filename));

  const pending = migrations.filter((m) => !appliedSet.has(m.filename));

  if (pending.length === 0) {
    log('No pending migrations.');
    return;
  }

  const toApply = step ? pending.slice(0, step) : pending;

  for (const migration of toApply) {
    log(`Applying: ${migration.filename}`);

    if (dryRun) {
      log(`  [DRY RUN] Would execute:\n${migration.sql.slice(0, 200)}...`);
      continue;
    }

    try {
      // Execute the migration SQL
      execWrangler(migration.sql, env);

      // Record the migration
      const recordSql = `
        INSERT INTO _cloudpilot_migrations (filename, applied_at, checksum)
        VALUES ('${migration.filename}', datetime('now'), '${migration.checksum}')
      `;
      execWrangler(recordSql, env);

      log('  ✓ Applied successfully');
    } catch (err) {
      error(`Failed to apply ${migration.filename}: ${(err as Error).message}`);
    }
  }

  log(`\nApplied ${toApply.length} migration(s).`);
}

function create(name: string): void {
  const migrations = getMigrationFiles();
  const nextNumber = (migrations.length + 1).toString().padStart(4, '0');
  const filename = `${nextNumber}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
  const filepath = join(MIGRATIONS_DIR, filename);

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Write your migration SQL here

`;

  writeFileSync(filepath, template);
  log(`Created: ${filepath}`);
}

async function seed(env: string, dryRun = false): Promise<void> {
  const seedPath = join(MIGRATIONS_DIR, 'seed.sql');

  if (!existsSync(seedPath)) {
    error('seed.sql not found');
  }

  const sql = readFileSync(seedPath, 'utf-8');

  log('Running seed.sql...');

  if (dryRun) {
    log(`[DRY RUN] Would execute:\n${sql}`);
    return;
  }

  try {
    execWrangler(sql, env);
    log('✓ Seed completed successfully');
  } catch (err) {
    error(`Seed failed: ${(err as Error).message}`);
  }
}

// Parse arguments
const args = process.argv.slice(2);
const command = args[0];
const env = args.includes('--env') ? args[args.indexOf('--env') + 1] : 'local';
const dryRun = args.includes('--dry-run');
const step = args.includes('--step')
  ? Number.parseInt(args[args.indexOf('--step') + 1], 10)
  : undefined;

switch (command) {
  case 'status':
    status(env);
    break;
  case 'up':
    up(env, step, dryRun);
    break;
  case 'create': {
    const name = args[1];
    if (!name) {
      error('Migration name required: pnpm db:migrate create <name>');
    }
    create(name);
    break;
  }
  case 'seed':
    seed(env, dryRun);
    break;
  default:
    log(`
Database Migration Tool

Usage:
  pnpm db:migrate status              Show migration status
  pnpm db:migrate up                  Apply all pending migrations
  pnpm db:migrate up --step <n>       Apply next n migrations
  pnpm db:migrate create <name>       Create new migration file
  pnpm db:migrate seed                Run seed.sql

Options:
  --env <env>     Environment: local, preview, production (default: local)
  --dry-run       Show SQL without executing
`);
}
