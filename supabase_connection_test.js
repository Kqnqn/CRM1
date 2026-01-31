// Test Supabase connection
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dnzcbahkooglbwadeleg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuemNiYWhrb29nbGJ3YWRlbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MTEwNTUsImV4cCI6MjA4NTA4NzA1NX0.rSz8icML7sc8ydQ6jwHEweF_6HVZkSv5ySFcc5yXDQ0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseConnection() {
    console.log('🔍 Testing Supabase connection...');
    
    try {
        // Test basic connection
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
            console.log('❌ Supabase connection error:', error.message);
            return false;
        }
        
        console.log('✅ Supabase connection successful');
        console.log('Session data:', data ? 'Session exists' : 'No active session');
        
        // Test if we can access the profiles table (this will help verify database setup)
        try {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('count')
                .limit(1);
                
            if (profileError) {
                console.log('⚠️ Profiles table access error:', profileError.message);
                console.log('This might be expected if the table doesn\'t exist or RLS is enabled');
            } else {
                console.log('✅ Profiles table accessible');
            }
        } catch (tableError) {
            console.log('⚠️ Table access test failed:', tableError.message);
        }
        
        return true;
        
    } catch (error) {
        console.log('❌ Supabase connection failed:', error.message);
        return false;
    }
}

testSupabaseConnection().then(success => {
    console.log('\n📊 Supabase connection test completed');
    process.exit(success ? 0 : 1);
});