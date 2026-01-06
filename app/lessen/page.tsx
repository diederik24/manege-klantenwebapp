'use client'

import { useState, useMemo, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'
import { getCustomerData, cancelLesson, enrollLesson } from '@/lib/api'
import { getApiKey } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase-client'

// Helper function to get week dates (4 weeks = 28 days)
const getWeekDates = () => {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0) // Reset time to start of day
  
  const weekDates = []
  const dayNames = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA']
  const dayNamesFull = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
  const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
  
  // Supabase day_of_week: 0 = Monday, 1 = Tuesday, 2 = Wednesday, etc.
  // JavaScript getDay(): 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, etc.
  // Convert JS day to Supabase day_of_week: Sunday (0) -> 6, Monday (1) -> 0, Tuesday (2) -> 1, Wednesday (3) -> 2, etc.
  const jsToSupabaseDay = (jsDay: number) => jsDay === 0 ? 6 : jsDay - 1
  
  // Generate 4 weeks (28 days)
  for (let i = 0; i < 28; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const dayIndex = date.getDay() // JavaScript: 0=Sunday, 1=Monday, etc.
    const supabaseDayOfWeek = jsToSupabaseDay(dayIndex) // Convert to Supabase format
    const dateKey = date.toISOString().split('T')[0] // Unique date key (YYYY-MM-DD)
    weekDates.push({
      day: dayNames[dayIndex],
      date: date.getDate(),
      month: monthNames[date.getMonth()],
      full: `${dayNamesFull[dayIndex]} ${date.getDate()} ${monthNames[date.getMonth()]}`,
      isToday: date.toDateString() === today.toDateString(),
      dateObj: date,
      dateKey: dateKey, // Unique identifier for the date
      supabaseDayOfWeek: supabaseDayOfWeek // Store Supabase day_of_week for easy filtering
    })
  }
  
  return weekDates
}

// Helper function to get week info
const getWeekInfo = (dates: any[]) => {
  if (dates.length === 0) return ''
  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]
  
  if (firstDate.month === lastDate.month) {
    return `${firstDate.date}-${lastDate.date} ${firstDate.month}`
  } else {
    return `${firstDate.date} ${firstDate.month} - ${lastDate.date} ${lastDate.month}`
  }
}

// Helper function to format time from "HH:MM:SS" to "HH:MM"
const formatTime = (time: string): string => {
  if (!time) return ''
  // Remove seconds if present (format: HH:MM:SS -> HH:MM)
  return time.split(':').slice(0, 2).join(':')
}

interface Lesson {
  id: string
  name: string
  day: string
  dayOfWeek: number // 0 = Maandag, 1 = Dinsdag, etc. (Supabase format)
  time: string
  instructor: string
  date: string
  location?: string
  type?: string
  participants?: string
  enrolled?: boolean
}

export default function LessenPage() {
  const weekDates = useMemo(() => getWeekDates(), [])
  const todayDateKey = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today.toISOString().split('T')[0] // YYYY-MM-DD format
  }, [])
  const [selectedDate, setSelectedDate] = useState(todayDateKey)
  const weekInfo = useMemo(() => getWeekInfo(weekDates), [weekDates])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelLessonId, setCancelLessonId] = useState<string | null>(null)
  const [cancellations, setCancellations] = useState<Record<string, { afgemeld_op: string, les_datum: string }>>({})
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      // Check Supabase Auth eerst
      if (!supabaseClient) {
        router.push('/login')
        return
      }

      // Wacht even zodat de sessie kan worden geladen
      await new Promise(resolve => setTimeout(resolve, 100))

      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession()
      
      if (sessionError) {
        console.error('Session error:', sessionError)
      }
      
      if (!session) {
        console.log('No session found, redirecting to login')
        router.push('/login')
        return
      }

      console.log('Session found:', session.user.email)

      try {
        // Haal member_id op via klantappversie1.get_current_member_id() RPC
        // Of gebruik direct de view/function
        // Voor nu gebruiken we een workaround: haal member_id op via een RPC call
        const { data: memberIdData, error: memberIdError } = await supabaseClient
          .rpc('get_my_leskaart_overzicht')
          .single()

        let memberId: string | null = null
        
        if (memberIdData && typeof memberIdData === 'object' && 'klant_id' in memberIdData) {
          const klantId = (memberIdData as { klant_id: string }).klant_id
          if (typeof klantId === 'string') {
            memberId = klantId
          }
        }

        if (!memberId) {
          console.log('No member_id found for user')
          setLessons([])
          setLoading(false)
          return
        }

        // Haal lessen op via lesson_participants
        const { data: lessonParticipants, error: participantsError } = await supabaseClient
          .from('lesson_participants')
          .select(`
            recurring_lesson_id,
            recurring_lessons:recurring_lesson_id (
              id,
              name,
              day_of_week,
              time,
              type,
              instructor,
              max_participants
            )
          `)
          .eq('member_id', memberId)

        if (participantsError) {
          console.error('Error fetching lessons:', participantsError)
        }

        // Haal voor elke les het aantal deelnemers op
        const lessonIds = (lessonParticipants || [])
          .filter((lp: any) => lp.recurring_lessons)
          .map((lp: any) => lp.recurring_lessons.id)

        let participantsCountMap: Record<string, number> = {}
        if (lessonIds.length > 0) {
          const { data: allParticipants, error: countError } = await supabaseClient
            .from('lesson_participants')
            .select('recurring_lesson_id')
            .in('recurring_lesson_id', lessonIds)

          if (!countError && allParticipants) {
            // Tel deelnemers per les
            allParticipants.forEach((p: any) => {
              participantsCountMap[p.recurring_lesson_id] = (participantsCountMap[p.recurring_lesson_id] || 0) + 1
            })
          }
        }

        // Format lessons
        const days = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
        const transformedLessons: Lesson[] = (lessonParticipants || [])
          .filter((lp: any) => lp.recurring_lessons)
          .map((lp: any) => {
            const lesson = lp.recurring_lessons
            const participantCount = participantsCountMap[lesson.id] || 0
            const maxParticipants = lesson.max_participants || 0
            console.log(`Lesson: ${lesson.name}, day_of_week: ${lesson.day_of_week}, day: ${days[lesson.day_of_week]}`)
            return {
              id: lesson.id,
              name: lesson.name,
              day: days[lesson.day_of_week] || 'Onbekend',
              dayOfWeek: lesson.day_of_week, // 0 = Maandag in Supabase
              time: lesson.time || '',
              instructor: lesson.instructor || '',
              date: new Date().toISOString(), // Placeholder
              location: 'Binnenbak',
              type: lesson.type || 'Groepsles',
              participants: `${participantCount}/${maxParticipants} deelnemers`,
              enrolled: true
            }
          })
        
        console.log(`Total lessons loaded: ${transformedLessons.length}`)
        setLessons(transformedLessons)

        // Haal afmeldingen op voor deze gebruiker
        const { data: cancellationsData, error: cancellationsError } = await supabaseClient
          .from('lesson_cancellations')
          .select('recurring_lesson_id, les_datum, afgemeld_op')
          .eq('member_id', memberId)

        if (!cancellationsError && cancellationsData) {
          // Maak een map van les ID + datum -> afmelding info
          const cancellationsMap: Record<string, { afgemeld_op: string, les_datum: string }> = {}
          cancellationsData.forEach((cancel: any) => {
            const key = `${cancel.recurring_lesson_id}-${cancel.les_datum}`
            cancellationsMap[key] = {
              afgemeld_op: cancel.afgemeld_op || cancel.created_at,
              les_datum: cancel.les_datum
            }
          })
          setCancellations(cancellationsMap)
        }
      } catch (err: any) {
        if (err.message.includes('API key') || err.message.includes('Invalid')) {
          router.push('/login')
        } else {
          setError(err.message || 'Fout bij ophalen data')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router, selectedDate])

  const handleLessonAction = async (lessonId: string, isEnrolled: boolean) => {
    if (!supabaseClient) {
      alert('Supabase client niet beschikbaar')
      return
    }

    // Check session
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    if (isEnrolled) {
      // Toon bevestigingspopup voor afmelden
      setCancelLessonId(lessonId)
      setShowCancelConfirm(true)
      return
    }

    // Aanmelden - direct uitvoeren
    setProcessing(lessonId)
    try {
      // Haal member_id op
      const { data: memberIdData } = await supabaseClient
        .rpc('get_my_leskaart_overzicht')
        .single()

      let memberId: string | null = null
      if (memberIdData && typeof memberIdData === 'object' && 'klant_id' in memberIdData) {
        const klantId = (memberIdData as { klant_id: string }).klant_id
        if (typeof klantId === 'string') {
          memberId = klantId
        }
      }

      if (!memberId) {
        alert('Kon klant ID niet vinden')
        return
      }

      // Aanmelden
      const { error: enrollError } = await supabaseClient
        .from('lesson_participants')
        .insert({
          member_id: memberId,
          recurring_lesson_id: lessonId
        })

      if (enrollError) {
        // Als al ingeschreven, negeer de error
        if (!enrollError.message.includes('duplicate') && !enrollError.code?.includes('23505')) {
          throw new Error(enrollError.message || 'Fout bij aanmelden')
        }
      }

      alert('Je bent succesvol aangemeld voor deze les')
      
      // Refresh data
      window.location.reload()
    } catch (err: any) {
      console.error('Error:', err)
      alert(err.message || 'Er is een fout opgetreden')
    } finally {
      setProcessing(null)
    }
  }

  const handleConfirmCancel = async () => {
    if (!cancelLessonId || !supabaseClient) {
      return
    }

    setProcessing(cancelLessonId)
    try {
      // Haal member_id op
      const { data: memberIdData } = await supabaseClient
        .rpc('get_my_leskaart_overzicht')
        .single()

      let memberId: string | null = null
      if (memberIdData && typeof memberIdData === 'object' && 'klant_id' in memberIdData) {
        const klantId = (memberIdData as { klant_id: string }).klant_id
        if (typeof klantId === 'string') {
          memberId = klantId
        }
      }

      if (!memberId) {
        alert('Kon klant ID niet vinden')
        return
      }

      // Haal les informatie op
      const { data: lessonData } = await supabaseClient
        .from('recurring_lessons')
        .select('*')
        .eq('id', cancelLessonId)
        .single()

      if (!lessonData) {
        alert('Les niet gevonden')
        return
      }

      // Afmelden
      const selectedWeekDate = weekDates.find(d => d.dateKey === selectedDate)
      if (!selectedWeekDate) {
        alert('Selecteer eerst een datum')
        return
      }

      // Bereken de les datum op basis van de geselecteerde datum en day_of_week
      const lesDatum = selectedWeekDate.dateKey
      const lesTijd = formatTime(lessonData.time || '14:00')

      // Sla afmelding op in lesson_cancellations tabel
      const { error: cancelError } = await supabaseClient
        .from('lesson_cancellations')
        .insert({
          member_id: memberId,
          recurring_lesson_id: cancelLessonId,
          les_datum: lesDatum,
          les_tijd: lesTijd,
          opmerking: 'Afgemeld via app',
          afgemeld_op: new Date().toISOString()
        })

      if (cancelError) {
        console.error('Error saving cancellation:', cancelError)
        // Als tabel niet bestaat, probeer dan alleen de participant te verwijderen
        // Verwijder participant uit lesson_participants
        const { error: deleteError } = await supabaseClient
          .from('lesson_participants')
          .delete()
          .eq('member_id', memberId)
          .eq('recurring_lesson_id', cancelLessonId)

        if (deleteError) {
          throw new Error(deleteError.message || 'Fout bij afmelden')
        }
      }

      // Sluit popup
      setShowCancelConfirm(false)
      setCancelLessonId(null)
      
      alert('Je bent succesvol afgemeld voor deze les')
      
      // Refresh data
      window.location.reload()
    } catch (err: any) {
      console.error('Error:', err)
      alert(err.message || 'Er is een fout opgetreden')
    } finally {
      setProcessing(null)
    }
  }

  // Filter lessons for selected date based on day_of_week
  const selectedWeekDate = weekDates.find(d => d.dateKey === selectedDate)
  const filteredLessons = selectedWeekDate 
    ? lessons.filter(lesson => {
        // Use the supabaseDayOfWeek we stored in weekDates
        const match = lesson.dayOfWeek === selectedWeekDate.supabaseDayOfWeek
        console.log(`Filtering: Selected ${selectedWeekDate.full} (Supabase day: ${selectedWeekDate.supabaseDayOfWeek}), Lesson "${lesson.name}" dayOfWeek: ${lesson.dayOfWeek}, Match: ${match}`)
        return match
      })
    : lessons

  // Get color for lesson type
  const getLessonColor = (type?: string) => {
    switch (type) {
      case 'Groepsles':
        return 'bg-primary'
      case 'Dressuur':
        return 'bg-purple-500'
      case 'Springles':
        return 'bg-orange-500'
      default:
        return 'bg-primary'
    }
  }

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

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header with Pink Background */}
      <div className="bg-primary text-white px-4 pt-4 pb-6 rounded-b-3xl">
        <h1 className="text-3xl font-bold mb-4">{weekInfo}</h1>

        {/* Date Selector - Always show 7 days, scrollable for more weeks */}
        <div className="relative">
          <div 
            className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
            style={{ 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {weekDates.map((date) => {
              const isSelected = date.dateKey === selectedDate
              // Check of er lessen zijn voor deze dag
              const hasLessons = lessons.some(lesson => lesson.dayOfWeek === date.supabaseDayOfWeek)
              return (
                <button
                  key={date.dateKey}
                  onClick={() => setSelectedDate(date.dateKey)}
                  className={`flex-shrink-0 px-4 py-3 rounded-xl font-medium transition-all relative snap-start ${
                    isSelected
                      ? 'bg-white text-black'
                      : 'bg-primary-light text-white'
                  }`}
                  style={{ minWidth: '70px' }}
                >
                  {/* Groene bovenkant als er lessen zijn */}
                  {hasLessons && (
                    <div className="absolute top-1 left-2 right-2 h-0.5 bg-green-500 rounded-full"></div>
                  )}
                <div className="text-center">
                  <div className={`text-xs ${isSelected ? 'text-black' : 'text-white'}`}>{date.day}</div>
                  <div className={`text-lg font-bold ${isSelected ? 'text-black' : 'text-white'}`}>{date.date}</div>
                  {date.isToday && (
                    <div className="w-2 h-2 bg-green-500 rounded-full mx-auto mt-1.5"></div>
                  )}
                  {isSelected && !date.isToday && (
                    <div className="w-2 h-2 bg-primary rounded-full mx-auto mt-1.5"></div>
                  )}
                </div>
              </button>
            )
          })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pt-4">
        <p className="text-gray-600 text-sm mb-4">
          {weekDates.find(d => d.dateKey === selectedDate)?.full || ''}
        </p>

        {filteredLessons.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-md text-center text-gray-600">
            Geen lessen beschikbaar voor deze dag
          </div>
        ) : (
          filteredLessons.map((lesson) => {
            const timeParts = lesson.time?.split('-') || ['', '']
            const startTime = formatTime(timeParts[0]?.trim() || '')
            const endTime = formatTime(timeParts[1]?.trim() || '')
            const isEnrolled = lesson.enrolled || false
            
            return (
              <div key={lesson.id} className="mb-4 bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="flex">
                  {/* Time Column */}
                  <div className="flex flex-col items-center p-4">
                    <span className="font-bold text-black text-lg">{startTime}</span>
                    <span className="text-gray-500 text-sm">{endTime}</span>
                    <div className={`w-1 h-full ${getLessonColor(lesson.type)} mt-2`}></div>
                  </div>

                  {/* Lesson Details */}
                  <div className="flex-1 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-black text-lg">{lesson.name}</h3>
                      {isEnrolled && (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                          Ingeschreven
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>
                          {selectedWeekDate ? (() => {
                            const date = selectedWeekDate.dateObj
                            const day = String(date.getDate()).padStart(2, '0')
                            const month = String(date.getMonth() + 1).padStart(2, '0')
                            const year = String(date.getFullYear()).slice(-2)
                            return `${day}-${month}-${year}`
                          })() : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>{lesson.instructor}</span>
                      </div>
                      {lesson.location && (
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>{lesson.location}</span>
                        </div>
                      )}
                      {lesson.type && (
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          {lesson.type === 'Groepsles' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          ) : lesson.type === 'Dressuur' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                          )}
                          <span>{lesson.type} {lesson.participants ? `• ${lesson.participants}` : ''}</span>
                        </div>
                      )}
                    </div>

                    {(() => {
                      // Check of er een afmelding is voor deze les op de geselecteerde datum
                      const selectedWeekDate = weekDates.find(d => d.dateKey === selectedDate)
                      const cancellationKey = selectedWeekDate ? `${lesson.id}-${selectedWeekDate.dateKey}` : null
                      const cancellation = cancellationKey ? cancellations[cancellationKey] : null
                      const isCancelled = !!cancellation

                      if (isCancelled && isEnrolled) {
                        // Toon afmeld informatie
                        const afgemeldDate = new Date(cancellation.afgemeld_op)
                        const formattedDate = afgemeldDate.toLocaleDateString('nl-NL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })
                        const formattedTime = afgemeldDate.toLocaleTimeString('nl-NL', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })

                        return (
                          <div className="w-full py-3 px-4 rounded-lg bg-red-50 border-2 border-red-300">
                            <div className="text-center">
                              <div className="text-sm font-semibold text-red-700 mb-1">Afgemeld</div>
                              <div className="text-xs text-red-600">
                                {formattedDate} om {formattedTime}
                              </div>
                            </div>
                          </div>
                        )
                      }

                      // Normale knop voor aanmelden/afmelden
                      return (
                        <button
                          onClick={() => handleLessonAction(lesson.id, isEnrolled)}
                          disabled={processing === lesson.id}
                          className={`w-full py-3 rounded-lg font-semibold transition-all focus:outline-none active:scale-95 disabled:opacity-50 ${
                            isEnrolled
                              ? 'bg-white text-primary border-2 border-primary hover:scale-[1.01] active:bg-white'
                              : 'bg-primary text-white hover:bg-primary-dark hover:scale-[1.01] shadow-md active:bg-primary-dark'
                          }`}
                        >
                          {processing === lesson.id ? 'Laden...' : isEnrolled ? 'Afmelden' : 'Aanmelden'}
                        </button>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => {
          setShowCancelConfirm(false)
          setCancelLessonId(null)
        }}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-black">Bevestig afmelding</h2>
              <button
                onClick={() => {
                  setShowCancelConfirm(false)
                  setCancelLessonId(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Weet je zeker dat je je wilt afmelden voor deze les?
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelConfirm(false)
                  setCancelLessonId(null)
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={processing !== null}
                className="flex-1 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Afmelden...' : 'Bevestig afmelding'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
