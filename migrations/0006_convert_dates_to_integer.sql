-- Convert date columns from TEXT to INTEGER (Unix timestamps)
-- This is the proper way to handle dates in SQLite/D1

-- 1. Create new tables with INTEGER timestamp columns
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expiresAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE accounts_new (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope TEXT,
  idToken TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE verification_new (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

-- 2. Copy data, converting TEXT dates to INTEGER timestamps
INSERT INTO users_new SELECT
  id, name, email, emailVerified, image,
  CAST(strftime('%s', createdAt) * 1000 AS INTEGER),
  CAST(strftime('%s', updatedAt) * 1000 AS INTEGER)
FROM users;

INSERT INTO sessions_new SELECT
  id, userId, token,
  CAST(strftime('%s', expiresAt) * 1000 AS INTEGER),
  ipAddress, userAgent,
  CAST(strftime('%s', createdAt) * 1000 AS INTEGER),
  CAST(strftime('%s', updatedAt) * 1000 AS INTEGER)
FROM sessions;

INSERT INTO accounts_new SELECT
  id, userId, accountId, providerId, accessToken, refreshToken,
  CASE WHEN accessTokenExpiresAt IS NOT NULL
    THEN CAST(strftime('%s', accessTokenExpiresAt) * 1000 AS INTEGER)
    ELSE NULL END,
  CASE WHEN refreshTokenExpiresAt IS NOT NULL
    THEN CAST(strftime('%s', refreshTokenExpiresAt) * 1000 AS INTEGER)
    ELSE NULL END,
  scope, idToken,
  CAST(strftime('%s', createdAt) * 1000 AS INTEGER),
  CAST(strftime('%s', updatedAt) * 1000 AS INTEGER)
FROM accounts;

INSERT INTO verification_new SELECT
  id, identifier, value,
  CAST(strftime('%s', expiresAt) * 1000 AS INTEGER),
  CAST(strftime('%s', createdAt) * 1000 AS INTEGER),
  CAST(strftime('%s', updatedAt) * 1000 AS INTEGER)
FROM verification;

-- 3. Drop old tables
DROP TABLE verification;
DROP TABLE accounts;
DROP TABLE sessions;
DROP TABLE users;

-- 4. Rename new tables
ALTER TABLE users_new RENAME TO users;
ALTER TABLE sessions_new RENAME TO sessions;
ALTER TABLE accounts_new RENAME TO accounts;
ALTER TABLE verification_new RENAME TO verification;

-- 5. Recreate indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_userId ON sessions(userId);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_accounts_userId ON accounts(userId);
CREATE INDEX idx_accounts_provider ON accounts(providerId, accountId);
CREATE INDEX idx_verification_identifier ON verification(identifier);
CREATE INDEX idx_verification_value ON verification(value);
