/**
 * Performance logging utilities
 */

import { FileWriter, createLogger } from '@cloudpilot/shared';
import path from 'node:path';

// Create dedicated performance logger
function createPerformanceLogger(correlationId?: string, requestId?: string) {
  return createLogger({
    source: 'server',
    writers: [
      new FileWriter({ filePath: path.join(process.cwd(), 'logs', 'performance.log') }),
    ],
    defaultMetadata: { correlationId, requestId },
  });
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage?: NodeJS.MemoryUsage;
  metadata?: Record<string, unknown>;
}

export class PerformanceTracker {
  private startTime: number;
  private startMemory: NodeJS.MemoryUsage;
  private logger: ReturnType<typeof createPerformanceLogger>;
  private operation: string;

  constructor(operation: string, correlationId?: string, requestId?: string) {
    this.operation = operation;
    this.startTime = Date.now();
    this.startMemory = process.memoryUsage();
    this.logger = createPerformanceLogger(correlationId, requestId);

    // Log operation start
    this.logger.info(`Performance tracking started: ${operation}`, {
      performance: {
        operation,
        status: 'started',
        startTime: this.startTime,
        memoryBaseline: this.startMemory,
      },
    });
  }

  end(metadata?: Record<string, unknown>): PerformanceMetrics {
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - this.startTime;
    
    const memoryDelta = {
      rss: endMemory.rss - this.startMemory.rss,
      heapUsed: endMemory.heapUsed - this.startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - this.startMemory.heapTotal,
      external: endMemory.external - this.startMemory.external,
    };

    const metrics: PerformanceMetrics = {
      operation: this.operation,
      duration,
      memoryUsage: endMemory,
      metadata,
    };

    // Determine log level based on performance
    const level = duration > 2000 ? 'error' : duration > 1000 ? 'warn' : 'info';

    this.logger.log(level, `Performance tracking completed: ${this.operation}`, {
      performance: {
        operation: this.operation,
        status: 'completed',
        duration,
        timing: {
          startTime: this.startTime,
          endTime,
          slow: duration > 100,
          verySlow: duration > 1000,
          critical: duration > 2000,
        },
        memory: {
          start: this.startMemory,
          end: endMemory,
          delta: memoryDelta,
          memoryGrowth: memoryDelta.heapUsed > 0,
        },
      },
      ...metadata,
    });

    // Log performance warning if slow
    if (duration > 1000) {
      this.logger.warn(`Slow operation detected: ${this.operation}`, {
        performance: {
          operation: this.operation,
          duration,
          threshold: 1000,
          slowOperationAlert: true,
          severity: duration > 2000 ? 'critical' : 'warning',
        },
        ...metadata,
      });
    }

    // Log memory warning if significant growth
    if (memoryDelta.heapUsed > 50 * 1024 * 1024) { // 50MB growth
      this.logger.warn(`High memory usage detected: ${this.operation}`, {
        performance: {
          operation: this.operation,
          memoryGrowth: memoryDelta.heapUsed,
          threshold: 50 * 1024 * 1024,
          highMemoryAlert: true,
        },
        memory: {
          delta: memoryDelta,
          current: endMemory,
        },
        ...metadata,
      });
    }

    return metrics;
  }

  checkpoint(checkpointName: string, metadata?: Record<string, unknown>): void {
    const currentTime = Date.now();
    const currentMemory = process.memoryUsage();
    const duration = currentTime - this.startTime;
    
    const memoryDelta = {
      rss: currentMemory.rss - this.startMemory.rss,
      heapUsed: currentMemory.heapUsed - this.startMemory.heapUsed,
      heapTotal: currentMemory.heapTotal - this.startMemory.heapTotal,
      external: currentMemory.external - this.startMemory.external,
    };

    this.logger.debug(`Performance checkpoint: ${this.operation} - ${checkpointName}`, {
      performance: {
        operation: this.operation,
        checkpoint: checkpointName,
        durationSoFar: duration,
        memory: {
          current: currentMemory,
          delta: memoryDelta,
        },
      },
      ...metadata,
    });
  }
}

// Utility function to track function execution
export function trackPerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  correlationId?: string,
  requestId?: string,
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const tracker = new PerformanceTracker(operation, correlationId, requestId);
    
    try {
      const result = await fn();
      tracker.end({ success: true });
      resolve(result);
    } catch (error) {
      tracker.end({ 
        success: false, 
        error: {
          name: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
        },
      });
      reject(error);
    }
  });
}

// Export logger for direct use
export { createPerformanceLogger };