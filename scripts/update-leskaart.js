/**
 * Script om leskaart aan te passen
 * Aanpassen van aantal lessen voor een specifieke klant
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

async function updateLeskaart(emailOrName, nieuwTotaalLessen) {
  try {
    console.log(`🔍 Zoeken naar klant: ${emailOrName}\n`);

    // Zoek member op email of naam
    const { data: members, error: memberError } = await supabase
      .from('members')
      .select('id, name, email')
      .or(`email.ilike.%${emailOrName}%,name.ilike.%${emailOrName}%`);

    if (memberError) {
      throw new Error(`Fout bij zoeken member: ${memberError.message}`);
    }

    if (!members || members.length === 0) {
      throw new Error(`Geen member gevonden met: ${emailOrName}`);
    }

    if (members.length > 1) {
      console.log('⚠️  Meerdere members gevonden:');
      members.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.name} (${m.email}) - ${m.id}`);
      });
      throw new Error('Meerdere members gevonden, gebruik specifiekere zoekterm');
    }

    const member = members[0];
    console.log(`✅ Member gevonden: ${member.name} (${member.email})\n`);

    // Zoek actieve leskaarten
    const { data: leskaarten, error: leskaartError } = await supabase
      .from('leskaarten')
      .select('*')
      .eq('klant_id', member.id)
      .eq('status', 'actief')
      .order('created_at', { ascending: false });

    if (leskaartError) {
      throw new Error(`Fout bij ophalen leskaarten: ${leskaartError.message}`);
    }

    if (!leskaarten || leskaarten.length === 0) {
      throw new Error('Geen actieve leskaarten gevonden voor deze klant');
    }

    console.log(`📋 Gevonden ${leskaarten.length} actieve leskaart(en):\n`);
    leskaarten.forEach((lk, i) => {
      console.log(`   ${i + 1}. Leskaart ${lk.id.substring(0, 8)}...`);
      console.log(`      Totaal: ${lk.totaal_lessen} lessen`);
      console.log(`      Gebruikt: ${lk.gebruikte_lessen} lessen`);
      console.log(`      Resterend: ${lk.resterende_lessen} lessen`);
      console.log(`      Status: ${lk.status}\n`);
    });

    // Als er meerdere zijn, gebruik de nieuwste (eerste in lijst)
    const leskaart = leskaarten[0];
    
    if (leskaarten.length > 1) {
      console.log(`⚠️  Meerdere actieve leskaarten gevonden, pas de nieuwste aan: ${leskaart.id.substring(0, 8)}...\n`);
    }

    const huidigTotaal = leskaart.totaal_lessen;
    const gebruikteLessen = leskaart.gebruikte_lessen;
    const nieuwResterend = nieuwTotaalLessen - gebruikteLessen;

    console.log('📝 Aanpassen leskaart:');
    console.log(`   Huidig totaal: ${huidigTotaal} lessen`);
    console.log(`   Nieuw totaal: ${nieuwTotaalLessen} lessen`);
    console.log(`   Gebruikte lessen: ${gebruikteLessen} lessen`);
    console.log(`   Nieuwe resterende lessen: ${nieuwResterend} lessen\n`);

    if (nieuwResterend < 0) {
      throw new Error(`Fout: Nieuw totaal (${nieuwTotaalLessen}) is kleiner dan gebruikte lessen (${gebruikteLessen})`);
    }

    // Update leskaart
    const { error: updateError } = await supabase
      .from('leskaarten')
      .update({
        totaal_lessen: nieuwTotaalLessen,
        resterende_lessen: nieuwResterend,
        updated_at: new Date().toISOString()
      })
      .eq('id', leskaart.id);

    if (updateError) {
      throw new Error(`Fout bij updaten leskaart: ${updateError.message}`);
    }

    console.log('✅ Leskaart succesvol aangepast!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 LESKAART GEGEVENS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Klant      : ${member.name}`);
    console.log(`Email      : ${member.email}`);
    console.log(`Totaal     : ${nieuwTotaalLessen} lessen`);
    console.log(`Gebruikt   : ${gebruikteLessen} lessen`);
    console.log(`Resterend  : ${nieuwResterend} lessen`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Fout:', error.message);
    process.exit(1);
  }
}

// Haal argumenten op
const emailOrName = process.argv[2];
const nieuwTotaalLessen = parseInt(process.argv[3]);

if (!emailOrName || !nieuwTotaalLessen || isNaN(nieuwTotaalLessen)) {
  console.error('❌ Gebruik: node update-leskaart.js <email-of-naam> <nieuw-totaal-lessen>');
  console.error('   Voorbeeld: node update-leskaart.js laureeblom2009@gmail.com 10');
  console.error('   Voorbeeld: node update-leskaart.js "Laurée Blom" 10');
  process.exit(1);
}

updateLeskaart(emailOrName, nieuwTotaalLessen);

