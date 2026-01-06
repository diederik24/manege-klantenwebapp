/**
 * Robuust Supabase user management script
 * - Vindt bestaande users (gepagineerd)
 * - Reset wachtwoord OF maakt user aan
 * - Koppelt optioneel aan member
 * - Idempotent & veilig
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* =========================
   ENV & SETUP
========================= */

if (typeof window !== 'undefined') {
  throw new Error('❌ Dit script mag alleen in Node.js draaien');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const full = path.join(__dirname, '..', file);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, 'utf8');
      content.split('\n').forEach(line => {
        if (!line || line.startsWith('#')) return;
        const [k, ...v] = line.split('=');
        if (!process.env[k]) {
          process.env[k] = v.join('=').replace(/^["']|["']$/g, '');
        }
      });
    }
  }
}
loadEnv();

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL;

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL of SERVICE_ROLE_KEY ontbreekt');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/* =========================
   HELPERS
========================= */

function generatePassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I, O voor verwarring
  const numbers = '0123456789';
  
  // 3 hoofdletters
  const letter1 = letters[Math.floor(Math.random() * letters.length)];
  const letter2 = letters[Math.floor(Math.random() * letters.length)];
  const letter3 = letters[Math.floor(Math.random() * letters.length)];
  
  // 2 cijfers
  const num1 = numbers[Math.floor(Math.random() * numbers.length)];
  const num2 = numbers[Math.floor(Math.random() * numbers.length)];
  
  // 1 hoofdletter
  const letter4 = letters[Math.floor(Math.random() * letters.length)];
  
  return `${letter1}${letter2}${letter3}${num1}${num2}${letter4}`;
}

async function getAllUsers() {
  let users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
  }

  return users;
}

/* =========================
   CORE LOGIC
========================= */

async function manageUser(emailInput) {
  const email = emailInput.toLowerCase().trim();
  console.log(`🔍 Email: ${email}\n`);

  const users = await getAllUsers();
  let user = users.find(u => u.email?.toLowerCase() === email);

  // Zoek member (case-insensitive)
  const { data: member } = await supabase
    .from('members')
    .select('id, name, email')
    .ilike('email', email)
    .maybeSingle();

  const memberId = member?.id ?? null;
  const memberName = member?.name ?? 'Gebruiker';

  /* ===== USER BESTAAT ===== */
  if (user) {
    console.log('✅ Bestaand account gevonden');
    const newPassword = generatePassword();

    await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword
    });

    logCredentials(user.email, newPassword, memberName);
    return;
  }

  /* ===== USER BESTAAT NIET ===== */
  console.log('➕ Nieuw account aanmaken');

  const newPassword = generatePassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: newPassword,
    email_confirm: true,
    user_metadata: {
      name: memberName,
      member_id: memberId
    }
  });

  if (error) {
    if (error.code === 'email_exists') {
      console.log('⚠️ Account bestaat al → opnieuw ophalen');
      return manageUser(email);
    }
    throw error;
  }

  user = data.user;

  /* ===== KOPPELING MEMBER ===== */
  if (memberId) {
    try {
      // Probeer eerst RPC functie
      const { error: rpcError } = await supabase.rpc('link_customer_account', {
        p_auth_user_id: user.id,
        p_member_id: memberId
      });

      if (rpcError) {
        // Fallback naar direct insert
        const { error: linkError } = await supabase
          .from('klantappversie1.customer_accounts')
          .upsert(
            {
              auth_user_id: user.id,
              member_id: memberId
            },
            { onConflict: 'auth_user_id' }
          );

        if (linkError) {
          console.log(`⚠️ Koppeling niet gemaakt: ${linkError.message}`);
        } else {
          console.log('✅ Account gekoppeld aan member');
        }
      } else {
        console.log('✅ Account gekoppeld aan member');
      }
    } catch (linkErr) {
      console.log(`⚠️ Koppeling niet gemaakt: ${linkErr.message}`);
    }
  }

  logCredentials(user.email, newPassword, memberName);
}

/* =========================
   OUTPUT
========================= */

function logCredentials(email, password, name) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 INLOGGEGEVENS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Email      : ${email}`);
  console.log(`Wachtwoord : ${password}`);
  if (name && name !== 'Gebruiker') {
    console.log(`Klant      : ${name}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/* =========================
   CLI
========================= */

const emailArg = process.argv[2];

if (!emailArg) {
  console.error('❌ Gebruik: node manage-user.js <email>');
  process.exit(1);
}

manageUser(emailArg)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Fout:', err.message);
    process.exit(1);
  });

