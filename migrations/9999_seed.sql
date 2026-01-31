-- Development seed data
-- Only run in development environment

INSERT OR IGNORE INTO users (id, name, email, emailVerified, image, createdAt, updatedAt)
VALUES (
  'dev-user-001',
  'Development User',
  'dev@cloudpilot.local',
  1,
  NULL,
  datetime('now'),
  datetime('now')
);
