import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    email: text('email').notNull().unique(),
    emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
    image: text('image'),
    createdAt: text('createdAt', { mode: 'text' }).notNull().$type<string>(),
    updatedAt: text('updatedAt', { mode: 'text' }).notNull().$type<string>(),
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
    expiresAt: text('expiresAt', { mode: 'text' }).notNull().$type<string>(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    createdAt: text('createdAt', { mode: 'text' }).notNull().$type<string>(),
    updatedAt: text('updatedAt', { mode: 'text' }).notNull().$type<string>(),
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
    accessTokenExpiresAt: text('accessTokenExpiresAt', { mode: 'text' }).$type<string>(),
    refreshTokenExpiresAt: text('refreshTokenExpiresAt', { mode: 'text' }).$type<string>(),
    scope: text('scope'),
    idToken: text('idToken'),
    createdAt: text('createdAt', { mode: 'text' }).notNull().$type<string>(),
    updatedAt: text('updatedAt', { mode: 'text' }).notNull().$type<string>(),
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
    expiresAt: text('expiresAt', { mode: 'text' }).notNull().$type<string>(),
    createdAt: text('createdAt', { mode: 'text' }).notNull().$type<string>(),
    updatedAt: text('updatedAt', { mode: 'text' }).notNull().$type<string>(),
  },
  (table) => ({
    identifierIdx: index('idx_verification_identifier').on(table.identifier),
    valueIdx: index('idx_verification_value').on(table.value),
  }),
);
