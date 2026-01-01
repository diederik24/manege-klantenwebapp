'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase-client'
import BottomNav from '@/components/BottomNav'

export default function WachtwoordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)

  useEffect(() => {
    async function loadUser() {
      if (!supabaseClient) {
        router.push('/login')
        return
      }

      const { data: { session } } = await supabaseClient.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setEmail(session.user.email || '')
    }

    loadUser()
  }, [router])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!newPassword) {
      setError('Vul nieuw wachtwoord in')
      return
    }

    if (newPassword.length < 6) {
      setError('Nieuw wachtwoord moet minimaal 6 tekens lang zijn')
      return
    }

    if (!supabaseClient || !email) {
      setError('Supabase client niet geconfigureerd')
      return
    }

    setLoading(true)

    try {
      // Als code input wordt gebruikt, verifieer eerst de code
      if (showCodeInput && code) {
        const { data, error: verifyError } = await supabaseClient.auth.verifyOtp({
          email,
          token: code,
          type: 'email',
        })

        if (verifyError) {
          throw new Error('Ongeldige code')
        }

        if (!data?.user) {
          throw new Error('Verificatie mislukt')
        }
      } else if (!showCodeInput && currentPassword) {
        // Verifieer eerst het huidige wachtwoord
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
          email,
          password: currentPassword,
        })

        if (signInError) {
          throw new Error('Ongeldig huidig wachtwoord')
        }
      } else {
        throw new Error('Verifieer je identiteit met wachtwoord of code')
      }

      // Update naar nieuw wachtwoord
      const { error: updateError } = await supabaseClient.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      alert('Wachtwoord succesvol gewijzigd!')
      router.push('/profiel')
    } catch (err: any) {
      console.error('Change password error:', err)
      setError(err.message || 'Fout bij wijzigen van wachtwoord. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async () => {
    if (!email) {
      setError('Email adres niet gevonden')
      return
    }

    if (!supabaseClient) {
      setError('Supabase client niet geconfigureerd')
      return
    }

    setError('')
    setLoading(true)

    try {
      const { error: otpError } = await supabaseClient.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (otpError) throw otpError

      setShowCodeInput(true)
      setCodeSent(true)
      setCurrentPassword('') // Clear password field
      setError('')
    } catch (err: any) {
      console.error('OTP error:', err)
      setError(err.message || 'Fout bij versturen van code. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="bg-primary text-white px-4 pt-4 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/20 transition"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold flex-1">Wachtwoord wijzigen</h1>
        </div>
        <p className="text-white/80 text-sm">Voer je huidige en nieuwe wachtwoord in</p>
      </div>

      <div className="px-4 pt-8">
        <form onSubmit={handleChangePassword} className="bg-white rounded-2xl shadow-md p-6 space-y-4">
          {/* Huidig wachtwoord of Code */}
          {showCodeInput ? (
            <div>
              <label className="block text-black font-medium mb-2">8-cijferige code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="00000000"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center text-2xl tracking-widest font-mono"
                  required
                  maxLength={8}
                  pattern="[0-9]{8}"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Voer de 8-cijferige code in die we naar je email hebben gestuurd
              </p>
              {codeSent && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCodeInput(false)
                    setCode('')
                    setCodeSent(false)
                    setError('')
                  }}
                  className="text-sm text-primary mt-2 hover:underline w-full text-center"
                >
                  Gebruik wachtwoord in plaats van code
                </button>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-black font-medium mb-2">Huidig wachtwoord</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Huidig wachtwoord"
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required={!showCodeInput}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showCurrentPassword ? (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Nieuw wachtwoord */}
          <div>
            <label className="block text-black font-medium mb-2">Nieuw wachtwoord</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nieuw wachtwoord"
                className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showNewPassword ? (
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Minimaal 6 tekens</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Grote knop */}
          <button
            type="submit"
            disabled={loading || (!showCodeInput && !currentPassword) || (showCodeInput && !code) || !newPassword}
            className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Wijzigen...' : 'Wachtwoord wijzigen'}
          </button>

          {/* Uitleg tekst en code knop */}
          <p className="text-sm text-gray-600 text-center mt-4">
            Weet je je huidige wachtwoord niet meer? Je kunt altijd een 8-cijferige code naar je email laten sturen.
          </p>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={loading}
            className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed mt-3"
          >
            {loading ? 'Code versturen...' : 'Stuur code naar email'}
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  )
}

