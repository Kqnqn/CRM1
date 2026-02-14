require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Database Connection...');
console.log('URL:', supabaseUrl);
console.log('Key (first 10 chars):', supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'UNDEFINED');

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: Missing environment variables!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        // Try to list folders (requires database access)
        const { data, error } = await supabase.from('document_folders').select('count', { count: 'exact', head: true });

        if (error) {
            console.error('CONNECTION FAILED:', error.message);
        } else {
            console.log('SUCCESS! Database Connected.');
            console.log('Folder count:', data);
        }
    } catch (err) {
        console.error('EXCEPTION:', err);
    }
}

testConnection();
