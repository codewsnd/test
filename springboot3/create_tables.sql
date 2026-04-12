-- Create chat_document_info table
CREATE TABLE IF NOT EXISTS chat_document_info (
    id BIGSERIAL PRIMARY KEY,
    document_name VARCHAR(255),
    document_type VARCHAR(50),
    content TEXT,
    file_size BIGINT,
    upload_time TIMESTAMP,
    create_time TIMESTAMP,
    update_time TIMESTAMP,
    stuff_id VARCHAR(100),
    status VARCHAR(50),
    s3_path VARCHAR(500),
    job_id VARCHAR(100),
    md5 VARCHAR(32)
);

-- Create conversation_history table
CREATE TABLE IF NOT EXISTS conversation_history (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(500),
    conversation_state JSONB,
    is_pinned BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    pinned_at TIMESTAMP,
    staff_id VARCHAR(100),
    title_generating BOOLEAN
);

-- Create test_case_statistics table
CREATE TABLE IF NOT EXISTS test_case_statistics (
    id VARCHAR(100) PRIMARY KEY,
    staff_id VARCHAR(100),
    session_id VARCHAR(100),
    generated_type VARCHAR(50),
    upload_mode VARCHAR(50),
    total_generated_count INTEGER,
    accepted_without_change_count INTEGER,
    accepted_with_change_count INTEGER,
    rejected_count INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
