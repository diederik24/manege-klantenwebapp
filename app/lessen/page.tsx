'use client'

import { useState, useMemo, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'
import { getCustomerData, cancelLesson, enrollLesson } from '@/lib/api'
import { getApiKey } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase-client'

// Helper function to get week dates
const getWeekDates = () => {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  
  const weekDates = []
  const dayNames = ['ZO', 'MA', 'DI', 'WO', 'DO', 'VR', 'ZA']
  const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const dayIndex = date.getDay()
    weekDates.push({
      day: dayNames[dayIndex],
      date: date.getDate(),
      month: monthNames[date.getMonth()],
      full: `${dayNames[dayIndex].toLowerCase()}dag ${date.getDate()} ${monthNames[date.getMonth()]}`,
      isToday: date.toDateString() === today.toDateString(),
      dateObj: date
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

interface Lesson {
  id: string
  name: string
  day: string
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
  const todayDate = useMemo(() => {
    const today = new Date()
    return today.getDate()
  }, [])
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const weekInfo = useMemo(() => getWeekInfo(weekDates), [weekDates])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
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
        // Gebruik Supabase Auth session token in plaats van API key
        // Voor nu tonen we een lege lijst - lessen kunnen later worden toegevoegd via Supabase
        const data = {
          lessons: [],
          leskaarten: [],
          customer: {
            name: 'Klant',
            email: session.user.email || '',
            balance: 0
          },
          totaalResterendeLessen: 0
        }
        
        // TODO: Haal lessen op via Supabase RPC of directe query
        // Voor nu tonen we een lege lijst zodat de pagina werkt zonder API key
        
        // Transform API lessons to our format
        const transformedLessons: Lesson[] = data.lessons.map((les: any) => ({
          id: les.id || les.name,
          name: les.name,
          day: les.day,
          time: les.time,
          instructor: les.instructor,
          date: les.date,
          location: les.location || 'Binnenbak',
          type: les.type || 'Groepsles',
          participants: les.participants || '0/0 deelnemers',
          enrolled: les.enrolled || false
        }))
        
        setLessons(transformedLessons)
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
  }, [router])

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

    setProcessing(lessonId)
    try {
      // TODO: Implementeer lessen aanmelden/afmelden via Supabase
      // Voor nu tonen we alleen een melding
      alert(isEnrolled ? 'Afmelden functionaliteit komt binnenkort' : 'Aanmelden functionaliteit komt binnenkort')
      
      // Refresh data zou hier moeten gebeuren
      // setLessons(transformedLessons)
    } catch (err: any) {
      alert(err.message || 'Er is een fout opgetreden')
    } finally {
      setProcessing(null)
    }
  }

  // Filter lessons for selected date
  const selectedDateObj = weekDates.find(d => d.date === selectedDate)?.dateObj
  const filteredLessons = selectedDateObj 
    ? lessons.filter(lesson => {
        try {
          const lessonDate = new Date(lesson.date)
          return lessonDate.toDateString() === selectedDateObj.toDateString()
        } catch {
          return false
        }
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

        {/* Date Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {weekDates.map((date) => {
            const isSelected = date.date === selectedDate
            return (
              <button
                key={`${date.date}-${date.month}`}
                onClick={() => setSelectedDate(date.date)}
                className={`flex-shrink-0 px-4 py-3 rounded-xl font-medium transition-all relative ${
                  isSelected
                    ? 'bg-white text-black'
                    : 'bg-primary-light text-white'
                }`}
              >
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

      {/* Main Content */}
      <div className="px-4 pt-4">
        <p className="text-gray-600 text-sm mb-4">
          {weekDates.find(d => d.date === selectedDate)?.full || ''}
        </p>

        {filteredLessons.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-md text-center text-gray-600">
            Geen lessen beschikbaar voor deze dag
          </div>
        ) : (
          filteredLessons.map((lesson) => {
            const timeParts = lesson.time?.split('-') || ['', '']
            const startTime = timeParts[0]?.trim() || ''
            const endTime = timeParts[1]?.trim() || ''
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
