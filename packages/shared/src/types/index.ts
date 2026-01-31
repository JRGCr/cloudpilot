/**
 * Shared type definitions
 */

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      meta?: {
        requestId?: string;
        timestamp: string;
      };
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
      meta: {
        requestId: string;
        timestamp: string;
      };
    };

export type { ValidationError } from '../utils/validation.js';
