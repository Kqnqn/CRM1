require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAudit() {
    const { data: logs, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('action', 'SERVICE_COMPLETED')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Recent SERVICE_COMPLETED audits:');
    logs.forEach(l => {
        console.log(`ID: ${l.id}, EntityID: ${l.entity_id}, Created: ${l.created_at}`);
    });
}

checkAudit();
