/**
 * Script om te controleren of er een account is gekoppeld aan een member
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let supabaseUrl = '';
let supabaseServiceRoleKey = '';

try {
  let envContent = '';
  try {
    envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  } catch (e) {
    try {
      envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    } catch (e2) {}
  }
  
  if (envContent) {
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (key && value) {
          if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
          if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseServiceRoleKey = value;
        }
      }
    });
  }
} catch (error) {}

if (!supabaseUrl) supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
if (!supabaseServiceRoleKey) supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Fout: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten zijn ingesteld');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkAccount() {
  const memberId = 'e2d16a5c-8052-45f9-a214-e4d7211662a8'; // Laurée Blom
  
  console.log('🔍 Controleren account koppeling voor member:', memberId);
  
  // Check customer_accounts via RPC of direct SQL
  console.log('   Zoeken via RPC of direct query...');
  
  // Probeer via RPC functie
  let account = null;
  let accountError = null;
  
  // Probeer direct query met volledige tabel naam
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `SELECT auth_user_id FROM klantappversie1.customer_accounts WHERE member_id = '${memberId}' LIMIT 1`
    });
    if (!error && data) {
      account = { auth_user_id: data[0]?.auth_user_id };
    } else {
      accountError = error;
    }
  } catch (e) {
    // Als RPC niet werkt, probeer direct via from met volledige naam
    try {
      const result = await supabase
        .from('klantappversie1.customer_accounts')
        .select('auth_user_id')
        .eq('member_id', memberId)
        .maybeSingle();
      account = result.data;
      accountError = result.error;
    } catch (e2) {
      accountError = { message: 'Kan tabel niet benaderen' };
    }
  }
  
  console.log('\n1️⃣ Customer account koppeling:');
  if (accountError) {
    console.log('   Error:', accountError.message);
  } else if (account?.auth_user_id) {
    console.log('   ✅ Account gekoppeld!');
    console.log('   Auth User ID:', account.auth_user_id);
    
    // Haal user op
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.log('   Error bij ophalen users:', usersError.message);
    } else {
      const user = users?.find(u => u.id === account.auth_user_id);
      if (user) {
        console.log('   ✅ User gevonden!');
        console.log('   Email:', user.email);
        console.log('   Aangemaakt:', new Date(user.created_at).toLocaleString('nl-NL'));
        
        // Genereer wachtwoord
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const numbers = '0123456789';
        const password = `${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]}${letters[Math.floor(Math.random() * letters.length)]}${numbers[Math.floor(Math.random() * numbers.length)]}${numbers[Math.floor(Math.random() * numbers.length)]}${letters[Math.floor(Math.random() * letters.length)]}`;
        
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password });
        if (updateError) {
          console.log('   Error bij resetten wachtwoord:', updateError.message);
        } else {
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📧 INLOG GEGEVENS:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`Email: ${user.email}`);
          console.log(`Wachtwoord: ${password}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
      } else {
        console.log('   ❌ User niet gevonden in lijst');
      }
    }
  } else {
    console.log('   ⚠️  Geen account koppeling gevonden');
  }
  
  // Check member
  const { data: member } = await supabase
    .from('members')
    .select('id, name, email')
    .eq('id', memberId)
    .maybeSingle();
  
  console.log('\n2️⃣ Member gegevens:');
  if (member) {
    console.log('   Naam:', member.name);
    console.log('   Email:', member.email);
  } else {
    console.log('   ❌ Member niet gevonden');
  }
}

checkAccount();

