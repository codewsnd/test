-- Create table for conversation history
CREATE TABLE IF NOT EXISTS conversation_history (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    conversation_state TEXT, -- JSON string to store conversation state
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pinned_at TIMESTAMP,
    user_id VARCHAR(255) NOT NULL,
    title_generating BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE conversation_history
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Create indexes for conversation_history table
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_is_pinned ON conversation_history(is_pinned);
CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at ON conversation_history(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_history_updated_at ON conversation_history(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversation_history_pinned_at ON conversation_history(pinned_at);
CREATE INDEX IF NOT EXISTS idx_conversation_history_is_deleted ON conversation_history(is_deleted);

CREATE TABLE IF NOT EXISTS conversation_html_preview (
    id VARCHAR(36) PRIMARY KEY,
    staff_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    turn_id TEXT NOT NULL,
    s3_path TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    has_xss BOOLEAN,
    xss_content TEXT,
    has_external_references BOOLEAN,
    external_references_content TEXT,
    html_content_length INTEGER,
    html_content_hash TEXT,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversation_html_preview_staff_conversation_turn
    ON conversation_html_preview(staff_id, conversation_id, turn_id);

CREATE TABLE IF NOT EXISTS conversation_html_share (
    id VARCHAR(64) PRIMARY KEY,
    preview_id VARCHAR(64) NOT NULL UNIQUE,
    staff_id VARCHAR(255) NOT NULL,
    conversation_id VARCHAR(255) NOT NULL,
    turn_id VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_conversation_html_share_preview
        FOREIGN KEY (preview_id) REFERENCES conversation_html_preview(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_html_share_preview_id
    ON conversation_html_share(preview_id);
