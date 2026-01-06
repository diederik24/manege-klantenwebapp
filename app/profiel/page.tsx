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

export default function ProfielPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [customerName, setCustomerName] = useState<string>('')
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false)

  useEffect(() => {
    async function checkAuth() {
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
      setUser(session.user)

      // Haal klantnaam op uit members tabel (stambestand) via RPC
      try {
        // Methode 1: Probeer via get_my_customer_name RPC (direct naam uit stambestand)
        const { data: customerData, error: customerError } = await supabaseClient
          .rpc('get_my_customer_name')
          .maybeSingle()
        
        const typedCustomerData = customerData as CustomerNameData | null
        if (!customerError && typedCustomerData && typedCustomerData.name) {
          setCustomerName(typedCustomerData.name)
          console.log('Klantnaam opgehaald via get_my_customer_name:', typedCustomerData.name)
        } else {
          // Methode 2: Fallback via get_my_leskaart_overzicht
          console.log('get_my_customer_name gaf geen resultaat, probeer get_my_leskaart_overzicht')
          const { data: overzichtData, error: overzichtError } = await supabaseClient
            .rpc('get_my_leskaart_overzicht')
            .maybeSingle()
          
          const typedOverzichtData = overzichtData as LeskaartOverzicht | null
          if (!overzichtError && typedOverzichtData && typedOverzichtData.klant_id) {
            const { data: memberData, error: memberError } = await supabaseClient
              .from('members')
              .select('name')
              .eq('id', typedOverzichtData.klant_id)
              .single()
            
            if (!memberError && memberData?.name) {
              setCustomerName(memberData.name)
              console.log('Klantnaam opgehaald uit members tabel:', memberData.name)
            } else {
              // Fallback naar email prefix als naam niet gevonden wordt
              setCustomerName(session.user.email?.split('@')[0] || 'Gebruiker')
            }
          } else {
            // Fallback naar email prefix als geen account koppeling
            setCustomerName(session.user.email?.split('@')[0] || 'Gebruiker')
          }
        }
      } catch (err) {
        console.error('Error fetching customer name:', err)
        // Fallback naar email prefix bij error
        setCustomerName(session.user.email?.split('@')[0] || 'Gebruiker')
      }

      setLoading(false)
    }

    checkAuth()
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
  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="px-4 pt-4 pb-6">
        <h1 className="text-3xl font-bold text-black">Profiel</h1>
      </div>

      {/* Profile Card */}
      <div 
        className="mx-4 mb-6 rounded-2xl p-6 shadow-lg relative overflow-hidden"
        style={{
          backgroundImage: 'url(/hero-banner.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Gradient overlay for readability */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(231, 45, 129, 0.75) 0%, rgba(194, 24, 91, 0.7) 50%, rgba(90, 15, 46, 0.8) 100%)',
          }}
        />
        
        {/* Content */}
        <div className="flex flex-col items-center relative z-10">
          <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg">
            <span className="text-white text-4xl font-bold">
              {customerName ? customerName.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'G')}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mb-1 drop-shadow-sm">
            {customerName || user?.email?.split('@')[0] || 'Gebruiker'}
          </h2>
          <p className="text-white text-sm drop-shadow-sm font-medium">{user?.email || 'Geen email'}</p>
        </div>
      </div>

      {/* Settings Section */}
      <div className="px-4 mb-6">
        <h3 className="text-lg font-bold text-black mb-4">Instellingen</h3>
        <div className="space-y-1">
          <button
            onClick={() => setShowNotificationsPopup(true)}
            className="flex items-center justify-between bg-white rounded-xl p-4 shadow-md w-full text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <span className="text-black font-medium">Notificaties</span>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <Link
            href="/wachtwoord"
            className="flex items-center justify-between bg-white rounded-xl p-4 shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-black font-medium">Wachtwoord wijzigen</span>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <Link
            href="/help"
            className="flex items-center justify-between bg-white rounded-xl p-4 shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-black font-medium">Help & Support</span>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Contact Details Section */}
      <div className="px-4">
        <h3 className="text-lg font-bold text-black mb-4">Contactgegevens</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-md">
            <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-black">info@manegeduiksehoef.nl</span>
          </div>

          <div className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-md">
            <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span className="text-black">+31 620685310</span>
          </div>

          <button
            onClick={async () => {
              if (!supabaseClient) return
              
              try {
                await supabaseClient.auth.signOut()
                // Verwijder opgeslagen gegevens
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('remembered_email')
                  localStorage.removeItem('remembered_password')
                  localStorage.removeItem('remember_me')
                }
                router.push('/login')
                router.refresh()
              } catch (error) {
                console.error('Error signing out:', error)
              }
            }}
            className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-md w-full text-left hover:bg-gray-50 transition"
          >
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="text-black font-medium">Uitloggen</span>
          </button>
        </div>
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



