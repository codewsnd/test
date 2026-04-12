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
