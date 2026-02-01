import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    email: text('email').notNull().unique(),
    emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
  }),
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_sessions_userId').on(table.userId),
    tokenIdx: index('idx_sessions_token').on(table.token),
  }),
);

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    idToken: text('idToken'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    userIdIdx: index('idx_accounts_userId').on(table.userId),
    providerIdx: index('idx_accounts_provider').on(table.providerId, table.accountId),
  }),
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    identifierIdx: index('idx_verification_identifier').on(table.identifier),
    valueIdx: index('idx_verification_value').on(table.value),
  }),
);
