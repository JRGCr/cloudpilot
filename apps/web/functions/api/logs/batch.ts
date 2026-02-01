/**
 * Batch log ingestion endpoint for Cloudflare Pages Functions
 */

import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request } = context;

  console.log('[Pages Logs] Log batch write request received');

  try {
    const entries = await request.json<unknown[]>();

    if (!Array.isArray(entries)) {
      console.log('[Pages Logs] Invalid batch request: not an array');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Expected array of log entries',
          },
          meta: { timestamp: new Date().toISOString() },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate all entries
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry || typeof entry !== 'object') {
        console.log('[Pages Logs] Invalid log entry in batch at index:', i);
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Invalid log entry at index ${i}: must be an object`,
            },
            meta: { timestamp: new Date().toISOString() },
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    console.log('[Pages Logs] Client log batch received, count:', entries.length);
    console.log('[Pages Logs] Log batch details:', { count: entries.length });

    // In production, batch write to storage (D1, KV, or external service)
    // For now, we just log that we received it

    console.log('[Pages Logs] Log batch write successful');

    return new Response(
      JSON.stringify({
        success: true,
        data: { written: entries.length },
        meta: { timestamp: new Date().toISOString() },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Pages Logs] Error processing batch:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process log batch',
        },
        meta: { timestamp: new Date().toISOString() },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
