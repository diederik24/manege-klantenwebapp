import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper functie om API key te valideren en member_id op te halen
async function validateApiKeyAndGetMemberId(
  apiKey: string
): Promise<{ isValid: boolean; memberId?: string }> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('member_id, is_active, expires_at')
    .eq('api_key', apiKey)
    .single();

  if (error || !data) {
    return { isValid: false };
  }

  // Check of key actief is
  if (!data.is_active) {
    return { isValid: false };
  }

  // Check of key niet verlopen is
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { isValid: false };
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('api_key', apiKey);

  return { isValid: true, memberId: data.member_id };
}

export async function GET(request: NextRequest) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }

  try {
    // Check Supabase configuratie
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceRoleKey || !supabase) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { 
          error: 'Server configuration error - Supabase credentials missing',
          code: 'MISSING_ENV_VARS'
        },
        { status: 500, headers }
      );
    }

    // Get API key from header
    const apiKey = request.headers.get('x-api-key');
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'API key required',
          code: 'MISSING_API_KEY'
        },
        { status: 401, headers }
      );
    }

    // Validate API key en haal member_id op
    const { isValid, memberId } = await validateApiKeyAndGetMemberId(apiKey);
    
    if (!isValid || !memberId) {
      return NextResponse.json(
        { 
          error: 'Invalid or expired API key',
          code: 'INVALID_API_KEY'
        },
        { status: 401, headers }
      );
    }

    // Fetch customer data
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('id, name, email, phone, status, balance, klant_type, adres, postcode, plaats, factuur_adres, factuur_postcode, factuur_plaats, factuur_email')
      .eq('id', memberId)
      .single();

    if (memberError || !memberData) {
      return NextResponse.json(
        { 
          error: 'Customer not found',
          code: 'CUSTOMER_NOT_FOUND'
        },
        { status: 404, headers }
      );
    }

    // Haal eerst gezinsleden IDs op
    const { data: familyMembersForQuery } = await supabase
      .from('family_members')
      .select('id')
      .eq('member_id', memberId)
      .eq('status', 'Actief');

    const familyMemberIds = (familyMembersForQuery || []).map(fm => fm.id);

    // Fetch lessons voor deze klant (zowel direct als via gezinsleden)
    let lessonParticipantsQuery = supabase
      .from('lesson_participants')
      .select(`
        recurring_lesson_id,
        member_id,
        family_member_id,
        recurring_lessons:recurring_lesson_id (
          id,
          name,
          day_of_week,
          time,
          type,
          instructor,
          color,
          description,
          max_participants
        ),
        family_members:family_member_id (
          id,
          name
        )
      `)
      .eq('member_id', memberId);

    // Als er gezinsleden zijn, voeg die ook toe
    if (familyMemberIds.length > 0) {
      lessonParticipantsQuery = supabase
        .from('lesson_participants')
        .select(`
          recurring_lesson_id,
          member_id,
          family_member_id,
          recurring_lessons:recurring_lesson_id (
            id,
            name,
            day_of_week,
            time,
            type,
            instructor,
            color,
            description,
            max_participants
          ),
          family_members:family_member_id (
            id,
            name
          )
        `)
        .or(`member_id.eq.${memberId},family_member_id.in.(${familyMemberIds.join(',')})`);
    }

    const { data: lessonParticipants, error: participantsError } = await lessonParticipantsQuery;

    if (participantsError) {
      console.error('Error fetching lessons:', participantsError);
    }

    // Fetch leskaarten
    const { data: leskaartenData, error: leskaartenError } = await supabase
      .from('leskaarten')
      .select('id, totaal_lessen, gebruikte_lessen, resterende_lessen, start_datum, eind_datum, status, created_at, updated_at')
      .eq('klant_id', memberId)
      .order('created_at', { ascending: false });

    if (leskaartenError) {
      console.error('Error fetching leskaarten:', leskaartenError);
    }

    // Fetch gezinsleden
    const { data: familyMembersData, error: familyError } = await supabase
      .from('family_members')
      .select('id, name, geboortedatum, email, telefoon, status')
      .eq('member_id', memberId)
      .eq('status', 'Actief');

    if (familyError) {
      console.error('Error fetching family members:', familyError);
    }

    // Fetch openstaande transacties
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, date, description, amount, type, status')
      .eq('member_id', memberId)
      .eq('status', 'Open')
      .order('date', { ascending: false });

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
    }

    // Format lessons response
    const days = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
    
    const lessons = (lessonParticipants || []).map((lp: any) => {
      const lesson = lp.recurring_lessons;
      if (!lesson) return null;
      
      return {
        id: lesson.id,
        name: lesson.name,
        day: days[lesson.day_of_week] || 'Onbekend',
        dayOfWeek: lesson.day_of_week,
        time: lesson.time ? lesson.time.substring(0, 5) : null,
        type: lesson.type,
        instructor: lesson.instructor,
        color: lesson.color,
        description: lesson.description,
        maxParticipants: lesson.max_participants,
        isFamilyMember: !!lp.family_member_id,
        familyMemberName: lp.family_members?.name || null
      };
    }).filter(Boolean);

    // Format leskaarten response
    const leskaarten = (leskaartenData || []).map((lk: any) => ({
      id: lk.id,
      totaalLessen: lk.totaal_lessen,
      gebruikteLessen: lk.gebruikte_lessen,
      resterendeLessen: lk.resterende_lessen,
      startDatum: lk.start_datum,
      eindDatum: lk.eind_datum,
      status: lk.status,
      created_at: lk.created_at,
      updated_at: lk.updated_at
    }));

    // Format gezinsleden response
    const familyMembers = (familyMembersData || []).map((fm: any) => ({
      id: fm.id,
      name: fm.name,
      geboortedatum: fm.geboortedatum,
      email: fm.email,
      telefoon: fm.telefoon,
      status: fm.status
    }));

    // Format transacties response
    const transactions = (transactionsData || []).map((t: any) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amount: parseFloat(t.amount) || 0,
      type: t.type,
      status: t.status
    }));

    // Calculate totaal resterende lessen over alle leskaarten
    const totaalResterendeLessen = leskaarten.reduce((sum: number, lk: any) => {
      return sum + (lk.resterendeLessen || 0);
    }, 0);

    return NextResponse.json({
      success: true,
      customer: {
        id: memberData.id,
        name: memberData.name,
        email: memberData.email,
        phone: memberData.phone,
        status: memberData.status,
        balance: parseFloat(memberData.balance) || 0,
        klantType: memberData.klant_type,
        adres: memberData.adres,
        postcode: memberData.postcode,
        plaats: memberData.plaats,
        factuurAdres: memberData.factuur_adres,
        factuurPostcode: memberData.factuur_postcode,
        factuurPlaats: memberData.factuur_plaats,
        factuurEmail: memberData.factuur_email
      },
      lessons: lessons,
      leskaarten: leskaarten,
      totaalResterendeLessen: totaalResterendeLessen,
      familyMembers: familyMembers,
      openstaandeTransacties: transactions,
      saldo: parseFloat(memberData.balance) || 0
    }, { headers });

  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: error.message
      },
      { status: 500, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      } }
    );
  }
}
