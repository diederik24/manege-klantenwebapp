/**
 * Script om inloggegevens op te halen of opnieuw in te stellen voor een gebruiker
 * Eenvoudige versie zonder tegenstrijdige berichten
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lees environment variabelen
let supabaseUrl = '';
let supabaseServiceRoleKey = '';

// Probeer eerst .env bestanden te lezen
try {
  let envContent = '';
  try {
    envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  } catch (e) {
    try {
      envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    } catch (e2) {
      // Geen .env bestand gevonden
    }
  }
  
  if (envContent) {
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (key && value) {
          if (key === 'NEXT_PUBLIC_SUPABASE_URL' || key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') {
            supabaseUrl = value;
          } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
            supabaseServiceRoleKey = value;
          }
        }
      }
    });
  }
} catch (error) {
  // Ignore file read errors
}

// Fallback naar process.env
if (!supabaseUrl) {
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
}
if (!supabaseServiceRoleKey) {
  supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Fout: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten zijn ingesteld');
  process.exit(1);
}

// Maak Supabase client met service role key
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Genereer wachtwoord in formaat ELV67R (3 letters + 2 cijfers + 1 letter)
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

async function getUserCredentials(email) {
  try {
    const searchEmail = email.toLowerCase().trim();
    console.log(`🔍 Zoeken naar: ${searchEmail}\n`);

    // STAP 1: Haal alle users op en zoek op email
    console.log('1️⃣ Zoeken in bestaande accounts...');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Fout bij ophalen users: ${listError.message}`);
    }

    // Zoek gebruiker (case-insensitive)
    const user = users?.find(u => u.email?.toLowerCase().trim() === searchEmail);

    if (user) {
      // Account bestaat al
      console.log(`✅ Account gevonden!\n`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Aangemaakt: ${new Date(user.created_at).toLocaleString('nl-NL')}\n`);
      
      // Genereer nieuw wachtwoord
      const newPassword = generatePassword();
      console.log(`2️⃣ Wachtwoord resetten...`);
      
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) {
        throw new Error(`Fout bij resetten wachtwoord: ${updateError.message}`);
      }

      console.log(`✅ Wachtwoord gereset!\n`);

      // Haal member informatie op
      const { data: accountData } = await supabase
        .schema('klantappversie1')
        .from('customer_accounts')
        .select('member_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      let memberName = null;
      if (accountData?.member_id) {
        const { data: memberData } = await supabase
          .from('members')
          .select('name')
          .eq('id', accountData.member_id)
          .maybeSingle();

        if (memberData?.name) {
          memberName = memberData.name;
        }
      }

      // Toon inloggegevens
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 INLOG GEGEVENS:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Email: ${user.email}`);
      console.log(`Wachtwoord: ${newPassword}`);
      if (memberName) {
        console.log(`Klant: ${memberName}`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return;
    }

    // STAP 2: Account bestaat niet, zoek member en maak account aan
    console.log(`⚠️  Geen account gevonden met dit email adres\n`);
    console.log('2️⃣ Zoeken naar member in database...');
    
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('id, name, email')
      .eq('email', searchEmail)
      .maybeSingle();
    
    let memberId = null;
    let memberName = 'Gebruiker';
    
    if (memberError || !memberData) {
      console.log(`⚠️  Geen member gevonden met email: ${searchEmail}`);
      console.log(`   Account wordt aangemaakt zonder member koppeling\n`);
    } else {
      memberId = memberData.id;
      memberName = memberData.name || 'Gebruiker';
      console.log(`✅ Member gevonden: ${memberName} (${memberId})\n`);
      
      // Check of er al een account is gekoppeld aan deze member
      const { data: existingAccount } = await supabase
        .schema('klantappversie1')
        .from('customer_accounts')
        .select('auth_user_id')
        .eq('member_id', memberId)
        .maybeSingle();
      
      if (existingAccount?.auth_user_id) {
        console.log(`ℹ️  Er is al een account gekoppeld aan deze member`);
        // Zoek het account op via auth_user_id
        const linkedUser = users?.find(u => u.id === existingAccount.auth_user_id);
        if (linkedUser) {
          console.log(`✅ Account gevonden via member koppeling: ${linkedUser.email}\n`);
          
          // Reset wachtwoord
          const newPassword = generatePassword();
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            linkedUser.id,
            { password: newPassword }
          );
          if (updateError) {
            throw new Error(`Fout bij resetten wachtwoord: ${updateError.message}`);
          }
          
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📧 INLOG GEGEVENS:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`Email: ${linkedUser.email}`);
          console.log(`Wachtwoord: ${newPassword}`);
          console.log(`Klant: ${memberName}`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          return;
        }
      }
    }
    
    // STAP 3: Maak nieuw account aan
    console.log('3️⃣ Nieuw account aanmaken...');
    const newPassword = generatePassword();
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: searchEmail,
      password: newPassword,
      email_confirm: true,
      user_metadata: {
        name: memberName,
        member_id: memberId
      }
    });

    if (authError) {
      // Als account al bestaat (race condition), probeer opnieuw
      if (authError.message.includes('already registered') || authError.code === 'email_exists') {
        console.log(`⚠️  Account bestaat al volgens Supabase\n`);
        
        // Probeer eerst via member_id als we die hebben
        if (memberId) {
          console.log(`   Zoeken via member_id...`);
          const { data: accountData } = await supabase
            .schema('klantappversie1')
            .from('customer_accounts')
            .select('auth_user_id')
            .eq('member_id', memberId)
            .maybeSingle();
          
          if (accountData?.auth_user_id) {
            // Haal user op via auth_user_id
            const { data: { users: allUsers }, error: allError } = await supabase.auth.admin.listUsers();
            if (!allError && allUsers) {
              const foundUser = allUsers.find(u => u.id === accountData.auth_user_id);
              if (foundUser) {
                console.log(`✅ Account gevonden via member koppeling: ${foundUser.email}\n`);
                
                // Reset wachtwoord
                const { error: updateError } = await supabase.auth.admin.updateUserById(
                  foundUser.id,
                  { password: newPassword }
                );
                if (updateError) {
                  throw new Error(`Fout bij resetten wachtwoord: ${updateError.message}`);
                }
                
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📧 INLOG GEGEVENS:');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`Email: ${foundUser.email}`);
                console.log(`Wachtwoord: ${newPassword}`);
                console.log(`Klant: ${memberName}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                return;
              }
            }
          }
        }
        
        // Probeer opnieuw in de lijst (misschien is het net toegevoegd)
        console.log(`   Opnieuw zoeken in accounts lijst...`);
        const { data: { users: freshUsers }, error: freshError } = await supabase.auth.admin.listUsers();
        if (freshError) {
          throw new Error(`Kan users niet ophalen: ${freshError.message}`);
        }
        
        const foundUser = freshUsers?.find(u => u.email?.toLowerCase().trim() === searchEmail);
        if (foundUser) {
          console.log(`✅ Account gevonden: ${foundUser.email}\n`);
          
          // Reset wachtwoord
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            foundUser.id,
            { password: newPassword }
          );
          if (updateError) {
            throw new Error(`Fout bij resetten wachtwoord: ${updateError.message}`);
          }
          
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('📧 INLOG GEGEVENS:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`Email: ${foundUser.email}`);
          console.log(`Wachtwoord: ${newPassword}`);
          if (memberName !== 'Gebruiker') {
            console.log(`Klant: ${memberName}`);
          }
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          return;
        } else {
          // Account bestaat maar kan niet worden gevonden - gebruik member email als fallback
          console.log(`⚠️  Account bestaat maar kan niet worden gevonden in lijst`);
          console.log(`   Dit kan betekenen dat het account is verwijderd of dat er een probleem is`);
          console.log(`\n💡 Probeer handmatig in Supabase Dashboard of gebruik wachtwoord reset functie\n`);
          throw new Error(`Account bestaat volgens Supabase maar kan niet worden gevonden. Probeer handmatig in Supabase Dashboard.`);
        }
      } else {
        throw new Error(`Fout bij aanmaken account: ${authError.message}`);
      }
    }

    const newUser = authData.user;
    console.log(`✅ Account aangemaakt: ${newUser.id}\n`);

    // STAP 4: Koppel account aan member
    if (memberId) {
      console.log('4️⃣ Account koppelen aan member...');
      try {
        const { error: linkError } = await supabase
          .schema('klantappversie1')
          .from('customer_accounts')
          .insert({
            auth_user_id: newUser.id,
            member_id: memberId
          });

        if (linkError) {
          if (linkError.code === '23505' || linkError.message?.includes('duplicate')) {
            console.log(`ℹ️  Koppeling bestaat al\n`);
          } else {
            console.log(`⚠️  Koppeling niet gemaakt: ${linkError.message}\n`);
          }
        } else {
          console.log(`✅ Account gekoppeld aan member\n`);
        }
      } catch (linkErr) {
        console.log(`⚠️  Koppeling niet gemaakt: ${linkErr.message}\n`);
      }
    }

    // Toon inloggegevens
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 INLOG GEGEVENS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${newUser.email}`);
    console.log(`Wachtwoord: ${newPassword}`);
    if (memberName !== 'Gebruiker') {
      console.log(`Klant: ${memberName}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Fout:', error.message);
    process.exit(1);
  }
}

// Haal email op uit command line argument
const email = process.argv[2];

if (!email) {
  console.error('❌ Gebruik: node get-user-credentials.js <email>');
  console.error('   Voorbeeld: node get-user-credentials.js laureeblom2009@gmail.com');
  process.exit(1);
}

getUserCredentials(email);
