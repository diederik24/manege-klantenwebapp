const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseKey = supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Zorg dat NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY zijn ingesteld');
  process.exit(1);
}

// Maak Supabase client voor queries
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Email HTML template (zelfde als send-invitation-via-edge-function.js)
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
            <h1>🐴 Manege Duikse Hoef</h1>
        </div>
        
        <div class="content">
            <h2>Welkom bij onze nieuwe webapp!</h2>
            
            <p>Beste ${name},</p>
            
            <p>We zijn blij je uit te nodigen voor onze nieuwe webapp! Hier kun je eenvoudig je lessen bekijken, leskaarten inzien en op de hoogte blijven van alle belangrijke updates.</p>
            
            <div class="login-info">
                <h3>📧 Inloggegevens:</h3>
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

💡 Tip: Je kunt je wachtwoord later wijzigen in het profiel menu.

Heb je vragen? Neem gerust contact met ons op via info@manegeduiksehoef.nl of bel +31 620685310.

---
Manege Duikse Hoef
Duikse Hoef 1, 5175 PG Loon op Zand
info@manegeduiksehoef.nl | +31 620685310
  `;
}

async function sendInvitationsToAll() {
  try {
    console.log('📧 Uitnodigingsmails versturen naar alle lesklanten...\n');

    // Lees Excel bestand
    const excelPath = path.join(__dirname, '..', '..', 'Lesklanten-Accounts-2026-01-06.xlsx');
    
    if (!fs.existsSync(excelPath)) {
      console.error(`❌ Excel bestand niet gevonden: ${excelPath}`);
      process.exit(1);
    }

    console.log(`📖 Excel bestand lezen: ${excelPath}...`);
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`✅ ${data.length} klanten gevonden in Excel\n`);

    // Haal app URL op
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bit.ly/MDHAPP';

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Stuur email naar elke klant
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = row['Klant Naam'];
      const email = row['Email'];
      const password = row['Wachtwoord'];

      if (!name || !email || !password) {
        console.log(`⚠️  Rij ${i + 2}: Ontbrekende gegevens (Naam: ${name}, Email: ${email}, Wachtwoord: ${password ? 'Ja' : 'Nee'}) - overslaan`);
        errorCount++;
        errors.push({ name: name || 'Onbekend', reason: 'Ontbrekende gegevens' });
        continue;
      }

      console.log(`📧 [${i + 1}/${data.length}] Versturen naar ${name} (${email})...`);

      try {
        const emailHtml = getEmailHtml(name, email, password, appUrl);
        const emailText = getEmailText(name, email, password, appUrl);

        // Roep Supabase Edge Function aan
        const functionUrl = `${supabaseUrl}/functions/v1/send-email`;
        
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: email,
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
        
        console.log(`   ✅ Succesvol verstuurd naar ${name}`);
        successCount++;

        // Wacht even tussen emails om rate limiting te voorkomen
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Fout bij ${name}: ${error.message}`);
        errorCount++;
        errors.push({ name, email, reason: error.message });
      }
    }

    // Samenvatting
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SAMENVATTING:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Succesvol verstuurd: ${successCount}`);
    console.log(`❌ Fouten: ${errorCount}`);
    console.log(`📋 Totaal: ${data.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (errors.length > 0) {
      console.log('❌ Fouten:');
      errors.forEach(err => {
        console.log(`   - ${err.name} (${err.email || 'geen email'}): ${err.reason}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Onverwachte fout:', error);
    process.exit(1);
  }
}

// Run het script
sendInvitationsToAll();

