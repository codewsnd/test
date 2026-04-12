ALTER TABLE conversation_html_preview
    ADD COLUMN IF NOT EXISTS xss_content TEXT;

ALTER TABLE conversation_html_preview
    ADD COLUMN IF NOT EXISTS external_references_content TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'conversation_html_preview'
          AND column_name = 'xss_report'
    ) THEN
        EXECUTE '
            UPDATE conversation_html_preview
            SET xss_content = COALESCE(xss_content, xss_report)
            WHERE xss_report IS NOT NULL
        ';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'conversation_html_preview'
          AND column_name = 'external_references_report'
    ) THEN
        EXECUTE '
            UPDATE conversation_html_preview
            SET external_references_content = COALESCE(external_references_content, external_references_report)
            WHERE external_references_report IS NOT NULL
        ';
    END IF;
END $$;
