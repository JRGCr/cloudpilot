/**
 * Debug endpoint to check database tables
 */

import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { env } = context;

  console.log('[Debug DB] Checking database tables...');

  try {
    // List all tables
    const tablesResult = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all();

    console.log('[Debug DB] Tables found:', tablesResult.results);

    // Check each expected table
    const expectedTables = ['users', 'sessions', 'accounts', 'verification'];
    const tableChecks: Record<string, { exists: boolean; rowCount?: number; error?: string }> = {};

    for (const tableName of expectedTables) {
      try {
        const countResult = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM ${tableName}`,
        ).first();
        tableChecks[tableName] = {
          exists: true,
          rowCount: countResult?.count || 0,
        };
      } catch (error) {
        tableChecks[tableName] = {
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          data: {
            allTables: tablesResult.results,
            tableChecks,
            totalTables: tablesResult.results.length,
          },
        },
        null,
        2,
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[Debug DB] Error:', error);
    return new Response(
      JSON.stringify(
        {
          error: 'Database check failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        null,
        2,
      ),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
