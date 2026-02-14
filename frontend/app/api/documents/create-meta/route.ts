import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
    console.log('--- CREATE-META API START ---');
    try {
        if (!supabaseUrl || !supabaseKey) {
            console.error('CRITICAL: Supabase Env Vars missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const body = await req.json();
        const { fileData, docType, userId, entityType, entityId } = body;

        console.log('Request Params:', {
            title: fileData?.title,
            docType,
            userId,
            entityType,
            entityId
        });

        if (!userId || !fileData) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Utility for Timeout
        const withTimeout = (promise: Promise<any>, ms = 10000) => {
            return Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), ms))
            ]);
        };

        // 1. Find or Create Folder
        let folderId = null;
        let folderName = docType || 'Uncategorized';
        console.log('Looking for folder:', folderName);

        try {
            const { data: existingFolder, error: findError } = await withTimeout((supabase
                .from('document_folders')
                .select('id')
                .eq('owner_id', userId)
                .eq('name', folderName)
                .maybeSingle()) as any);

            if (findError) throw findError;

            if (existingFolder) {
                folderId = existingFolder.id;
                console.log('Folder exists:', folderId);
            } else {
                console.log('Creating folder...');
                const { data: newFolder, error: folderError } = await withTimeout((supabase
                    .from('document_folders')
                    .insert({ name: folderName, owner_id: userId })
                    .select('id')
                    .single()) as any);

                if (folderError) throw folderError;
                folderId = newFolder.id;
                console.log('Folder created:', folderId);
            }
        } catch (e: any) {
            console.error('Folder Logic Error:', e);
            // Non-fatal, we can still upload document without folder
        }

        // 2. Insert Document Record
        console.log('Inserting Document...');
        let documentToInsert = {
            title: fileData.title,
            file_name: fileData.fileName,
            file_size: fileData.fileSize,
            mime_type: fileData.mimeType,
            storage_key: fileData.storageKey,
            uploaded_by: userId,
            folder_id: folderId,
            document_type: docType
        };

        let newDoc, docError;
        try {
            const result = await withTimeout((supabase
                .from('documents')
                .insert(documentToInsert)
                .select('id')
                .single()) as any);
            newDoc = result.data;
            docError = result.error;
        } catch (e: any) {
            // Check if error is "column not found"
            if (e.code === 'PGRST204' || e.message?.includes('document_type')) {
                console.warn('RETRIYING without document_type column due to schema cache issue');
                const { document_type, ...fallbackInsert } = documentToInsert;
                const result = await withTimeout((supabase
                    .from('documents')
                    .insert(fallbackInsert)
                    .select('id')
                    .single()) as any);
                newDoc = result.data;
                docError = result.error;
            } else {
                throw e;
            }
        }

        if (docError) {
            console.error('Document Insert Error:', docError);
            throw docError;
        }
        console.log('Document inserted:', newDoc.id);

        // 3. Link to Entity
        if (entityType && entityId) {
            console.log('Linking to Entity:', entityType, entityId);
            const { error: linkError } = await withTimeout((supabase
                .from('document_links')
                .insert({
                    document_id: newDoc.id,
                    linked_to_type: entityType,
                    linked_to_id: entityId,
                    linked_by: userId
                })) as any);

            if (linkError) {
                console.error('Link Error:', linkError);
                throw linkError;
            }
            console.log('Link created successfully');
        }

        console.log('--- CREATE-META API SUCCESS ---');
        return NextResponse.json({ success: true, document: { id: newDoc.id } });

    } catch (error: any) {
        console.error('--- CREATE-META API CRITICAL ERROR ---');
        console.error(error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error',
            details: error
        }, { status: 500 });
    }
}
