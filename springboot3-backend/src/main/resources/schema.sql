-- Create table for conversation history
CREATE TABLE IF NOT EXISTS conversation_history (
    id varchar PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    conversation_state jsonb, -- JSON string to store conversation state
    is_pinned BOOLEAN NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    pinned_at TIMESTAMP,
    user_id VARCHAR(255) NOT NULL,
    title_generating BOOLEAN,
    is_deleted BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_agents_info (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR,
    icon VARCHAR,
    model_name VARCHAR,
    system_prompt TEXT,
    call_count BIGINT NOT NULL DEFAULT 0,
    temperature NUMERIC,
    max_tokens INTEGER,
    create_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    top_p NUMERIC,
    frequency_penalty NUMERIC,
    presence_penalty NUMERIC,
    output_type VARCHAR,
    create_user VARCHAR,
    tools VARCHAR,
    tags VARCHAR,
    template_schemas TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);
