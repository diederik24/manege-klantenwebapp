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

export default function HomePage() {
  const [customerData, setCustomerData] = useState<CustomerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false)
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

        // Haal leskaart overzicht op via RPC
        const { data: overzichtData, error: overzichtError } = await supabaseClient
          .rpc('get_my_leskaart_overzicht')
          .single()

        if (overzichtError || !isLeskaartOverzicht(overzichtData)) {
          console.error('Error fetching leskaart overzicht:', overzichtError)
          // Als er geen leskaarten zijn, toon lege data
          setCustomerData({
            customer: {
              name: 'Klant',
              email: session.user.email || '',
              balance: 0
            },
            lessons: [],
            leskaarten: [],
            totaalResterendeLessen: 0
          })
          setLoading(false)
          return
        }

        // Haal leskaarten op
        const { data: leskaartenData, error: leskaartenError } = await supabaseClient
          .rpc('get_my_leskaarten')

        const leskaarten = Array.isArray(leskaartenData) 
          ? leskaartenData.map((k: any) => ({
              id: k.id,
              resterendeLessen: k.resterende_lessen || 0,
              totaalLessen: k.totaal_lessen || 0,
              eindDatum: k.eind_datum || ''
            }))
          : []

        // Haal klant naam op (via member_id uit overzicht)
        let customerName = 'Klant'
        if (overzichtData.klant_id) {
          const { data: memberData } = await supabaseClient
            .from('members')
            .select('name, email')
            .eq('id', overzichtData.klant_id)
            .single()
          
          if (memberData) {
            customerName = memberData.name
          }
        }

        setCustomerData({
          customer: {
            name: customerName,
            email: session.user.email || '',
            balance: 0
          },
          lessons: [], // TODO: Haal lessen op als die beschikbaar zijn
          leskaarten: leskaarten,
          totaalResterendeLessen: overzichtData.totaal_resterende_lessen || 0
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
  const eersteLeskaart = customerData.leskaarten[0]
  const eindDatum = eersteLeskaart?.eindDatum || 'Onbekend'

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      return dateString
    }
  }

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

      {/* Lesson Card */}
      <div className="mx-4 mb-6 bg-primary rounded-2xl p-6 shadow-lg">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-white font-bold text-lg">Jouw Leskaart</h2>
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
        </div>
        <div className="mb-4">
          <p className="text-white text-3xl font-bold mb-2">{resterend} / {totaalLessen} lessen</p>
          <div className="w-full bg-white/30 rounded-full h-3">
            <div className="bg-white rounded-full h-3" style={{ width: `${percentage}%` }}></div>
          </div>
        </div>
        <p className="text-white text-sm">Geldig tot: {formatDate(eindDatum)}</p>
      </div>

      {/* History and Notifications */}
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

      {/* Upcoming Lessons */}
      <div className="px-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-black">Komende Lessen</h2>
          <Link href="/lessen" className="text-primary text-sm font-medium">
            Bekijk alles
          </Link>
        </div>

        {komendeLessen.length === 0 ? (
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
