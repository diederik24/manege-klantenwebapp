const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Laad environment variables (probeer meerdere locaties)
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

// Gebruik service role key als die beschikbaar is, anders anon key (kan RLS restricties hebben)
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceRoleKey ? '✓ Set' : '✗ Missing');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Set (als fallback)' : '✗ Missing');
  console.log('\n💡 Tip: Voeg SUPABASE_SERVICE_ROLE_KEY toe aan je .env.local bestand');
  console.log('   Je vindt deze in Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

if (!supabaseServiceRoleKey && supabaseAnonKey) {
  console.log('⚠️  Waarschuwing: Gebruikt anon key in plaats van service role key');
  console.log('   Dit kan betekenen dat niet alle data wordt opgehaald vanwege RLS restricties');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportLessonsToExcel() {
  try {
    console.log('📊 Ophalen van lessen en klanten...');

    // Haal alle recurring lessons op
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('recurring_lessons')
      .select('id, name, day_of_week, time, type, instructor, max_participants')
      .order('day_of_week', { ascending: true })
      .order('time', { ascending: true });

    if (lessonsError) {
      throw new Error(`Error fetching lessons: ${lessonsError.message}`);
    }

    if (!lessonsData || lessonsData.length === 0) {
      console.log('⚠️  Geen lessen gevonden');
      return;
    }

    console.log(`✓ ${lessonsData.length} lessen gevonden`);

    const days = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
    
    // Haal alle lesson participants op
    console.log('👥 Ophalen van deelnemers...');
    const { data: participantsData, error: participantsError } = await supabase
      .from('lesson_participants')
      .select(`
        recurring_lesson_id,
        member_id,
        family_member_id,
        members:member_id (
          id,
          name,
          email,
          phone
        ),
        family_members:family_member_id (
          id,
          name,
          email,
          telefoon,
          member_id,
          members:member_id (
            id,
            name,
            email,
            phone
          )
        )
      `);

    if (participantsError) {
      throw new Error(`Error fetching participants: ${participantsError.message}`);
    }

    console.log(`✓ ${participantsData?.length || 0} deelnemers gevonden`);

    // Maak een map van lesson_id naar participants
    const lessonParticipantsMap = {};
    
    (participantsData || []).forEach((participant) => {
      const lessonId = participant.recurring_lesson_id;
      if (!lessonParticipantsMap[lessonId]) {
        lessonParticipantsMap[lessonId] = [];
      }
      lessonParticipantsMap[lessonId].push(participant);
    });

    // Bereid Excel data voor
    const excelData = [];

    lessonsData.forEach((lesson) => {
      const participants = lessonParticipantsMap[lesson.id] || [];
      const dayName = days[lesson.day_of_week] || 'Onbekend';
      const timeStr = lesson.time ? (typeof lesson.time === 'string' ? lesson.time.substring(0, 5) : lesson.time) : '';

      if (participants.length === 0) {
        // Les zonder deelnemers
        excelData.push({
          'Les Naam': lesson.name || 'Onbenoemde les',
          'Dag': dayName,
          'Tijd': timeStr,
          'Type': lesson.type || 'Groepsles',
          'Instructeur': lesson.instructor || '',
          'Max Deelnemers': lesson.max_participants || '',
          'Klant Naam': '',
          'Klant Email': '',
          'Klant Telefoon': '',
          'Is Gezinslid': '',
          'Hoofdklant Naam': '',
          'Hoofdklant Email': '',
          'Hoofdklant Telefoon': ''
        });
      } else {
        // Les met deelnemers - één rij per deelnemer
        participants.forEach((participant) => {
          if (participant.family_member_id && participant.family_members) {
            // Gezinslid
            const familyMember = participant.family_members;
            const mainMember = familyMember.members || null;
            
            excelData.push({
              'Les Naam': lesson.name || 'Onbenoemde les',
              'Dag': dayName,
              'Tijd': timeStr,
              'Type': lesson.type || 'Groepsles',
              'Instructeur': lesson.instructor || '',
              'Max Deelnemers': lesson.max_participants || '',
              'Klant Naam': familyMember.name || '',
              'Klant Email': familyMember.email || '',
              'Klant Telefoon': familyMember.telefoon || '',
              'Is Gezinslid': 'Ja',
              'Hoofdklant Naam': mainMember?.name || '',
              'Hoofdklant Email': mainMember?.email || '',
              'Hoofdklant Telefoon': mainMember?.phone || ''
            });
          } else if (participant.member_id && participant.members) {
            // Normale klant
            const member = participant.members;
            
            excelData.push({
              'Les Naam': lesson.name || 'Onbenoemde les',
              'Dag': dayName,
              'Tijd': timeStr,
              'Type': lesson.type || 'Groepsles',
              'Instructeur': lesson.instructor || '',
              'Max Deelnemers': lesson.max_participants || '',
              'Klant Naam': member.name || '',
              'Klant Email': member.email || '',
              'Klant Telefoon': member.phone || '',
              'Is Gezinslid': 'Nee',
              'Hoofdklant Naam': '',
              'Hoofdklant Email': '',
              'Hoofdklant Telefoon': ''
            });
          }
        });
      }
    });

    // Maak Excel workbook
    console.log('📝 Excel bestand genereren...');
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lessen en Klanten');

    // Genereer bestandsnaam
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `lessen_klanten_${dateStr}.xlsx`;
    const filepath = path.join(__dirname, '..', filename);

    // Schrijf Excel bestand
    XLSX.writeFile(workbook, filepath);

    console.log(`✅ Excel bestand succesvol aangemaakt!`);
    console.log(`📁 Locatie: ${filepath}`);
    console.log(`📊 Totaal aantal rijen: ${excelData.length}`);

  } catch (error) {
    console.error('❌ Fout bij exporteren:', error.message);
    process.exit(1);
  }
}

// Voer script uit
exportLessonsToExcel();

