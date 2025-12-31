'use client'

import { useState, useEffect } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabaseClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

interface Leskaart {
  id: string
  klant_id: string
  totaal_lessen: number
  gebruikte_lessen: number
  resterende_lessen: number
  start_datum: string
  eind_datum: string
  status: string
  created_at: string
  updated_at: string
}

interface LeskaartOverzicht {
  klant_id: string
  aantal_actieve_leskaarten: number
  totaal_resterende_lessen: number
  totaal_lessen: number
  totaal_gebruikte_lessen: number
  eerste_start_datum: string
  laatste_eind_datum: string
}

export default function LeskaartenPage() {
  const [leskaarten, setLeskaarten] = useState<Leskaart[]>([])
  const [overzicht, setOverzicht] = useState<LeskaartOverzicht | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      if (!supabaseClient) {
        setError('Supabase client niet geconfigureerd')
        setLoading(false)
        return
      }

      // Check of gebruiker is ingelogd
      const { data: { session } } = await supabaseClient.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)
      await fetchLeskaarten()
    }

    checkAuth()
  }, [])

  async function fetchLeskaarten() {
    if (!supabaseClient) return

    try {
      setLoading(true)
      setError(null)

      // Haal overzicht op via RPC functie
      const { data: overzichtData, error: overzichtError } = await supabaseClient
        .rpc('get_my_leskaart_overzicht')
        .single()

      if (!overzichtError && overzichtData && typeof overzichtData === 'object' && 'klant_id' in overzichtData) {
        setOverzicht(overzichtData as LeskaartOverzicht)
      }

      // Haal individuele leskaarten op via RPC functie
      const { data: leskaartenData, error: leskaartenError } = await supabaseClient
        .rpc('get_my_leskaarten')

      if (leskaartenError) {
        console.error('Error fetching leskaarten:', leskaartenError)
        setError(`Fout bij ophalen leskaarten: ${leskaartenError.message}`)
      } else {
        // Type guard voor leskaarten array
        if (Array.isArray(leskaartenData)) {
          setLeskaarten(leskaartenData as Leskaart[])
        } else {
          setLeskaarten([])
        }
      }
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Onbekende fout')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('nl-NL', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    } catch {
      return dateString
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
          <div className="text-gray-600 mb-4">{error}</div>
          {user && (
            <button
              onClick={fetchLeskaarten}
              className="px-4 py-2 bg-primary text-white rounded-lg"
            >
              Opnieuw proberen
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="px-4 pt-4 pb-6">
        <h1 className="text-3xl font-bold text-black">Mijn Leskaarten</h1>
        {user && (
          <p className="text-gray-600 text-sm mt-1">
            Ingelogd als: {user.email}
          </p>
        )}
      </div>

      {/* Overzicht Card */}
      {overzicht && (
        <div className="mx-4 mb-6 bg-primary rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-white font-bold text-lg">Totaal Overzicht</h2>
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-white text-3xl font-bold mb-2">
              {overzicht.totaal_resterende_lessen} / {overzicht.totaal_lessen} lessen
            </p>
            <div className="w-full bg-white/30 rounded-full h-3">
              <div 
                className="bg-white rounded-full h-3" 
                style={{ 
                  width: `${overzicht.totaal_lessen > 0 ? (overzicht.totaal_resterende_lessen / overzicht.totaal_lessen) * 100 : 0}%` 
                }}
              ></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-white text-sm">
            <div>
              <p className="opacity-80">Gebruikt</p>
              <p className="font-bold text-lg">{overzicht.totaal_gebruikte_lessen}</p>
            </div>
            <div>
              <p className="opacity-80">Actieve kaarten</p>
              <p className="font-bold text-lg">{overzicht.aantal_actieve_leskaarten}</p>
            </div>
          </div>
          {overzicht.laatste_eind_datum && (
            <p className="text-white text-sm mt-4">
              Geldig tot: {formatDate(overzicht.laatste_eind_datum)}
            </p>
          )}
        </div>
      )}

      {/* Individuele Leskaarten */}
      <div className="px-4 mb-4">
        <h2 className="text-2xl font-bold text-black mb-4">Leskaarten</h2>
        
        {leskaarten.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 shadow-md text-center text-gray-600">
            <p>Geen actieve leskaarten gevonden</p>
            <p className="text-sm mt-2">
              Zorg ervoor dat je account is gekoppeld aan een klant via de customer_accounts tabel.
            </p>
          </div>
        ) : (
          leskaarten.map((kaart) => {
            const percentage = kaart.totaal_lessen > 0 
              ? (kaart.resterende_lessen / kaart.totaal_lessen) * 100 
              : 0

            return (
              <div key={kaart.id} className="bg-white rounded-2xl p-6 shadow-md mb-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-black mb-1">Leskaart #{kaart.id.substring(0, 8)}</h3>
                    <p className="text-gray-600 text-sm">Status: {kaart.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {kaart.resterende_lessen}
                    </p>
                    <p className="text-gray-600 text-sm">resterend</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary rounded-full h-2" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Totaal</p>
                    <p className="font-bold text-black">{kaart.totaal_lessen}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Gebruikt</p>
                    <p className="font-bold text-black">{kaart.gebruikte_lessen}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Resterend</p>
                    <p className="font-bold text-primary">{kaart.resterende_lessen}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Start datum</p>
                    <p className="font-medium text-black">{formatDate(kaart.start_datum)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Eind datum</p>
                    <p className="font-medium text-black">{formatDate(kaart.eind_datum)}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && user && (
        <div className="mx-4 mb-4 p-4 bg-gray-100 rounded-lg text-xs">
          <p className="font-bold mb-2">Debug Info:</p>
          <p>User ID: {user.id}</p>
          <p>Email: {user.email}</p>
          <p>Aantal leskaarten: {leskaarten.length}</p>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

