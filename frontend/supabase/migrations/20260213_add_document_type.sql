-- Add document_type column to documents table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'document_type') THEN
        ALTER TABLE documents ADD COLUMN document_type text;
    END IF;
END $$;
