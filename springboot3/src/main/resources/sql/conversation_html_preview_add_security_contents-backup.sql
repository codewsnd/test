CREATE TABLE IF NOT EXISTS conversation_html_preview (
                                                         id VARCHAR(36) PRIMARY KEY,
                                                         staff_id text NOT NULL,
                                                         conversation_id text NOT NULL,
                                                         turn_id text NOT NULL,
                                                         s3_path text NOT NULL,
                                                         created_at TIMESTAMP NOT NULL,
                                                         has_xss BOOLEAN,
                                                         xss_content TEXT,
                                                         has_external_references BOOLEAN,
                                                         external_references_content TEXT,
                                                         html_content_length INTEGER
);


ALTER TABLE conversation_html_preview
    ADD COLUMN IF NOT EXISTS xss_content TEXT;

ALTER TABLE conversation_html_preview
    ADD COLUMN IF NOT EXISTS external_references_content TEXT;

ALTER TABLE conversation_html_preview
    ADD COLUMN IF NOT EXISTS html_content_hash TEXT;

ALTER TABLE conversation_html_preview
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
