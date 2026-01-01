const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Laad environment variables
const envPaths = [
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', '.env'),
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), '.env')
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log(`✓ Environment variables geladen van: ${envPath}`);
    break;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Zorg dat NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn ingesteld');
  process.exit(1);
}

if (!supabaseServiceRoleKey) {
  console.error('⚠️  WAARSCHUWING: SUPABASE_SERVICE_ROLE_KEY niet gevonden!');
  console.error('   Zonder service role key kan het wachtwoord niet worden ingesteld.');
  console.error('   Het wachtwoord in de email werkt dan mogelijk niet.');
}

// Maak Supabase client voor database queries (gebruik anon key of service role key)
const supabaseForQuery = supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient(supabaseUrl, supabaseServiceRoleKey);

// Maak Supabase client voor admin operaties (gebruik service role key)
const supabase = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : createClient(supabaseUrl, supabaseAnonKey);

async function sendInvitationEmail() {
  try {
    console.log('🔍 Zoeken naar Elvira Straver...');

    // Zoek Elvira in members (gebruik anon key voor queries, service role voor admin)
    const queryClient = supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : supabase;
    const { data: members, error: membersError } = await queryClient
      .from('members')
      .select('id, name, email')
      .or('name.ilike.%Elvira%,email.ilike.%elvira%');

    if (membersError) {
      throw new Error(`Error finding member: ${membersError.message}`);
    }

    if (!members || members.length === 0) {
      console.error('❌ Elvira niet gevonden in members');
      process.exit(1);
    }

    const elvira = members[0];
    console.log(`✓ Elvira gevonden: ${elvira.name} (${elvira.email})`);

    // Gebruik het email adres van Elvira of het opgegeven adres
    const recipientEmail = 'diederik24@icloud.com';
    console.log(`📧 Email wordt verstuurd naar: ${recipientEmail}`);

    // Haal de app URL op
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://manege-klantenwebapp.vercel.app';

    // Genereer een eenvoudig wachtwoord gebaseerd op de naam (bijv. Elv78E2)
    function generateSimplePassword(name) {
      // Neem eerste 3 letters van de naam (hoofdletters)
      const namePart = name.substring(0, 3).toUpperCase();
      // Genereer 2 willekeurige cijfers
      const numbers = Math.floor(Math.random() * 90) + 10; // 10-99
      // Neem laatste letter van de naam (hoofdletter)
      const lastLetter = name.substring(name.length - 1).toUpperCase();
      return `${namePart}${numbers}${lastLetter}`;
    }

    // Genereer eenvoudig wachtwoord (bijv. Elv78E2)
    const generatedPassword = generateSimplePassword(elvira.name);
    console.log(`🔐 Wachtwoord gegenereerd: ${generatedPassword}`);

    // Check of er al een auth account bestaat en update/maak aan
    console.log('🔍 Controleren of account al bestaat...');
    
    if (!supabaseServiceRoleKey) {
      console.error('❌ GEEN SERVICE ROLE KEY GEVONDEN!');
      console.error('   Zonder service role key kan het wachtwoord NIET worden ingesteld.');
      console.error('   Voeg SUPABASE_SERVICE_ROLE_KEY toe aan .env.local');
      console.error('   Je vindt deze in Supabase Dashboard → Settings → API → service_role key');
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is vereist om wachtwoord in te stellen');
    }

    try {
      // Haal alle gebruikers op
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        throw new Error(`Kan gebruikers niet ophalen: ${listError.message}`);
      }

      const existingUser = users?.find(u => u.email === recipientEmail);
      
      if (existingUser) {
        // Account bestaat al, update wachtwoord
        console.log('✓ Account bestaat al, wachtwoord wordt bijgewerkt...');
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            password: generatedPassword,
            user_metadata: {
              name: elvira.name,
              member_id: elvira.id
            }
          }
        );

        if (updateError) {
          throw new Error(`Wachtwoord update fout: ${updateError.message}`);
        }
        
        console.log('✅ Wachtwoord succesvol bijgewerkt voor bestaand account');
      } else {
        // Account bestaat niet, maak het aan
        console.log('📝 Account bestaat niet, wordt aangemaakt...');
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: recipientEmail,
          password: generatedPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            name: elvira.name,
            member_id: elvira.id
          }
        });

        if (authError) {
          // Als account al bestaat (race condition), probeer opnieuw te updaten
          if (authError.message.includes('already registered') || authError.code === 'email_exists') {
            console.log('⚠️  Account bestaat al (race condition), wachtwoord wordt bijgewerkt...');
            const { data: { users: retryUsers } } = await supabase.auth.admin.listUsers();
            const retryUser = retryUsers?.find(u => u.email === recipientEmail);
            if (retryUser) {
              const { error: retryUpdateError } = await supabase.auth.admin.updateUserById(
                retryUser.id,
                {
                  password: generatedPassword,
                  user_metadata: {
                    name: elvira.name,
                    member_id: elvira.id
                  }
                }
              );
              if (retryUpdateError) {
                throw new Error(`Wachtwoord update fout: ${retryUpdateError.message}`);
              }
              console.log('✅ Wachtwoord succesvol bijgewerkt');
            } else {
              throw new Error('Account bestaat maar kan niet worden gevonden voor update');
            }
          } else {
            throw authError;
          }
        } else {
          console.log('✅ Account succesvol aangemaakt met wachtwoord');
        }
      }

      // Wacht even zodat het account volledig is aangemaakt/geüpdatet
      console.log('⏳ Wachten op account synchronisatie...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test of het wachtwoord werkt door in te loggen
      console.log('🔐 Testen of wachtwoord werkt...');
      const testSupabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: testData, error: testError } = await testSupabase.auth.signInWithPassword({
        email: recipientEmail,
        password: generatedPassword
      });

      if (testError) {
        console.error('❌ Wachtwoord test MISLUKT:', testError.message);
        console.error('   Het wachtwoord werkt NIET!');
        throw new Error(`Wachtwoord werkt niet: ${testError.message}`);
      } else {
        console.log('✅ Wachtwoord test succesvol - wachtwoord werkt!');
        console.log(`   Email: ${recipientEmail}`);
        console.log(`   Wachtwoord: ${generatedPassword}`);
        // Log uit na test
        await testSupabase.auth.signOut();
      }

    } catch (error) {
      console.error('❌ Fout bij account aanmaken/updaten:', error.message);
      throw error; // Stop het script als wachtwoord niet werkt
    }

    // Email HTML template
    const emailHtml = `
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
            <h1>🐴 Manege Duikse Hoef</h1>
        </div>
        
        <div class="content">
            <h2>Welkom bij onze nieuwe webapp!</h2>
            
            <p>Beste ${elvira.name},</p>
            
            <p>We zijn blij je uit te nodigen voor onze nieuwe webapp! Hier kun je eenvoudig je lessen bekijken, leskaarten inzien en op de hoogte blijven van alle belangrijke updates.</p>
            
            <div class="login-info">
                <h3>📱 Inloggegevens</h3>
                <p><strong>Email:</strong> ${recipientEmail}</p>
                <p><strong>Wachtwoord:</strong> <code style="background-color: #f0f0f0; padding: 5px 10px; border-radius: 4px; font-size: 18px; font-weight: bold; color: #E72D81;">${generatedPassword}</code></p>
            </div>
            
            <div class="steps">
                <h3>Hoe log je in?</h3>
                <ol>
                    <li>Ga naar de webapp: <a href="${appUrl}">${appUrl}</a></li>
                    <li>Vul je email adres in: <strong>${recipientEmail}</strong></li>
                    <li>Vul je wachtwoord in: <strong>${generatedPassword}</strong></li>
                    <li>Klik op "Inloggen"</li>
                </ol>
                <p style="margin-top: 15px; padding: 10px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                    <strong>💡 Tip:</strong> Je kunt je wachtwoord later wijzigen in het profiel menu.
                </p>
            </div>
            
            <div style="text-align: center;">
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

    const emailText = `
Welkom bij Manege Duikse Hoef Webapp!

Beste ${elvira.name},

We zijn blij je uit te nodigen voor onze nieuwe webapp! Hier kun je eenvoudig je lessen bekijken, leskaarten inzien en op de hoogte blijven van alle belangrijke updates.

Inloggegevens:
- Email: ${recipientEmail}
- Wachtwoord: ${generatedPassword}

Hoe log je in?
1. Ga naar de webapp: ${appUrl}
2. Vul je email adres in: ${recipientEmail}
3. Vul je wachtwoord in: ${generatedPassword}
4. Klik op "Inloggen"

💡 Tip: Je kunt je wachtwoord later wijzigen in het profiel menu.

Heb je vragen? Neem gerust contact met ons op via info@manegeduiksehoef.nl of bel +31 620685310.

---
Manege Duikse Hoef
Duikse Hoef 1, 5175 PG Loon op Zand
info@manegeduiksehoef.nl | +31 620685310
    `;

    // Roep Supabase Edge Function aan
    console.log('📧 Versturen van uitnodigingsemail via Supabase Edge Function...');
    
    const functionUrl = `${supabaseUrl}/functions/v1/send-email`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject: 'Uitnodiging voor Manege Duikse Hoef Webapp',
        htmlBody: emailHtml,
        textBody: emailText
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Uitnodigingsemail succesvol verstuurd!');
    console.log(`📧 Email gestuurd naar: ${recipientEmail}`);
    console.log(`📬 Response:`, result);
    console.log('\n📝 Email bevat:');
    console.log('   - Welkomstbericht');
    console.log(`   - Inloggegevens (email: ${recipientEmail}, wachtwoord: ${generatedPassword})`);
    console.log('   - Instructies om in te loggen');
    console.log('   - Link naar de webapp');

  } catch (error) {
    console.error('❌ Fout:', error.message);
    if (error.response) {
      console.error('   Response:', error.response);
    }
    process.exit(1);
  }
}

sendInvitationEmail();

