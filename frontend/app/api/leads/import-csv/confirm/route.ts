import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
    try {
        const { importId, createContacts } = await req.json();

        if (!importId) {
            return NextResponse.json({ error: 'Missing importId' }, { status: 400 });
        }

        const token = req.headers.get('Authorization')?.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } }
        });

        // 1. Fetch the import data
        const { data: importRecord, error: fetchError } = await supabase
            .from('data_imports')
            .select('*')
            .eq('id', importId)
            .single();

        if (fetchError || !importRecord) {
            return NextResponse.json({ error: 'Import record not found' }, { status: 404 });
        }

        if (importRecord.status === 'COMPLETED') {
            return NextResponse.json({ message: 'Already processed' });
        }

        const rows = importRecord.data as any[];

        // 2. Insert Leads
        const { data: insertedLeads, error: insertError } = await supabase
            .from('leads')
            .insert(rows)
            .select();

        if (insertError) throw new Error(insertError.message);

        let contactsCreated = 0;

        // 3. Optional: Create Contacts/Accounts
        if (createContacts && insertedLeads) {
            for (const lead of insertedLeads) {
                // Check if Account exists
                const { data: existingAccounts } = await supabase
                    .from('accounts')
                    .select('id')
                    .ilike('name', lead.company_name);

                let accountId = existingAccounts && existingAccounts.length > 0 ? existingAccounts[0].id : null;

                if (!accountId) {
                    // Create Placeholder Account
                    const { data: newAccount, error: accError } = await supabase
                        .from('accounts')
                        .insert({
                            name: lead.company_name,
                            owner_id: lead.owner_id,
                            stage: 'OPEN'
                        })
                        .select('id')
                        .single();

                    if (!accError && newAccount) {
                        accountId = newAccount.id;
                    }
                }

                if (accountId) {
                    // Create Contact
                    // Extract first/last name
                    const names = lead.contact_person_name.split(' ');
                    const firstName = names[0];
                    const lastName = names.slice(1).join(' ') || '-';

                    await supabase.from('contacts').insert({
                        account_id: accountId,
                        first_name: firstName,
                        last_name: lastName,
                        email: lead.email,
                        phone: lead.phone,
                        owner_id: lead.owner_id
                    });
                    contactsCreated++;
                }
            }
        }

        // 4. Mark Import as Completed
        await supabase.from('data_imports').update({ status: 'COMPLETED' }).eq('id', importId);

        return NextResponse.json({
            success: true,
            leadsCreated: insertedLeads?.length || 0,
            contactsCreated
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
