/**
 * Script om accounts aan te maken voor klanten uit Excel die nog geen account hebben
 * Leest een Excel bestand, checkt welke klanten al een account hebben,
 * en maakt accounts aan voor de rest
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

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
    envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
  } catch (e) {
    try {
      envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
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
  console.error('Gebruik: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node create-missing-accounts-from-excel.js');
  process.exit(1);
}

// Maak Supabase client met service role key (heeft admin rechten)
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

async function createMissingAccountsFromExcel() {
  try {
    console.log('🔐 Accounts aanmaken voor klanten uit Excel die nog geen account hebben...\n');

    // Stap 1: Lees Excel bestand
    const excelPath = path.join(__dirname, 'lessen_klanten_2026-01-01.xlsx');
    console.log(`📖 Excel bestand lezen: ${excelPath}...`);
    
    if (!fs.existsSync(excelPath)) {
      console.error(`❌ Excel bestand niet gevonden: ${excelPath}`);
      process.exit(1);
    }

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    console.log(`✅ Excel bestand gelezen: ${sheetName} sheet met ${rawData.length} rijen\n`);

    // Vind header rij
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (row && Array.isArray(row)) {
        const rowString = row.join(' ').toLowerCase();
        if ((rowString.includes('email') || rowString.includes('e-mail')) && 
            (rowString.includes('naam') || rowString.includes('klant'))) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      console.error('❌ Header rij niet gevonden!');
      process.exit(1);
    }

    console.log(`✅ Header rij gevonden op rij ${headerRowIndex + 1}`);

    // Vind kolom indices
    const headerRow = rawData[headerRowIndex];
    const columns = {
      klantNaam: -1,
      klantEmail: -1,
      hoofdklantNaam: -1,
      hoofdklantEmail: -1,
      klantId: -1
    };

    headerRow.forEach((cell, index) => {
      const cellStr = (cell || '').toString().toLowerCase();
      if (cellStr.includes('klant naam') && !cellStr.includes('hoofd')) {
        columns.klantNaam = index;
      }
      if (cellStr.includes('klant email') && !cellStr.includes('hoofd')) {
        columns.klantEmail = index;
      }
      if (cellStr.includes('hoofdklant naam')) {
        columns.hoofdklantNaam = index;
      }
      if (cellStr.includes('hoofdklant email')) {
        columns.hoofdklantEmail = index;
      }
      if (cellStr.includes('klant id') || cellStr.includes('klant_id')) {
        columns.klantId = index;
      }
    });

    if (columns.klantNaam === -1 || columns.klantEmail === -1) {
      console.error('❌ Vereiste kolommen niet gevonden! Zoek naar: Klant Naam en Klant Email');
      console.log('Beschikbare kolommen:', headerRow.map((h, i) => `${i}: ${h}`).join(', '));
      process.exit(1);
    }

    console.log(`✅ Kolommen gevonden: Klant Naam (${columns.klantNaam}), Klant Email (${columns.klantEmail})${columns.hoofdklantNaam !== -1 ? `, Hoofdklant Naam (${columns.hoofdklantNaam}), Hoofdklant Email (${columns.hoofdklantEmail})` : ''}${columns.klantId !== -1 ? `, Klant ID (${columns.klantId})` : ''}\n`);

    // Parse klanten uit Excel
    const excelKlanten = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      
      // Voeg klant toe (als aanwezig)
      if (row && row[columns.klantNaam] && row[columns.klantEmail]) {
        const naam = (row[columns.klantNaam] || '').toString().trim();
        const email = (row[columns.klantEmail] || '').toString().trim().toLowerCase();
        const klantId = columns.klantId !== -1 ? (row[columns.klantId] || '').toString().trim() : null;

        if (naam && email && email.includes('@')) {
          excelKlanten.push({
            naam,
            email,
            klantId
          });
        }
      }

      // Voeg hoofdklant toe (als aanwezig en niet leeg)
      if (columns.hoofdklantNaam !== -1 && columns.hoofdklantEmail !== -1 && 
          row && row[columns.hoofdklantNaam] && row[columns.hoofdklantEmail]) {
        const naam = (row[columns.hoofdklantNaam] || '').toString().trim();
        const email = (row[columns.hoofdklantEmail] || '').toString().trim().toLowerCase();
        const klantId = columns.klantId !== -1 ? (row[columns.klantId] || '').toString().trim() : null;

        if (naam && email && email.includes('@')) {
          excelKlanten.push({
            naam,
            email,
            klantId
          });
        }
      }
    }

    // Verwijder duplicaten op basis van email
    const uniqueKlanten = [];
    const seenEmails = new Set();
    for (const klant of excelKlanten) {
      if (!seenEmails.has(klant.email)) {
        seenEmails.add(klant.email);
        uniqueKlanten.push(klant);
      }
    }

    console.log(`✅ ${uniqueKlanten.length} unieke klanten gevonden in Excel\n`);

    // Stap 2: Haal alle bestaande accounts op
    console.log('2️⃣ Controleren welke accounts al bestaan...');
    
    // Haal bestaande customer_accounts op
    const { data: existingAccounts, error: accountsError } = await supabase
      .schema('klantappversie1')
      .from('customer_accounts')
      .select('auth_user_id, member_id');

    const existingMemberIds = new Set();
    if (existingAccounts && !accountsError) {
      existingAccounts.forEach(acc => {
        existingMemberIds.add(acc.member_id);
      });
    }

    // Haal bestaande auth users op
    const { data: { users: existingAuthUsers } } = await supabase.auth.admin.listUsers();
    const existingEmails = new Set(existingAuthUsers?.map(u => u.email?.toLowerCase()) || []);

    // Maak een map van email -> member_id voor bestaande accounts
    const emailToMemberIdMap = new Map();
    if (existingAccounts && !accountsError) {
      for (const acc of existingAccounts) {
        const authUser = existingAuthUsers?.find(u => u.id === acc.auth_user_id);
        if (authUser?.email) {
          emailToMemberIdMap.set(authUser.email.toLowerCase(), acc.member_id);
        }
      }
    }

    // Haal ook members op om te matchen op email
    const { data: allMembers, error: membersError } = await supabase
      .from('members')
      .select('id, name, email');

    const emailToMemberMap = new Map();
    if (allMembers && !membersError) {
      allMembers.forEach(m => {
        if (m.email) {
          emailToMemberMap.set(m.email.toLowerCase(), m);
        }
      });
    }

    console.log(`✅ ${existingMemberIds.size} bestaande accounts gevonden\n`);

    // Stap 3: Bepaal welke klanten nog geen account hebben
    const klantenZonderAccount = [];
    
    for (const klant of uniqueKlanten) {
      const email = klant.email.toLowerCase();
      const heeftAccount = existingEmails.has(email) || emailToMemberIdMap.has(email);
      
      if (!heeftAccount) {
        // Zoek member_id op basis van email of klantId
        let memberId = null;
        if (klant.klantId) {
          memberId = klant.klantId;
        } else if (emailToMemberMap.has(email)) {
          memberId = emailToMemberMap.get(email).id;
        }

        klantenZonderAccount.push({
          ...klant,
          memberId
        });
      }
    }

    console.log(`✅ ${klantenZonderAccount.length} klanten zonder account gevonden\n`);

    if (klantenZonderAccount.length === 0) {
      console.log('✅ Alle klanten hebben al een account!');
      return;
    }

    // Stap 4: Maak accounts aan
    console.log('3️⃣ Accounts aanmaken...\n');
    const accounts = [];
    let created = 0;
    let skipped = 0;

    for (const klant of klantenZonderAccount) {
      const memberName = klant.naam;
      const memberEmail = klant.email.toLowerCase().trim();
      const memberId = klant.memberId;

      if (!memberEmail || !memberEmail.includes('@')) {
        console.log(`⚠️  ${memberName}: Geen geldig email adres, overslaan`);
        skipped++;
        continue;
      }

      // Genereer uniek wachtwoord
      const password = generatePassword();

      try {
        // Maak nieuw auth account
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: memberEmail,
          password: password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            name: memberName,
            member_id: memberId
          }
        });

        if (authError) {
          if (authError.message.includes('already registered') || authError.code === 'email_exists') {
            console.log(`⏭️  ${memberName}: Email bestaat al in Auth, overslaan`);
            skipped++;
            continue;
          } else {
            console.error(`❌ ${memberName}: Fout bij aanmaken account: ${authError.message}`);
            skipped++;
            continue;
          }
        }

        const authUserId = authData.user.id;
        created++;
        console.log(`✅ ${memberName}: Account aangemaakt`);

        // Koppel account aan member (als member_id bekend is)
        if (authUserId && memberId) {
          try {
            // Probeer RPC functie eerst
            const { data: linkData, error: rpcError } = await supabase.rpc('link_customer_account', {
              p_auth_user_id: authUserId,
              p_member_id: memberId
            });

            if (rpcError) {
              // Als RPC niet werkt, probeer direct insert
              const { error: linkError } = await supabase
                .schema('klantappversie1')
                .from('customer_accounts')
                .insert({
                  auth_user_id: authUserId,
                  member_id: memberId
                });

              if (linkError) {
                if (linkError.code === '23505' || linkError.message?.includes('duplicate')) {
                  console.log(`   ℹ️  Koppeling bestaat al`);
                } else {
                  console.log(`   ⚠️  Koppeling niet gemaakt: ${linkError.message}`);
                }
              } else {
                console.log(`   ✅ Koppeling gemaakt`);
              }
            } else {
              console.log(`   ✅ Koppeling gemaakt`);
            }
          } catch (err) {
            console.log(`   ⚠️  Koppeling niet gemaakt: ${err.message}`);
          }
        }

        // Sla account info op
        accounts.push({
          naam: memberName,
          email: memberEmail,
          wachtwoord: password,
          member_id: memberId || 'N/A',
          status: 'aangemaakt'
        });

        // Wacht even om rate limiting te voorkomen
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ ${memberName}: Onverwachte fout: ${error.message}`);
        skipped++;
      }
    }

    // Stap 5: Exporteer accounts naar Excel bestand
    console.log('\n4️⃣ Accounts exporteren naar Excel bestand...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const outputExcelPath = path.join(__dirname, `Nieuwe-Accounts-${timestamp}.xlsx`);

    // Maak Excel data array
    const excelData = [
      ['Klant Naam', 'Email', 'Wachtwoord', 'Member ID', 'Status'] // Header
    ];

    accounts.forEach(acc => {
      excelData.push([
        acc.naam,
        acc.email,
        acc.wachtwoord,
        acc.member_id,
        acc.status
      ]);
    });

    // Maak Excel workbook
    const outputWorksheet = XLSX.utils.aoa_to_sheet(excelData);
    
    // Pas kolombreedte aan
    outputWorksheet['!cols'] = [
      { wch: 30 }, // Klant Naam
      { wch: 35 }, // Email
      { wch: 12 }, // Wachtwoord
      { wch: 36 }, // Member ID
      { wch: 12 }  // Status
    ];

    const outputWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(outputWorkbook, outputWorksheet, 'Nieuwe Accounts');

    // Schrijf Excel bestand
    XLSX.writeFile(outputWorkbook, outputExcelPath);

    console.log(`✅ Excel bestand aangemaakt: ${outputExcelPath}`);

    // Samenvatting
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SAMENVATTING:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Nieuw aangemaakt: ${created}`);
    console.log(`⏭️  Overgeslagen: ${skipped}`);
    console.log(`📋 Totaal nieuwe accounts: ${accounts.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Onverwachte fout:', error);
    process.exit(1);
  }
}

// Run het script
createMissingAccountsFromExcel();

