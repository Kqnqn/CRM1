require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('Fetching most recent service contract...');
    const { data: services, error: sError } = await supabase
        .from('service_contracts')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (sError) console.error('Error:', sError);
    else console.log('Service Contract:', JSON.stringify(services[0], null, 2));

    console.log('\nFetching most recent service logs...');
    const { data: logs, error: lError } = await supabase
        .from('service_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (lError) console.error('Error:', lError);
    else console.log('Service Logs:', JSON.stringify(logs, null, 2));
}

verify();
