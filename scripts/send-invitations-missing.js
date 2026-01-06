/**
 * Script om uitnodigingsmails te sturen naar klanten die nog geen mail hebben gehad
 * Maakt accounts aan voor klanten zonder account en stuurt uitnodigingen met inloggegevens
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
let supabaseAnonKey = '';

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
          } else if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
            supabaseAnonKey = value;
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
if (!supabaseAnonKey) {
  supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Fout: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten zijn ingesteld');
  console.error('Gebruik: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node send-invitations-missing.js');
  process.exit(1);
}

// Maak Supabase client met service role key (heeft admin rechten)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

// Tracking bestand voor verzonden emails
const trackingFilePath = path.join(__dirname, '..', 'sent-invitations.json');

// Laad tracking data
function loadTrackingData() {
  try {
    if (fs.existsSync(trackingFilePath)) {
      const content = fs.readFileSync(trackingFilePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.log('⚠️  Kon tracking data niet laden, start met lege lijst');
  }
  return { sentEmails: [], lastUpdated: null };
}

// Sla tracking data op
function saveTrackingData(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(trackingFilePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('⚠️  Kon tracking data niet opslaan:', error.message);
  }
}

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

// Email HTML template
function getEmailHtml(name, email, password, appUrl) {
  return `
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Uitnodiging Manege Duikse Hoef Webapp</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #E72D81;
        }
        .header h1 {
            color: #E72D81;
            margin: 0;
            font-size: 28px;
        }
        .content {
            margin-bottom: 30px;
        }
        .content h2 {
            color: #333;
            font-size: 20px;
            margin-top: 0;
        }
        .content p {
            color: #666;
            font-size: 16px;
            margin-bottom: 15px;
        }
        .login-info {
            background-color: #f9f9f9;
            border-left: 4px solid #E72D81;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .login-info h3 {
            color: #E72D81;
            margin-top: 0;
            font-size: 18px;
        }
        .login-info p {
            margin: 5px 0;
            font-size: 14px;
        }
        .button {
            display: inline-block;
            background-color: #E72D81;
            color: #ffffff;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
        }
        .button:hover {
            background-color: #C2185B;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 12px;
        }
        .steps {
            margin: 20px 0;
        }
        .steps ol {
            padding-left: 20px;
        }
        .steps li {
            margin: 10px 0;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Manege Duikse Hoef</h1>
        </div>
        
        <div class="content">
            <h2>Welkom bij onze nieuwe webapp!</h2>
            
            <p>Beste ${name},</p>
            
            <p>We zijn blij je uit te nodigen voor onze nieuwe webapp! Hier kun je eenvoudig je lessen bekijken, leskaarten inzien en op de hoogte blijven van alle belangrijke updates.</p>
            
            <div class="login-info">
                <h3>Inloggegevens:</h3>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Wachtwoord:</strong> ${password}</p>
            </div>
            
            <div class="steps">
                <h3>Hoe log je in?</h3>
                <ol>
                    <li>Ga naar de webapp: <a href="${appUrl}">${appUrl}</a></li>
                    <li>Vul je email adres in: <strong>${email}</strong></li>
                    <li>Vul je wachtwoord in: <strong>${password}</strong></li>
                    <li>Klik op "Inloggen"</li>
                </ol>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}" class="button">Ga naar de webapp</a>
            </div>
            
            <p>Heb je vragen? Neem gerust contact met ons op via <a href="mailto:info@manegeduiksehoef.nl">info@manegeduiksehoef.nl</a> of bel +31 620685310.</p>
        </div>
        
        <div class="footer">
            <p>Manege Duikse Hoef<br>
            Duikse Hoef 1, 5175 PG Loon op Zand<br>
            <a href="mailto:info@manegeduiksehoef.nl">info@manegeduiksehoef.nl</a> | +31 620685310</p>
        </div>
    </div>
</body>
</html>
  `;
}

function getEmailText(name, email, password, appUrl) {
  return `
Welkom bij Manege Duikse Hoef Webapp!

Beste ${name},

We zijn blij je uit te nodigen voor onze nieuwe webapp! Hier kun je eenvoudig je lessen bekijken, leskaarten inzien en op de hoogte blijven van alle belangrijke updates.

Inloggegevens:
- Email: ${email}
- Wachtwoord: ${password}

Hoe log je in?
1. Ga naar de webapp: ${appUrl}
2. Vul je email adres in: ${email}
3. Vul je wachtwoord in: ${password}
4. Klik op "Inloggen"

Tip: Je kunt je wachtwoord later wijzigen in het profiel menu.

Heb je vragen? Neem gerust contact met ons op via info@manegeduiksehoef.nl of bel +31 620685310.

---
Manege Duikse Hoef
Duikse Hoef 1, 5175 PG Loon op Zand
info@manegeduiksehoef.nl | +31 620685310
  `;
}

async function sendInvitationsToMissing() {
  try {
    console.log('📧 Uitnodigingsmails versturen naar klanten die nog geen mail hebben gehad...\n');

    // Laad tracking data
    const trackingData = loadTrackingData();
    const sentEmails = new Set(trackingData.sentEmails || []);
    console.log(`📋 ${sentEmails.size} emails zijn al eerder verstuurd\n`);

    // Haal alle klanten op (met email)
    console.log('1️⃣ Ophalen van alle klanten...');
    const { data: allMembers, error: membersError } = await supabase
      .from('members')
      .select('id, name, email')
      .not('email', 'is', null)
      .neq('email', '');

    if (membersError) {
      throw new Error(`Fout bij ophalen klanten: ${membersError.message}`);
    }

    if (!allMembers || allMembers.length === 0) {
      console.log('⚠️ Geen klanten gevonden.');
      return;
    }

    console.log(`✅ ${allMembers.length} klanten gevonden met email adres\n`);

    // Haal bestaande accounts op
    console.log('2️⃣ Controleren welke accounts al bestaan...');
    const { data: { users: existingAuthUsers } } = await supabase.auth.admin.listUsers();
    const existingEmails = new Set(existingAuthUsers?.map(u => u.email?.toLowerCase()) || []);

    const { data: existingAccounts } = await supabase
      .schema('klantappversie1')
      .from('customer_accounts')
      .select('member_id');

    const existingMemberIds = new Set();
    if (existingAccounts) {
      existingAccounts.forEach(acc => {
        existingMemberIds.add(acc.member_id);
      });
    }

    console.log(`✅ ${existingEmails.size} bestaande auth accounts gevonden\n`);

    // Filter klanten die nog geen mail hebben gehad
    const klantenZonderMail = allMembers.filter(member => {
      const email = member.email?.toLowerCase().trim();
      return email && !sentEmails.has(email);
    });

    console.log(`✅ ${klantenZonderMail.length} klanten gevonden die nog geen mail hebben gehad\n`);

    if (klantenZonderMail.length === 0) {
      console.log('✅ Alle klanten hebben al een uitnodigingsmail ontvangen!');
      return;
    }

    // Haal app URL op
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bit.ly/MDHAPP';

    let successCount = 0;
    let errorCount = 0;
    let createdCount = 0;
    let existingCount = 0;
    const errors = [];
    const newlySentEmails = [];

    // Verwerk elke klant
    for (let i = 0; i < klantenZonderMail.length; i++) {
      const member = klantenZonderMail[i];
      const memberId = member.id;
      const memberName = member.name;
      const memberEmail = member.email?.toLowerCase().trim();

      if (!memberEmail) {
        console.log(`⚠️  [${i + 1}/${klantenZonderMail.length}] ${memberName}: Geen email, overslaan`);
        continue;
      }

      console.log(`📧 [${i + 1}/${klantenZonderMail.length}] Verwerken: ${memberName} (${memberEmail})...`);

      try {
        let authUserId;
        let password;
        let isNewAccount = false;

        // Check of account al bestaat
        const emailExists = existingEmails.has(memberEmail);
        const accountExists = existingMemberIds.has(memberId);

        if (emailExists) {
          // Account bestaat al, haal user op
          const existingUser = existingAuthUsers.find(u => u.email?.toLowerCase() === memberEmail);
          if (existingUser) {
            authUserId = existingUser.id;
            // Genereer nieuw wachtwoord voor bestaand account
            password = generatePassword();
            console.log(`   ℹ️  Account bestaat al, wachtwoord wordt bijgewerkt...`);
            
            const { error: updateError } = await supabase.auth.admin.updateUserById(
              authUserId,
              { password: password }
            );

            if (updateError) {
              throw new Error(`Wachtwoord update fout: ${updateError.message}`);
            }
            
            existingCount++;
          } else {
            throw new Error('Account bestaat maar user niet gevonden');
          }
        } else {
          // Maak nieuw account
          password = generatePassword();
          console.log(`   📝 Nieuw account aanmaken...`);
          
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: memberEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              name: memberName,
              member_id: memberId
            }
          });

          if (authError) {
            // Als account al bestaat, probeer opnieuw op te halen
            if (authError.message.includes('already registered') || authError.code === 'email_exists') {
              console.log(`   ℹ️  Account bestaat al, ophalen...`);
              // Haal users opnieuw op om zeker te zijn dat we de nieuwste lijst hebben
              const { data: { users: freshUsers }, error: listError } = await supabase.auth.admin.listUsers();
              
              if (listError) {
                throw new Error(`Kan users niet ophalen: ${listError.message}`);
              }
              
              const user = freshUsers?.find(u => u.email?.toLowerCase().trim() === memberEmail);
              
              if (user) {
                authUserId = user.id;
                password = generatePassword();
                const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, { password: password });
                
                if (updateError) {
                  throw new Error(`Wachtwoord update fout: ${updateError.message}`);
                }
                
                existingCount++;
                console.log(`   ✅ Wachtwoord bijgewerkt`);
              } else {
                // Als we de user niet kunnen vinden, genereer een wachtwoord en stuur email
                // De gebruiker kan dan proberen in te loggen of wachtwoord reset gebruiken
                console.log(`   ⚠️  User niet gevonden in lijst, maar account bestaat wel.`);
                password = generatePassword();
                console.log(`   ⚠️  Email wordt verstuurd. Gebruiker kan wachtwoord reset gebruiken als nodig.`);
                existingCount++;
                // authUserId blijft undefined, maar we kunnen nog steeds email sturen
              }
            } else {
              throw new Error(`Account aanmaken fout: ${authError.message}`);
            }
          } else {
            authUserId = authData.user.id;
            isNewAccount = true;
            createdCount++;
            console.log(`   ✅ Account aangemaakt`);
          }
        }

        // Koppel account aan member (als dit nog niet bestaat en we een authUserId hebben)
        if (authUserId && !accountExists) {
          try {
            // Probeer eerst via RPC met schema
            let linkError = null;
            try {
              const { error: rpcError } = await supabase.rpc('link_customer_account', {
                p_auth_user_id: authUserId,
                p_member_id: memberId
              });
              linkError = rpcError;
            } catch (rpcErr) {
              // Als RPC niet werkt, probeer direct insert
              const { error: insertError } = await supabase
                .schema('klantappversie1')
                .from('customer_accounts')
                .insert({
                  auth_user_id: authUserId,
                  member_id: memberId
                });
              linkError = insertError;
            }

            if (linkError) {
              if (linkError.code === '23505' || linkError.message?.includes('duplicate') || linkError.message?.includes('already exists')) {
                console.log(`   ℹ️  Koppeling bestaat al`);
              } else {
                console.log(`   ⚠️  Koppeling niet gemaakt: ${linkError.message}`);
              }
            } else {
              console.log(`   ✅ Account gekoppeld aan klant`);
            }
          } catch (err) {
            console.log(`   ⚠️  Koppeling niet gemaakt: ${err.message}`);
          }
        }

        // Stuur email (zorg dat we een wachtwoord hebben)
        if (!password) {
          password = generatePassword();
          console.log(`   ⚠️  Geen wachtwoord beschikbaar, nieuw wachtwoord gegenereerd voor email`);
        }
        
        const emailHtml = getEmailHtml(memberName, memberEmail, password, appUrl);
        const emailText = getEmailText(memberName, memberEmail, password, appUrl);

        const functionUrl = `${supabaseUrl}/functions/v1/send-email`;
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: memberEmail,
            subject: 'Uitnodiging voor Manege Duikse Hoef Webapp',
            htmlBody: emailHtml,
            textBody: emailText
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Email fout: ${response.status} - ${errorText}`);
        }

        console.log(`   ✅ Email succesvol verstuurd`);
        successCount++;
        newlySentEmails.push(memberEmail);

        // Wacht even tussen emails
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Fout: ${error.message}`);
        errorCount++;
        errors.push({ name: memberName, email: memberEmail, reason: error.message });
      }
    }

    // Update tracking data
    if (newlySentEmails.length > 0) {
      trackingData.sentEmails = [...sentEmails, ...newlySentEmails];
      saveTrackingData(trackingData);
      console.log(`\n💾 Tracking data bijgewerkt: ${newlySentEmails.length} nieuwe emails toegevoegd`);
    }

    // Samenvatting
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SAMENVATTING:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Succesvol verstuurd: ${successCount}`);
    console.log(`📝 Nieuwe accounts aangemaakt: ${createdCount}`);
    console.log(`🔄 Bestaande accounts bijgewerkt: ${existingCount}`);
    console.log(`❌ Fouten: ${errorCount}`);
    console.log(`📋 Totaal verwerkt: ${klantenZonderMail.length}`);
    console.log(`📧 Totaal verzonden emails (totaal): ${trackingData.sentEmails.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (errors.length > 0) {
      console.log('❌ Fouten:');
      errors.forEach(err => {
        console.log(`   - ${err.name} (${err.email}): ${err.reason}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Onverwachte fout:', error);
    process.exit(1);
  }
}

// Run het script
sendInvitationsToMissing();

