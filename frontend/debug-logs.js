require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    const { data: logs, error } = await supabase
        .from('service_logs')
        .select('*, performed_by:profiles(email)')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Recent Logs:');
    logs.forEach(l => {
        console.log(`ID: ${l.id}, Time: ${l.performed_at}, Created: ${l.created_at}, Note: ${l.note}`);
    });
}

checkLogs();
