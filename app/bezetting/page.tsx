'use client'

import { useState, useMemo, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabaseClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

// Helper function to get week dates (4 weeks = 28 days)
const getWeekDates = () => {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0)
  
  const weekDates = []
  const dayNames = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA']
  const dayNamesFull = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
  const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
  
  const jsToSupabaseDay = (jsDay: number) => jsDay === 0 ? 6 : jsDay - 1
  
  for (let i = 0; i < 28; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const dayIndex = date.getDay()
    const supabaseDayOfWeek = jsToSupabaseDay(dayIndex)
    const dateKey = date.toISOString().split('T')[0]
    weekDates.push({
      day: dayNames[dayIndex],
      date: date.getDate(),
      month: monthNames[date.getMonth()],
      full: `${dayNamesFull[dayIndex]} ${date.getDate()} ${monthNames[date.getMonth()]}`,
      isToday: date.toDateString() === today.toDateString(),
      dateObj: date,
      dateKey: dateKey,
      supabaseDayOfWeek: supabaseDayOfWeek
    })
  }
  
  return weekDates
}

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

const formatTime = (time: string): string => {
  if (!time) return ''
  return time.split(':').slice(0, 2).join(':')
}

interface Lesson {
  id: string
  name: string
  dayOfWeek: number
  time: string
  instructor: string
  type?: string
  maxParticipants: number
  currentParticipants: number
  duration?: number
}

export default function BezettingPage() {
  const weekDates = useMemo(() => getWeekDates(), [])
  const todayDateKey = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today.toISOString().split('T')[0]
  }, [])
  const [selectedDate, setSelectedDate] = useState(todayDateKey)
  const weekInfo = useMemo(() => getWeekInfo(weekDates), [weekDates])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      if (!supabaseClient) {
        router.push('/login')
        return
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      const { data: { session } } = await supabaseClient.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      try {
        // Haal alle recurring lessons op (niet alleen van ingelogde gebruiker)
        const { data: lessonsData, error: lessonsError } = await supabaseClient
          .from('recurring_lessons')
          .select('*')
          .order('day_of_week', { ascending: true })
          .order('time', { ascending: true })

        if (lessonsError) {
          console.error('Error fetching lessons:', lessonsError)
          setError(lessonsError.message || 'Fout bij ophalen lessen')
          setLoading(false)
          return
        }

        // Haal aantal deelnemers op per les
        const lessonIds = (lessonsData || []).map((l: any) => l.id)
        let participantsCountMap: Record<string, number> = {}

        if (lessonIds.length > 0) {
          const { data: allParticipants, error: countError } = await supabaseClient
            .from('lesson_participants')
            .select('recurring_lesson_id')
            .in('recurring_lesson_id', lessonIds)

          if (!countError && allParticipants) {
            allParticipants.forEach((p: any) => {
              participantsCountMap[p.recurring_lesson_id] = (participantsCountMap[p.recurring_lesson_id] || 0) + 1
            })
          }
        }

        // Format lessons
        const transformedLessons: Lesson[] = (lessonsData || []).map((lesson: any) => ({
          id: lesson.id,
          name: lesson.name || 'Onbenoemde les',
          dayOfWeek: lesson.day_of_week ?? 0,
          time: lesson.time || '',
          instructor: lesson.instructor || '',
          type: lesson.type || 'Groepsles',
          maxParticipants: lesson.max_participants || 0,
          currentParticipants: participantsCountMap[lesson.id] || 0,
          duration: lesson.duration || 60
        }))
        
        setLessons(transformedLessons)
      } catch (err: any) {
        setError(err.message || 'Fout bij ophalen data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const selectedWeekDate = weekDates.find(d => d.dateKey === selectedDate)
  const filteredLessons = selectedWeekDate 
    ? lessons.filter(lesson => lesson.dayOfWeek === selectedWeekDate.supabaseDayOfWeek)
    : lessons

  // Sorteer lessen op tijd
  const sortedLessons = [...filteredLessons].sort((a, b) => {
    const timeA = a.time || '00:00'
    const timeB = b.time || '00:00'
    return timeA.localeCompare(timeB)
  })

  const getLessonColor = (type?: string) => {
    switch (type) {
      case 'Groepsles':
        return 'bg-blue-500'
      case 'Dressuur':
        return 'bg-teal-500'
      case 'Springles':
        return 'bg-orange-500'
      case 'Priveles':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  const calculateEndTime = (startTime: string, duration: number = 60): string => {
    if (!startTime) return ''
    const [hours, minutes] = startTime.split(':')
    const endDate = new Date()
    endDate.setHours(parseInt(hours) || 0, parseInt(minutes) || 0, 0, 0)
    endDate.setMinutes(endDate.getMinutes() + duration)
    return `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`
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
      {/* Header */}
      <div className="bg-primary text-white px-4 pt-4 pb-6 rounded-b-3xl">
        <h1 className="text-3xl font-bold mb-2">Bezetting</h1>
        <p className="text-primary-light text-sm mb-4">{weekInfo}</p>

        {/* Date Selector */}
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

        {sortedLessons.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-md text-center text-gray-600">
            Geen lessen op deze dag - de bak is vrij
          </div>
        ) : (
          sortedLessons.map((lesson) => {
            const startTime = formatTime(lesson.time || '')
            const endTime = calculateEndTime(lesson.time || '', lesson.duration)
            
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
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        lesson.currentParticipants >= lesson.maxParticipants
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {lesson.currentParticipants}/{lesson.maxParticipants}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      {lesson.instructor && (
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{lesson.instructor}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-gray-600 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Binnenbak</span>
                      </div>
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
                          <span>{lesson.type}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <BottomNav />
    </div>
  )
}
