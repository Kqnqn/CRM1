import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper to validate email format
const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Initialize Supabase client with Auth header
        const token = req.headers.get('Authorization')?.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');

        // Parse Headers
        // ... (Same parsing logic as before, assuming headers exist)
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

        const validRows: any[] = [];
        const errors: any[] = [];
        let duplicateCount = 0;

        // Fetch existing emails to check duplicates
        // Optimize: fetch all emails or just check one by one?
        // For large imports, fetching all emails might be heavy. 
        // But one-by-one is N queries.
        // Let's fetch all emails from leads for this user (or all if admin).
        // For simplicity, let's just fetch ALL emails since we want to avoid duplicates globally?
        // Requirement says "ensure no duplicates by email".
        const { data: existingLeads } = await supabase.from('leads').select('email');
        const existingEmails = new Set(existingLeads?.map(l => l.email.toLowerCase()) || []);

        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
            const rowData: any = {};

            // Simple mapping based on index if headers match known columns
            headers.forEach((h, idx) => {
                if (h.includes('company')) rowData.company_name = vals[idx];
                else if (h.includes('email')) rowData.email = vals[idx];
                else if (h.includes('phone')) rowData.phone = vals[idx];
                else if (h.includes('source')) rowData.source = vals[idx];
                else if (h.includes('contact') || h === 'name') rowData.contact_person_name = vals[idx];
            });

            // Fallback or specific check
            if (!rowData.contact_person_name && headers.length < 3 && vals[2]) rowData.contact_person_name = vals[2];

            // Validation
            const missing = [];
            if (!rowData.company_name) missing.push('Company Name');
            if (!rowData.contact_person_name) missing.push('Contact Name');
            if (!rowData.email) missing.push('Email');

            if (missing.length > 0) {
                errors.push({ row: i + 1, reason: `Missing: ${missing.join(', ')}`, raw: lines[i] });
                continue;
            }

            if (!isValidEmail(rowData.email)) {
                errors.push({ row: i + 1, reason: 'Invalid Email Format', raw: lines[i] });
                continue;
            }

            if (existingEmails.has(rowData.email.toLowerCase())) {
                duplicateCount++;
                // Requirement: "invalid/incomplete rows" should be in summary.
                // Does duplicate count as invalid?
                // "Show counts: duplicateCount".
                // I'll count it as duplicate but NOT add to validRows.
                errors.push({ row: i + 1, reason: 'Duplicate Email', raw: lines[i], isDuplicate: true });
                continue;
            }

            // Add owner_id
            rowData.owner_id = user.id;
            rowData.status = 'NEW';

            validRows.push(rowData);
        }

        // Store valid rows in data_imports
        const { data: importData, error: dbError } = await supabase
            .from('data_imports')
            .insert({
                entity_type: 'lead',
                data: validRows,
                total_rows: lines.length - 1,
                valid_rows: validRows.length,
                error_rows: errors.length,
                status: 'PENDING',
                created_by: user.id
            })
            .select('id')
            .single();

        if (dbError) throw new Error(dbError.message);

        return NextResponse.json({
            importId: importData.id,
            summary: {
                totalRows: lines.length - 1,
                validRows: validRows.length,
                duplicateCount,
                errorRows: errors.length - duplicateCount, // Duplicates are separate count in UI usually
                errors: errors.slice(0, 100)
            },
            preview: validRows.slice(0, 5)
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
