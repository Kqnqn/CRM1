import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CSVRow {
  companyName?: string;
  contactPersonName?: string;
  email?: string;
  phone?: string;
  source?: string;
  ownerEmail?: string;
}

interface ImportResult {
  createdCount: number;
  duplicateCount: number;
  errors: Array<{ row: number; error: string; data: CSVRow }>;
}

function parseCSV(text: string): CSVRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header row and one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: CSVRow = {};

    headers.forEach((header, index) => {
      if (values[index]) {
        row[header as keyof CSVRow] = values[index];
      }
    });

    rows.push(row);
  }

  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    const text = await file.text();
    const rows = parseCSV(text);

    const result: ImportResult = {
      createdCount: 0,
      duplicateCount: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row.email) {
        result.errors.push({
          row: i + 2,
          error: 'Email is required',
          data: row,
        });
        continue;
      }

      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('email', row.email)
        .maybeSingle();

      if (existingLead) {
        result.duplicateCount++;
        result.errors.push({
          row: i + 2,
          error: 'Duplicate email',
          data: row,
        });
        continue;
      }

      let ownerId = user.id;

      if (row.ownerEmail) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', row.ownerEmail)
          .maybeSingle();

        if (ownerProfile) {
          ownerId = ownerProfile.id;
        }
      }

      const { error: insertError } = await supabase
        .from('leads')
        .insert({
          company_name: row.companyName || '',
          contact_person_name: row.contactPersonName || '',
          email: row.email,
          phone: row.phone || null,
          source: row.source || null,
          owner_id: ownerId,
          status: 'NEW',
        });

      if (insertError) {
        result.errors.push({
          row: i + 2,
          error: insertError.message,
          data: row,
        });
      } else {
        result.createdCount++;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
