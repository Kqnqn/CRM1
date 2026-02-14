const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './frontend/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkService() {
    // Get the most recently updated service contract
    const { data: services, error } = await supabase
        .from('service_contracts')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error fetching service:', error);
        return;
    }

    if (services && services.length > 0) {
        console.log('Most recently updated service contract:');
        console.log(JSON.stringify(services[0], null, 2));
    } else {
        console.log('No service contracts found.');
    }
}

checkService();
