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
    title_generating BOOLEAN DEFAULT FALSE
);

-- Create indexes for conversation_history table
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_is_pinned ON conversation_history(is_pinned);
CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at ON conversation_history(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_history_updated_at ON conversation_history(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversation_history_pinned_at ON conversation_history(pinned_at);