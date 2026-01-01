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
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Gebruik service role key voor admin operaties
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

    // Check of er al een auth user bestaat voor dit email
    console.log('🔍 Controleren of er al een account bestaat...');
    
    // Probeer de gebruiker op te halen via Supabase Auth Admin API
    // Als service role key beschikbaar is, kunnen we admin functies gebruiken
    if (supabaseServiceRoleKey) {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.log('⚠️  Kon gebruikers niet ophalen, probeer direct email te sturen...');
      } else {
        const existingUser = users?.find(u => u.email === elvira.email);
        if (existingUser) {
          console.log('✓ Account bestaat al voor dit email adres');
        }
      }
    }

    // Stuur een OTP code email (dit is de manier om een "uitnodiging" te sturen)
    console.log('📧 Versturen van uitnodigingsemail...');
    
    const { data, error: otpError } = await supabase.auth.signInWithOtp({
      email: elvira.email,
      options: {
        shouldCreateUser: true, // Maak account aan als deze niet bestaat
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
        data: {
          name: elvira.name,
          member_id: elvira.id
        }
      }
    });

    if (otpError) {
      throw new Error(`Error sending email: ${otpError.message}`);
    }

    console.log('✅ Uitnodigingsemail succesvol verstuurd!');
    console.log(`📧 Email gestuurd naar: ${elvira.email}`);
    console.log('\n📝 Email bevat:');
    console.log('   - Een 8-cijferige inlogcode');
    console.log('   - Instructies om in te loggen op de webapp');
    console.log('   - Link naar de app');

  } catch (error) {
    console.error('❌ Fout:', error.message);
    process.exit(1);
  }
}

sendInvitationEmail();

