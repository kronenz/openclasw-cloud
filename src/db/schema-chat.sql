-- OpenClasw Cloud Chat Conversations Schema
-- Stores conversation history for web chat interface

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_session ON conversations(tenant_id, session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
