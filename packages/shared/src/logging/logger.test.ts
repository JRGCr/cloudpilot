import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Logger, createLogger } from './logger.js';
import { MemoryWriter } from './writers.js';

describe('Logger', () => {
  let writer: MemoryWriter;
  let logger: Logger;

  beforeEach(() => {
    writer = new MemoryWriter();
    logger = createLogger({
      source: 'test',
      writers: [writer],
      minLevel: 'debug',
    });
  });

  afterEach(() => {
    writer.clear();
  });

  describe('Standard level methods', () => {
    it('logs debug messages', () => {
      logger.debug('Debug message');
      expect(writer.entries).toHaveLength(1);
      expect(writer.entries[0].level).toBe('debug');
      expect(writer.entries[0].message).toBe('Debug message');
    });

    it('logs info messages', () => {
      logger.info('Info message');
      expect(writer.entries).toHaveLength(1);
      expect(writer.entries[0].level).toBe('info');
    });

    it('logs warn messages', () => {
      logger.warn('Warning message');
      expect(writer.entries).toHaveLength(1);
      expect(writer.entries[0].level).toBe('warn');
    });

    it('logs error messages', () => {
      logger.error('Error message');
      expect(writer.entries).toHaveLength(1);
      expect(writer.entries[0].level).toBe('error');
    });

    it('logs fatal messages', () => {
      logger.fatal('Fatal message');
      expect(writer.entries).toHaveLength(1);
      expect(writer.entries[0].level).toBe('fatal');
    });

    it('includes metadata in log entries', () => {
      logger.info('With metadata', { key: 'value', count: 42 });
      expect(writer.entries[0].metadata).toEqual({ key: 'value', count: 42 });
    });

    it('includes source in log entries', () => {
      logger.info('Test');
      expect(writer.entries[0].source).toBe('test');
    });

    it('generates unique IDs for each entry', () => {
      logger.info('First');
      logger.info('Second');
      expect(writer.entries[0].id).not.toBe(writer.entries[1].id);
    });

    it('includes ISO timestamps', () => {
      logger.info('Test');
      const timestamp = new Date(writer.entries[0].timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(writer.entries[0].timestamp);
    });
  });

  describe('Level filtering', () => {
    it('filters logs below minimum level', () => {
      const filteredLogger = createLogger({
        source: 'test',
        writers: [writer],
        minLevel: 'warn',
      });

      filteredLogger.debug('Should not appear');
      filteredLogger.info('Should not appear');
      filteredLogger.warn('Should appear');
      filteredLogger.error('Should appear');

      expect(writer.entries).toHaveLength(2);
      expect(writer.entries[0].level).toBe('warn');
      expect(writer.entries[1].level).toBe('error');
    });
  });

  describe('Function tracking', () => {
    it('logs function enter', () => {
      logger.functionEnter('myFunction', { arg1: 'value' });
      expect(writer.entries[0].message).toContain('Entering myFunction');
      expect(writer.entries[0].metadata?.function).toBe('myFunction');
      expect(writer.entries[0].metadata?.args).toEqual({ arg1: 'value' });
    });

    it('logs function exit', () => {
      logger.functionExit('myFunction', 'result', 100);
      expect(writer.entries[0].message).toContain('Exiting myFunction');
      // duration is extracted to the entry level, not in metadata
      expect(writer.entries[0].duration).toBe(100);
    });

    it('logs function error', () => {
      const error = new Error('Test error');
      logger.functionError('myFunction', error, 50);
      expect(writer.entries[0].level).toBe('error');
      expect(writer.entries[0].message).toContain('Error in myFunction');
    });
  });

  describe('HTTP tracking', () => {
    it('logs HTTP requests', () => {
      logger.httpRequest('GET', '/api/users', { headers: {} });
      expect(writer.entries[0].message).toBe('GET /api/users');
      expect(writer.entries[0].metadata?.http).toEqual({ method: 'GET', url: '/api/users' });
    });

    it('logs HTTP responses with appropriate level', () => {
      logger.httpResponse(200, 100);
      expect(writer.entries[0].level).toBe('info');

      writer.clear();
      logger.httpResponse(404, 100);
      expect(writer.entries[0].level).toBe('warn');

      writer.clear();
      logger.httpResponse(500, 100);
      expect(writer.entries[0].level).toBe('error');
    });

    it('includes duration in HTTP response', () => {
      logger.httpResponse(200, 150);
      expect(writer.entries[0].duration).toBe(150);
    });
  });

  describe('Specialized methods', () => {
    it('logs state changes', () => {
      logger.stateChange('auth', 'setUser', { user: null }, { user: { id: '1' } });
      expect(writer.entries[0].message).toContain('State change: auth.setUser');
      expect(writer.entries[0].metadata?.store).toBe('auth');
      expect(writer.entries[0].metadata?.action).toBe('setUser');
    });

    it('logs database queries', () => {
      logger.dbQuery('SELECT * FROM users', 0, 25, 5);
      // duration is extracted to entry level
      expect(writer.entries[0].duration).toBe(25);
      expect(writer.entries[0].metadata?.query).toBe('SELECT * FROM users');
      expect(writer.entries[0].metadata?.paramCount).toBe(0);
      expect(writer.entries[0].metadata?.rowsAffected).toBe(5);
    });

    it('logs auth events', () => {
      logger.authEvent('login_success', 'user123', { provider: 'github' });
      expect(writer.entries[0].message).toContain('Auth: login_success');
      expect(writer.entries[0].metadata?.authEvent).toBe('login_success');
      // userId is extracted to entry level
      expect(writer.entries[0].userId).toBe('user123');
      expect(writer.entries[0].metadata?.provider).toBe('github');
    });

    it('logs build events', () => {
      logger.buildStart('web', 'production');
      expect(writer.entries[0].metadata?.build).toEqual({
        type: 'web',
        environment: 'production',
        status: 'started',
      });

      writer.clear();
      logger.buildComplete(true, 5000);
      expect(writer.entries[0].duration).toBe(5000);
      expect(writer.entries[0].level).toBe('info');

      writer.clear();
      logger.buildComplete(false, 1000);
      expect(writer.entries[0].level).toBe('error');
    });

    it('logs git events', () => {
      logger.gitCommit('abc1234567890', 'feat: add feature', 3);
      expect(writer.entries[0].message).toContain('Git commit: abc1234');
      expect(writer.entries[0].metadata?.git).toEqual({
        hash: 'abc1234567890',
        message: 'feat: add feature',
        filesChanged: 3,
      });

      writer.clear();
      logger.gitPush('main', 'origin', 2);
      expect(writer.entries[0].metadata?.git).toEqual({
        branch: 'main',
        remote: 'origin',
        commits: 2,
      });

      writer.clear();
      const error = new Error('Push failed');
      logger.gitError('push', error);
      expect(writer.entries[0].level).toBe('error');
    });
  });

  describe('Context management', () => {
    it('creates child logger with additional metadata', () => {
      const child = logger.child({ requestId: 'req123' });
      child.info('Child log');
      expect(writer.entries[0].requestId).toBe('req123');
    });

    it('child logger inherits source and writers', () => {
      const child = logger.child({ extra: 'data' });
      child.info('Test');
      expect(writer.entries[0].source).toBe('test');
    });

    it('setContext adds context to subsequent logs', () => {
      logger.setContext({ sessionId: 'sess123' });
      logger.info('First');
      logger.info('Second');
      // Context should be in both entries
      expect(writer.entries[0].sessionId).toBe('sess123');
      expect(writer.entries[1].sessionId).toBe('sess123');
    });

    it('withCorrelationId creates child with correlation ID', () => {
      const correlated = logger.withCorrelationId('corr123');
      correlated.info('Correlated log');
      expect(writer.entries[0].correlationId).toBe('corr123');
    });
  });

  describe('timed helper', () => {
    it('measures and logs function duration', async () => {
      const result = await logger.timed('asyncOperation', async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'success';
      });

      expect(result).toBe('success');
      expect(writer.entries).toHaveLength(2); // enter + exit
      expect(writer.entries[0].message).toContain('Entering');
      expect(writer.entries[1].message).toContain('Exiting');
      // duration is extracted to entry level
      expect(writer.entries[1].duration).toBeGreaterThanOrEqual(50);
    });

    it('logs error on function failure', async () => {
      const error = new Error('Async error');

      await expect(
        logger.timed('failingOperation', async () => {
          throw error;
        }),
      ).rejects.toThrow('Async error');

      expect(writer.entries).toHaveLength(2); // enter + error
      expect(writer.entries[1].level).toBe('error');
    });
  });

  describe('Multiple writers', () => {
    it('writes to all configured writers', () => {
      const writer2 = new MemoryWriter();
      const multiLogger = createLogger({
        source: 'test',
        writers: [writer, writer2],
      });

      multiLogger.info('Multi-writer test');

      expect(writer.entries).toHaveLength(1);
      expect(writer2.entries).toHaveLength(1);
      expect(writer.entries[0].message).toBe('Multi-writer test');
      expect(writer2.entries[0].message).toBe('Multi-writer test');
    });
  });

  describe('Default metadata', () => {
    it('includes default metadata in all entries', () => {
      const loggerWithDefaults = createLogger({
        source: 'test',
        writers: [writer],
        defaultMetadata: { app: 'cloudpilot', version: '1.0.0' },
      });

      loggerWithDefaults.info('Test');
      expect(writer.entries[0].metadata?.app).toBe('cloudpilot');
      expect(writer.entries[0].metadata?.version).toBe('1.0.0');
    });

    it('merges default metadata with log-specific metadata', () => {
      const loggerWithDefaults = createLogger({
        source: 'test',
        writers: [writer],
        defaultMetadata: { app: 'cloudpilot' },
      });

      loggerWithDefaults.info('Test', { action: 'test' });
      expect(writer.entries[0].metadata?.app).toBe('cloudpilot');
      expect(writer.entries[0].metadata?.action).toBe('test');
    });
  });
});
