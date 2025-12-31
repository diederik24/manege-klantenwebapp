'use client'

import { useState, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'
import { getCustomerData } from '@/lib/api'
import { getApiKey } from '@/lib/auth'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      try {
        const apiKey = getApiKey()
        if (!apiKey) {
          router.push('/login')
          return
        }

        const data = await getCustomerData(apiKey)
        setCustomerData(data)
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
        <h1 className="text-3xl font-bold text-black">{customerData.customer.name} 🐴</h1>
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
        <Link href="/historie" className="flex-1 bg-white rounded-2xl p-4 shadow-md">
          <div className="w-12 h-12 bg-primary-light rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-black mb-1">Historie</h3>
          <p className="text-gray-600 text-sm">Bekijk je lessen</p>
        </Link>

        <Link href="/notificaties" className="flex-1 bg-white rounded-2xl p-4 shadow-md">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 className="font-bold text-black mb-1">Notificaties</h3>
          <p className="text-gray-600 text-sm">0 nieuwe</p>
        </Link>
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

      <BottomNav />
    </div>
  )
}
