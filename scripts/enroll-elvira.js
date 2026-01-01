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

const supabase = createClient(supabaseUrl, supabaseKey);

async function enrollElvira() {
  try {
    console.log('🔍 Zoeken naar Elvira...');

    // Zoek Elvira in members (probeer verschillende variaties)
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, name, email')
      .or('name.ilike.%Elvira%,email.ilike.%elvira%');

    if (membersError) {
      throw new Error(`Error finding member: ${membersError.message}`);
    }

    if (!members || members.length === 0) {
      console.error('❌ Elvira niet gevonden in members');
      console.log('💡 Beschikbare members:');
      const { data: allMembers } = await supabase
        .from('members')
        .select('id, name, email')
        .limit(10);
      if (allMembers) {
        allMembers.forEach(m => console.log(`   - ${m.name} (${m.email})`));
      }
      process.exit(1);
    }

    const elvira = members[0];
    console.log(`✓ Elvira gevonden: ${elvira.name} (${elvira.email})`);
    console.log(`   Member ID: ${elvira.id}`);

    // Zoek de les: Woensdag 15:00 Groepsles
    // Woensdag = day_of_week 3 (0=maandag, 1=dinsdag, 2=woensdag, etc.)
    // Maar in JavaScript: 0=zondag, 1=maandag, 2=dinsdag, 3=woensdag
    // In Supabase lijkt het alsof 0=maandag is gebaseerd op de code
    // Laat me checken: Woensdag zou day_of_week 2 of 3 kunnen zijn
    console.log('\n🔍 Zoeken naar les: Woensdag 15:00 Groepsles...');

    const { data: lessons, error: lessonsError } = await supabase
      .from('recurring_lessons')
      .select('id, name, day_of_week, time, type')
      .eq('type', 'Groepsles')
      .or('day_of_week.eq.2,day_of_week.eq.3'); // Probeer beide mogelijkheden

    if (lessonsError) {
      throw new Error(`Error finding lesson: ${lessonsError.message}`);
    }

    // Filter op tijd 15:00
    const targetLesson = lessons?.find(lesson => {
      const timeStr = lesson.time ? (typeof lesson.time === 'string' ? lesson.time.substring(0, 5) : lesson.time) : '';
      return timeStr === '15:00' || timeStr.startsWith('15:00');
    });

    if (!targetLesson) {
      console.error('❌ Les "Woensdag 15:00 Groepsles" niet gevonden');
      console.log('💡 Beschikbare lessen:');
      if (lessons) {
        lessons.forEach(l => {
          const timeStr = l.time ? (typeof l.time === 'string' ? l.time.substring(0, 5) : l.time) : '';
          const days = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
          console.log(`   - ${days[l.day_of_week] || 'Onbekend'} ${timeStr} ${l.type} (ID: ${l.id})`);
        });
      }
      process.exit(1);
    }

    const days = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
    const timeStr = targetLesson.time ? (typeof targetLesson.time === 'string' ? targetLesson.time.substring(0, 5) : targetLesson.time) : '';
    console.log(`✓ Les gevonden: ${days[targetLesson.day_of_week] || 'Onbekend'} ${timeStr} ${targetLesson.type}`);
    console.log(`   Lesson ID: ${targetLesson.id}`);

    // Check of Elvira al ingeschreven is
    console.log('\n🔍 Controleren of Elvira al ingeschreven is...');
    const { data: existing, error: checkError } = await supabase
      .from('lesson_participants')
      .select('id')
      .eq('recurring_lesson_id', targetLesson.id)
      .eq('member_id', elvira.id)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Error checking enrollment: ${checkError.message}`);
    }

    if (existing) {
      console.log('⚠️  Elvira is al ingeschreven voor deze les!');
      console.log(`   Participant ID: ${existing.id}`);
      return;
    }

    // Schrijf Elvira in
    console.log('\n📝 Elvira inschrijven voor de les...');
    const { data: participant, error: enrollError } = await supabase
      .from('lesson_participants')
      .insert({
        recurring_lesson_id: targetLesson.id,
        member_id: elvira.id,
        family_member_id: null
      })
      .select()
      .single();

    if (enrollError) {
      throw new Error(`Error enrolling: ${enrollError.message}`);
    }

    console.log('✅ Elvira succesvol ingeschreven voor de les!');
    console.log(`   Participant ID: ${participant.id}`);

  } catch (error) {
    console.error('❌ Fout:', error.message);
    process.exit(1);
  }
}

enrollElvira();

