/**
 * File writer - appends JSON lines to local files (for Node.js environments)
 * Handles rotation when size threshold exceeded
 */

import { DEFAULT_MAX_FILE_SIZE, DEFAULT_ROTATED_FILES_KEEP } from '../constants.js';
import type { LogEntry, LogWriter } from '../types.js';

// Node.js module types for dynamic imports
interface NodeFs {
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  statSync(path: string): { size: number; mtime: Date };
  renameSync(src: string, dest: string): void;
  readdirSync(path: string): string[];
  unlinkSync(path: string): void;
  appendFileSync(path: string, data: string, encoding: string): void;
}

interface NodePath {
  dirname(path: string): string;
  basename(path: string, ext?: string): string;
  extname(path: string): string;
  join(...paths: string[]): string;
}

interface NodeProcess {
  on(event: string, handler: () => void): void;
  exit(code: number): void;
  versions?: { node?: string };
}

// Check for Node.js environment safely
function isNodeEnvironment(): boolean {
  try {
    return (
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as unknown as { process?: NodeProcess }).process !== 'undefined' &&
      (globalThis as unknown as { process?: NodeProcess }).process?.versions?.node !== undefined
    );
  } catch {
    return false;
  }
}

function getProcess(): NodeProcess | undefined {
  try {
    return (globalThis as unknown as { process?: NodeProcess }).process;
  } catch {
    return undefined;
  }
}

export class FileWriter implements LogWriter {
  private filePath: string;
  private maxSize: number;
  private keepRotated: number;
  private buffer: string[] = [];
  private isNode: boolean;
  private fs: NodeFs | null = null;
  private path: NodePath | null = null;

  constructor(options: {
    filePath: string;
    maxSize?: number;
    keepRotated?: number;
  }) {
    this.filePath = options.filePath;
    this.maxSize = options.maxSize ?? DEFAULT_MAX_FILE_SIZE;
    this.keepRotated = options.keepRotated ?? DEFAULT_ROTATED_FILES_KEEP;
    this.isNode = isNodeEnvironment();

    if (this.isNode) {
      this.initNodeModules();
    }
  }

  private async initNodeModules(): Promise<void> {
    try {
      // Dynamic import for Node.js modules - use string concatenation to avoid bundler/TS resolution
      const fsModule = 'node:' + 'fs';
      const pathModule = 'node:' + 'path';
      this.fs = (await import(/* @vite-ignore */ fsModule)) as unknown as NodeFs;
      this.path = (await import(/* @vite-ignore */ pathModule)) as unknown as NodePath;
      this.ensureDirectory();
      this.registerExitHandler();
    } catch {
      // Not in Node environment
      this.isNode = false;
    }
  }

  private ensureDirectory(): void {
    if (!this.fs || !this.path) return;

    const dir = this.path.dirname(this.filePath);
    if (!this.fs.existsSync(dir)) {
      this.fs.mkdirSync(dir, { recursive: true });
    }
  }

  private registerExitHandler(): void {
    const proc = getProcess();
    if (proc?.on) {
      proc.on('exit', () => this.flush());
      proc.on('SIGINT', () => {
        this.flush();
        proc.exit(0);
      });
      proc.on('SIGTERM', () => {
        this.flush();
        proc.exit(0);
      });
    }
  }

  private shouldRotate(): boolean {
    if (!this.fs) return false;

    try {
      if (!this.fs.existsSync(this.filePath)) {
        return false;
      }
      const stats = this.fs.statSync(this.filePath);
      return stats.size >= this.maxSize;
    } catch {
      return false;
    }
  }

  private rotate(): void {
    if (!this.fs || !this.path) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const dir = this.path.dirname(this.filePath);
      const ext = this.path.extname(this.filePath);
      const base = this.path.basename(this.filePath, ext);
      const rotatedPath = this.path.join(dir, `${base}.${timestamp}${ext}`);

      // Rename current file to rotated
      this.fs.renameSync(this.filePath, rotatedPath);

      // Clean up old rotated files
      this.cleanupRotatedFiles();
    } catch {
      // Ignore rotation errors
    }
  }

  private cleanupRotatedFiles(): void {
    if (!this.fs || !this.path) return;

    try {
      const dir = this.path.dirname(this.filePath);
      const ext = this.path.extname(this.filePath);
      const base = this.path.basename(this.filePath, ext);
      const pattern = new RegExp(
        `^${base}\\.\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}${ext.replace('.', '\\.')}$`,
      );

      const rotatedFiles = this.fs
        .readdirSync(dir)
        .filter((f) => pattern.test(f))
        .map((f) => {
          const filePath = this.path?.join(dir, f) ?? '';
          const mtime = this.fs?.statSync(filePath)?.mtime?.getTime() ?? 0;
          return {
            name: f,
            path: filePath,
            mtime,
          };
        })
        .sort((a, b) => b.mtime - a.mtime);

      // Delete files beyond keep count
      for (const file of rotatedFiles.slice(this.keepRotated)) {
        if (file.path) {
          this.fs?.unlinkSync(file.path);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  write(entry: LogEntry): void {
    const line = JSON.stringify(entry);
    this.buffer.push(line);

    // Write immediately for reliability
    this.flush();
  }

  flush(): void {
    if (!this.isNode || !this.fs || this.buffer.length === 0) {
      return;
    }

    // Check if rotation needed
    if (this.shouldRotate()) {
      this.rotate();
    }

    try {
      const content = `${this.buffer.join('\n')}\n`;
      this.fs.appendFileSync(this.filePath, content, 'utf-8');
      this.buffer = [];
    } catch {
      // Keep buffer for retry
    }
  }
}
