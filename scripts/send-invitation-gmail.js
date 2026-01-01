const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
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
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Gmail configuratie
const GMAIL_USER = process.env.GMAIL_USER || process.env.GMAIL_EMAIL || '';
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || '';

if (!GMAIL_USER || !GMAIL_PASSWORD) {
  console.error('❌ Missing Gmail credentials');
  console.error('   Zorg dat GMAIL_USER en GMAIL_PASSWORD (of GMAIL_APP_PASSWORD) zijn ingesteld in .env.local');
  process.exit(1);
}

const supabase = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : createClient(supabaseUrl, supabaseAnonKey);

// Maak Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASSWORD
  }
});

async function sendInvitationEmail() {
  try {
    console.log('🔍 Zoeken naar Elvira Straver...');

    // Zoek Elvira in members
    const { data: members, error: membersError } = await supabase
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

    if (!elvira.email) {
      console.error('❌ Geen email adres gevonden voor Elvira');
      process.exit(1);
    }

    // Genereer een tijdelijke wachtwoord of gebruik OTP
    // Voor nu gebruiken we OTP via Supabase Auth
    console.log('📧 Genereren van inlogcode...');
    
    const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
      email: elvira.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
        data: {
          name: elvira.name,
          member_id: elvira.id
        }
      }
    });

    if (otpError) {
      throw new Error(`Error generating OTP: ${otpError.message}`);
    }

    // Haal de app URL op
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Email template
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
                <p><strong>Email:</strong> ${elvira.email}</p>
                <p><strong>Inlogmethode:</strong> Je ontvangt een 8-cijferige code per email om in te loggen</p>
            </div>
            
            <div class="steps">
                <h3>Hoe log je in?</h3>
                <ol>
                    <li>Ga naar de webapp: <a href="${appUrl}">${appUrl}</a></li>
                    <li>Vul je email adres in: <strong>${elvira.email}</strong></li>
                    <li>Klik op "Stuur code naar email"</li>
                    <li>Check je email voor de 8-cijferige code</li>
                    <li>Voer de code in om in te loggen</li>
                </ol>
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
- Email: ${elvira.email}
- Inlogmethode: Je ontvangt een 8-cijferige code per email om in te loggen

Hoe log je in?
1. Ga naar de webapp: ${appUrl}
2. Vul je email adres in: ${elvira.email}
3. Klik op "Stuur code naar email"
4. Check je email voor de 8-cijferige code
5. Voer de code in om in te loggen

Heb je vragen? Neem gerust contact met ons op via info@manegeduiksehoef.nl of bel +31 620685310.

---
Manege Duikse Hoef
Duikse Hoef 1, 5175 PG Loon op Zand
info@manegeduiksehoef.nl | +31 620685310
    `;

    // Verstuur email via Gmail
    console.log('📧 Versturen van uitnodigingsemail via Gmail...');
    
    const mailOptions = {
      from: `"Manege Duikse Hoef" <${GMAIL_USER}>`,
      to: elvira.email,
      subject: 'Uitnodiging voor Manege Duikse Hoef Webapp',
      text: emailText,
      html: emailHtml
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Uitnodigingsemail succesvol verstuurd!');
    console.log(`📧 Email gestuurd naar: ${elvira.email}`);
    console.log(`📬 Message ID: ${info.messageId}`);
    console.log('\n📝 Email bevat:');
    console.log('   - Welkomstbericht');
    console.log('   - Inloggegevens (email adres)');
    console.log('   - Instructies om in te loggen met code');
    console.log('   - Link naar de webapp');

  } catch (error) {
    console.error('❌ Fout:', error.message);
    if (error.response) {
      console.error('   SMTP Response:', error.response);
    }
    process.exit(1);
  }
}

sendInvitationEmail();

