'use client'

import { useState, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'
import { supabaseClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

interface LeskaartOverzicht {
  klant_id: string
  aantal_actieve_leskaarten: number
  totaal_resterende_lessen: number
  totaal_lessen: number
  totaal_gebruikte_lessen: number
  eerste_start_datum: string | null
  laatste_eind_datum: string | null
}

function isLeskaartOverzicht(data: any): data is LeskaartOverzicht {
  return data && typeof data === 'object' && 'klant_id' in data
}

interface CustomerNameData {
  member_id: string
  name: string
  email: string
}

interface CustomerData {
  customer: {
    name: string
    email: string
    balance: number
  }
  lessons: Array<{
    id: string
    name: string
    day: string
    time: string
    instructor: string
    date: string
  }>
  leskaarten: Array<{
    id: string
    resterendeLessen: number
    totaalLessen: number
    eindDatum: string
  }>
  totaalResterendeLessen: number
}

interface TodayLessonParticipant {
  lessonId: string
  lessonName: string
  lessonTime: string
  participants: Array<{
    memberName?: string
    familyMemberName?: string
    hoofdklantName?: string
  }>
  cancellations: Array<{
    memberName?: string
    familyMemberName?: string
    hoofdklantName?: string
  }>
}

export default function HomePage() {
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [todayLessonsWithParticipants, setTodayLessonsWithParticipants] = useState<TodayLessonParticipant[]>([])
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      if (!supabaseClient) {
        setError('Supabase client niet geconfigureerd')
        setLoading(false)
        return
      }

      try {
        // Check of gebruiker is ingelogd
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession()
        
        if (sessionError || !session) {
          router.push('/login')
          return
        }

        // Check of gebruiker admin is
        const userRole = session.user.user_metadata?.role
        const isAdminUser = userRole === 'admin'
        setIsAdmin(isAdminUser)

        // Haal ALTIJD eerst de klantnaam op uit members tabel (stambestand)
        // Probeer verschillende methoden om member_id te vinden
        // Voor admin: gebruik "Patricia", voor normale gebruikers: probeer naam op te halen, anders "Klant"
        let customerName = isAdminUser ? 'Patricia' : 'Klant'
        let memberId = null
        
        // Voor admin: skip naam ophalen, gebruik "Patricia"
        // Voor normale gebruikers: probeer naam op te halen uit database
        if (!isAdminUser) {
          try {
            // Methode 1: Probeer via get_my_customer_name RPC (direct naam + member_id)
            const { data: customerData, error: customerError } = await supabaseClient
              .rpc('get_my_customer_name')
              .maybeSingle()
            
            const typedCustomerData = customerData as CustomerNameData | null
            if (!customerError && typedCustomerData && typedCustomerData.name) {
              customerName = typedCustomerData.name
              memberId = typedCustomerData.member_id
              console.log('Klantnaam opgehaald via get_my_customer_name:', customerName)
            } else {
              // Methode 2: Probeer via get_my_leskaart_overzicht (geeft klant_id terug)
              console.log('get_my_customer_name gaf geen resultaat, probeer get_my_leskaart_overzicht')
              const { data: overzichtData, error: overzichtError } = await supabaseClient
                .rpc('get_my_leskaart_overzicht')
                .maybeSingle()
              
              const typedOverzichtData = overzichtData as LeskaartOverzicht | null
              if (!overzichtError && typedOverzichtData && typedOverzichtData.klant_id) {
                memberId = typedOverzichtData.klant_id
                console.log('Member ID gevonden via get_my_leskaart_overzicht:', memberId)
                
                // Haal klantnaam op uit members tabel
                const { data: memberData, error: memberError } = await supabaseClient
                  .from('members')
                  .select('name, email')
                  .eq('id', memberId)
                  .single()
                
                if (!memberError && memberData?.name) {
                  customerName = memberData.name
                  console.log('Klantnaam opgehaald uit members tabel:', customerName)
                } else {
                  console.error('Fout bij ophalen member data uit stambestand:', memberError)
                }
              } else {
                console.error('Fout bij ophalen klant_id via get_my_leskaart_overzicht:', overzichtError)
              }
            }
          } catch (nameError) {
            console.error('Fout bij ophalen klantnaam:', nameError)
          }
        } else {
          // Admin: gebruik "Patricia" en skip het ophalen van member data
          console.log('Admin account: gebruik naam "Patricia"')
        }

        // Haal leskaarten op - probeer eerst via RPC, anders direct via member_id
        let leskaarten: Array<{
          id: string
          resterendeLessen: number
          totaalLessen: number
          eindDatum: string
        }> = []
        let totaalResterendeLessen = 0
        let overzichtData: any = null

        // Probeer eerst via RPC functie
        const { data: overzichtDataRPC, error: overzichtError } = await supabaseClient
          .rpc('get_my_leskaart_overzicht')
          .maybeSingle() // maybeSingle() geeft null terug in plaats van error als er geen data is
        
        if (!overzichtError && isLeskaartOverzicht(overzichtDataRPC)) {
          overzichtData = overzichtDataRPC
          totaalResterendeLessen = overzichtData.totaal_resterende_lessen || 0
          
          // Haal leskaarten op via RPC
          const { data: leskaartenData, error: leskaartenError } = await supabaseClient
            .rpc('get_my_leskaarten')

          if (!leskaartenError && Array.isArray(leskaartenData)) {
            leskaarten = leskaartenData.map((k: any) => ({
              id: k.id,
              resterendeLessen: k.resterende_lessen || 0,
              totaalLessen: k.totaal_lessen || 0,
              eindDatum: k.eind_datum || ''
            }))
          }
        } else if (memberId) {
          // Fallback: haal leskaarten direct op via member_id
          console.log('RPC functie gaf geen data, haal leskaarten direct op via member_id:', memberId)
          const { data: directLeskaarten, error: directError } = await supabaseClient
            .from('leskaarten')
            .select('id, totaal_lessen, gebruikte_lessen, resterende_lessen, eind_datum, status')
            .eq('klant_id', memberId)
            .eq('status', 'actief')
          
          if (!directError && Array.isArray(directLeskaarten)) {
            console.log('Direct leskaarten gevonden:', directLeskaarten.length)
            leskaarten = directLeskaarten.map((k: any) => ({
              id: k.id,
              resterendeLessen: k.resterende_lessen || 0,
              totaalLessen: k.totaal_lessen || 0,
              eindDatum: k.eind_datum || ''
            }))
            
            totaalResterendeLessen = leskaarten.reduce((sum, k) => sum + k.resterendeLessen, 0)
          } else {
            console.error('Fout bij direct ophalen leskaarten:', directError)
          }
        } else {
          console.log('Geen member_id beschikbaar, kan leskaarten niet ophalen')
        }

        console.log('Setting customer data with name:', customerName, 'leskaarten:', leskaarten.length)
        setCustomerData({
          customer: {
            name: customerName,
            email: session.user.email || '',
            balance: 0
          },
          lessons: [], // TODO: Haal lessen op als die beschikbaar zijn
          leskaarten: leskaarten,
          totaalResterendeLessen: totaalResterendeLessen
        })
      } catch (err: any) {
        console.error('Error fetching data:', err)
        setError(err.message || 'Fout bij ophalen data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  // Voor admin: haal lessen van vandaag op met deelnemers
  useEffect(() => {
    async function fetchTodayLessonsForAdmin() {
      if (!isAdmin || !supabaseClient) return

      try {
        // Bepaal vandaag (YYYY-MM-DD)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayDateKey = today.toISOString().split('T')[0]
        
        // Bepaal de dag van de week voor vandaag (0 = Maandag, 6 = Zondag)
        // JavaScript getDay(): 0 = Zondag, 1 = Maandag, ..., 6 = Zaterdag
        // Supabase day_of_week: 0 = Maandag, 6 = Zondag
        const todayDayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1
        
        console.log('Fetching lessons for today:', todayDateKey, 'day of week:', todayDayOfWeek)

        // Haal EERST alle lessen op die vandaag plaatsvinden (op basis van day_of_week)
        const { data: todayLessonsData, error: lessonsError } = await supabaseClient
          .from('recurring_lessons')
          .select('id, name, time, instructor')
          .eq('day_of_week', todayDayOfWeek)

        if (lessonsError) {
          console.error('Error fetching today lessons:', lessonsError)
          return
        }

        if (!todayLessonsData || todayLessonsData.length === 0) {
          console.log('No lessons scheduled for today')
          setTodayLessonsWithParticipants([])
          return
        }

        console.log('Lessons scheduled for today:', todayLessonsData.length)

        // Haal alle afmeldingen op voor vandaag
        const { data: cancellationsData, error: cancellationsError } = await supabaseClient
          .from('lesson_cancellations')
          .select(`
            recurring_lesson_id,
            member_id,
            family_member_id,
            members:member_id (
              id,
              name
            ),
            family_members:family_member_id (
              id,
              name,
              member_id
            )
          `)
          .eq('les_datum', todayDateKey)

        if (cancellationsError) {
          console.error('Error fetching cancellations:', cancellationsError)
          return
        }

        console.log('Cancellations found for today:', cancellationsData?.length || 0)

        // Haal alle members op voor hoofdklant namen
        const { data: allMembersData } = await supabaseClient
          .from('members')
          .select('id, name')

        const membersMap = new Map((allMembersData || []).map((m: any) => [m.id, m.name]))

        // Maak een map van cancellations per les
        const cancellationsByLesson = new Map<string, Array<{ memberName?: string; familyMemberName?: string; hoofdklantName?: string }>>()
        
        // Verwerk alle afmeldingen en groepeer per les
        if (cancellationsData && cancellationsData.length > 0) {
          cancellationsData.forEach((c: any) => {
            const lessonId = c.recurring_lesson_id
            if (!lessonId) {
              console.warn('Cancellation without lesson_id:', c)
              return
            }

            if (!cancellationsByLesson.has(lessonId)) {
              cancellationsByLesson.set(lessonId, [])
            }

            const cancellations = cancellationsByLesson.get(lessonId)!
            
            // Check of het een gezinslid is of een normale member
            const familyMember = Array.isArray(c.family_members) ? c.family_members[0] : c.family_members
            const member = Array.isArray(c.members) ? c.members[0] : c.members

            if (c.family_member_id && familyMember) {
              const hoofdklantName = membersMap.get(familyMember.member_id) || ''
              cancellations.push({
                familyMemberName: familyMember.name || '',
                hoofdklantName: hoofdklantName
              })
            } else if (c.member_id && member) {
              cancellations.push({
                memberName: member.name || ''
              })
            } else {
              // Fallback: gebruik alleen ID als naam niet beschikbaar is
              console.warn('Cancellation without name data:', c)
              if (c.member_id) {
                cancellations.push({
                  memberName: `Klant ID: ${c.member_id.substring(0, 8)}...`
                })
              }
            }
          })
        }

        const formatTime = (time: string) => {
          if (!time) return ''
          return time.split(':').slice(0, 2).join(':')
        }

        // Combineer alle lessen van vandaag met hun afmeldingen
        // Gebruik alle lessen die vandaag gepland staan, niet alleen die met afmeldingen
        const todayLessons: TodayLessonParticipant[] = todayLessonsData
          .map((lesson: any) => {
            return {
              lessonId: lesson.id,
              lessonName: lesson.name || 'Onbekende les',
              lessonTime: formatTime(lesson.time || ''),
              participants: [],
              cancellations: cancellationsByLesson.get(lesson.id) || []
            }
          })
          .filter(lesson => lesson.cancellations.length > 0) // Alleen lessen met afmeldingen tonen
          .sort((a, b) => {
            // Sorteer op tijd
            if (!a.lessonTime) return 1
            if (!b.lessonTime) return -1
            return a.lessonTime.localeCompare(b.lessonTime)
          })

        console.log('Final todayLessons with cancellations:', todayLessons.length, todayLessons.map(l => ({ name: l.lessonName, time: l.lessonTime, cancellations: l.cancellations.length })))
        setTodayLessonsWithParticipants(todayLessons)
      } catch (err: any) {
        console.error('Error fetching today lessons for admin:', err)
      }
    }

    if (isAdmin) {
      fetchTodayLessonsForAdmin()
    }
  }, [isAdmin, supabaseClient])

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20 flex items-center justify-center">
        <div className="text-center">
          <div className="text-primary text-xl font-bold">Laden...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white pb-20 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-red-500 text-xl font-bold mb-2">Fout</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    )
  }

  if (!customerData) return null

  // Bereken totaal lessen en resterend
  const totaalLessen = customerData.leskaarten.reduce((sum, kaart) => sum + kaart.totaalLessen, 0)
  const resterend = customerData.totaalResterendeLessen
  const percentage = totaalLessen > 0 ? (resterend / totaalLessen) * 100 : 0

  // Komende lessen (volgende 2)
  const komendeLessen = customerData.lessons
    .filter(les => {
      try {
        return new Date(les.date) >= new Date()
      } catch {
        return true
      }
    })
    .sort((a, b) => {
      try {
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      } catch {
        return 0
      }
    })
    .slice(0, 2)

  // Format lesson time helper
  const formatLessonTime = (lesson: typeof komendeLessen[0]) => {
    if (lesson.day && lesson.time) {
      return `${lesson.day} • ${lesson.time}`
    }
    try {
      const date = new Date(lesson.date)
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      
      if (date.toDateString() === today.toDateString()) {
        return `Vandaag • ${lesson.time || ''}`
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return `Morgen • ${lesson.time || ''}`
      } else {
        return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) + (lesson.time ? ` • ${lesson.time}` : '')
      }
    } catch {
      return lesson.time || ''
    }
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Welcome Section */}
      <div className="px-4 pt-6 pb-6">
        <p className="text-gray-600 text-sm mb-1">Welkom terug,</p>
        <h1 className="text-3xl font-bold text-black">{customerData.customer.name}</h1>
      </div>

      {/* Lesson Card - alleen voor normale gebruikers, niet voor admin */}
      {!isAdmin && (
        <div className="mx-4 mb-6 bg-primary rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-white font-bold text-lg">Jouw Leskaart</h2>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-white text-3xl font-bold mb-2">{resterend} / {totaalLessen} lessen</p>
            <div className="w-full bg-white/30 rounded-full h-3">
              <div className="bg-white rounded-full h-3" style={{ width: `${percentage}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* History and Notifications - alleen voor normale gebruikers, niet voor admin */}
      {!isAdmin && (
        <div className="px-4 mb-6 flex gap-4">
          <div className="flex-1 bg-white rounded-2xl p-4 shadow-md relative overflow-hidden">
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/95 backdrop-blur-sm z-10 pointer-events-none">
              <span className="text-primary font-bold text-sm">In ontwikkeling</span>
            </div>
            <div className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-bold text-black mb-1">Lessen</h3>
            <p className="text-gray-600 text-sm">Bekijk je lessen</p>
          </div>

          <button
            onClick={() => setShowNotificationsPopup(true)}
            className="flex-1 bg-white rounded-2xl p-4 shadow-md text-left"
          >
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="font-bold text-black mb-1">Notificaties</h3>
            <p className="text-gray-600 text-sm">0 nieuwe</p>
          </button>
        </div>
      )}

      {/* Upcoming Lessons of Afmeldingen van vandaag (voor admin) */}
      <div className="px-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-black">{isAdmin ? 'Afmeldingen van vandaag' : 'Komende Lessen'}</h2>
          {!isAdmin && (
            <Link href="/lessen" className="text-primary text-sm font-medium">
              Bekijk alles
            </Link>
          )}
        </div>

        {isAdmin ? (
          // Admin: toon alleen lessen met afmeldingen vandaag
          todayLessonsWithParticipants.length === 0 ? (
            <div className="bg-white rounded-2xl p-4 shadow-md text-center text-gray-600">
              Geen afmeldingen vandaag
            </div>
          ) : (
            todayLessonsWithParticipants.map((lesson) => (
              <div key={lesson.lessonId} className="bg-white rounded-2xl p-4 shadow-md mb-3">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-black mb-1">{lesson.lessonName}</h3>
                    <p className="text-gray-600 text-sm mb-3">{lesson.lessonTime}</p>
                    {lesson.cancellations.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-700 mb-2">Heeft afgemeld ({lesson.cancellations.length}):</p>
                        <div className="space-y-1">
                          {lesson.cancellations.map((cancellation, idx) => (
                            <p key={idx} className="text-sm text-gray-700">
                              {cancellation.familyMemberName 
                                ? `${cancellation.familyMemberName} (${cancellation.hoofdklantName})`
                                : cancellation.memberName}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          // Normale gebruikers: toon komende lessen
          komendeLessen.length === 0 ? (
            <div className="bg-white rounded-2xl p-4 shadow-md text-center text-gray-600">
              Geen komende lessen
            </div>
          ) : (
            komendeLessen.map((les) => (
              <Link key={les.id} href={`/lessen/${les.id}`} className="block bg-white rounded-2xl p-4 shadow-md mb-3">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-black mb-1">{les.name}</h3>
                    <p className="text-gray-600 text-sm mb-1">{formatLessonTime(les)}</p>
                    <p className="text-gray-600 text-sm">{les.instructor}</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))
          )
        )}
      </div>

      {/* Notificaties Popup */}
      {showNotificationsPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowNotificationsPopup(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Kleurrijke header */}
            <div className="bg-gradient-to-r from-primary to-pink-600 -m-6 mb-4 p-6 pb-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Notificaties</h2>
                <button
                  onClick={() => setShowNotificationsPopup(false)}
                  className="text-white/80 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-gray-700 text-center text-lg font-medium">Geen notificaties op dit moment</p>
              <p className="text-gray-500 text-center text-sm mt-2">Je ontvangt hier meldingen over je lessen en updates</p>
            </div>

            <button
              onClick={() => setShowNotificationsPopup(false)}
              className="w-full bg-gradient-to-r from-primary to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-primary-dark hover:to-pink-700 transition shadow-md mt-4"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
