'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase-client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true) // Standaard aan
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Laad opgeslagen email en wachtwoord bij mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rememberedEmail = localStorage.getItem('remembered_email')
      const rememberedPassword = localStorage.getItem('remembered_password')
      const shouldRemember = localStorage.getItem('remember_me') === 'true'
      
      if (rememberedEmail) {
        setEmail(rememberedEmail)
      }
      
      if (rememberedPassword && shouldRemember) {
        setPassword(rememberedPassword)
        setRememberMe(true)
      } else if (shouldRemember) {
        setRememberMe(true)
      }
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!supabaseClient) {
      setError('Supabase client niet geconfigureerd')
      setLoading(false)
      return
    }

    try {
      const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
        options: {
          // Als "onthouden" is aangevinkt, gebruik persistent session
          // Supabase slaat standaard al de session op in localStorage
          // We kunnen hier eventueel de session duration aanpassen
        }
      })

      if (signInError) {
        console.error('Sign in error:', signInError)
        throw signInError
      }

      if (data?.user) {
        console.log('Login successful, redirecting to /home')
        
        // Als "onthouden" is aangevinkt, sla email en wachtwoord op
        if (rememberMe && typeof window !== 'undefined') {
          localStorage.setItem('remembered_email', email)
          localStorage.setItem('remembered_password', password)
          localStorage.setItem('remember_me', 'true')
        } else if (typeof window !== 'undefined') {
          // Verwijder opgeslagen gegevens als "onthouden" is uitgezet
          localStorage.removeItem('remembered_email')
          localStorage.removeItem('remembered_password')
          localStorage.removeItem('remember_me')
        }
        
        // Wacht even zodat de session is opgeslagen
        await new Promise(resolve => setTimeout(resolve, 100))
        router.push('/home')
        router.refresh() // Force refresh om session te laden
      } else {
        throw new Error('Geen gebruiker data ontvangen')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Fout bij inloggen. Controleer je email en wachtwoord.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Vul eerst je email adres in')
      return
    }

    if (!supabaseClient) {
      setError('Supabase client niet geconfigureerd')
      return
    }

    setError('')
    setLoading(true)

    try {
      const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (resetError) throw resetError

      setError('')
      alert('Check je email voor een wachtwoord reset link!')
    } catch (err: any) {
      console.error('Reset password error:', err)
      setError(err.message || 'Fout bij versturen van reset link.')
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLinkLogin = async () => {
    if (!email) {
      setError('Vul eerst je email adres in')
      return
    }

    if (!supabaseClient) {
      setError('Supabase client niet geconfigureerd')
      return
    }

    setError('')
    setLoading(true)

    try {
      // Stuur OTP code naar email
      const { error: otpError } = await supabaseClient.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // Maak geen nieuwe gebruiker aan
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (otpError) throw otpError

      // Toon code input veld
      setShowCodeInput(true)
      setError('')
      // Geen alert meer, toon alleen het code veld
    } catch (err: any) {
      console.error('OTP error:', err)
      setError(err.message || 'Fout bij versturen van inlogcode. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!supabaseClient || !email || !code) {
      setError('Vul alle velden in')
      setLoading(false)
      return
    }

    try {
      // Verifieer de OTP code
      const { data, error: verifyError } = await supabaseClient.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      })

      if (verifyError) throw verifyError

      if (data?.user) {
        console.log('Login successful with code, redirecting to /home')
        
        // Als "onthouden" is aangevinkt, sla email op
        if (rememberMe && typeof window !== 'undefined') {
          localStorage.setItem('remembered_email', email)
          localStorage.setItem('remember_me', 'true')
        } else if (typeof window !== 'undefined') {
          localStorage.removeItem('remembered_email')
          localStorage.removeItem('remember_me')
        }
        
        // Wacht even zodat de session is opgeslagen
        await new Promise(resolve => setTimeout(resolve, 100))
        router.push('/home')
        router.refresh()
      } else {
        throw new Error('Geen gebruiker data ontvangen')
      }
    } catch (err: any) {
      console.error('Verify code error:', err)
      setError(err.message || 'Ongeldige code. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo en Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-md overflow-hidden">
            <img 
              src="/Logo.png" 
              alt="Manege Duikse Hoef Logo" 
              className="h-20 w-20 object-contain rounded-full"
            />
          </div>
          <h1 className="text-3xl font-bold text-black mb-2">Welkom</h1>
        </div>

        {/* Login Form Card */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          {/* Email Field */}
          <div className="mb-4">
            <label className="block text-black font-medium mb-2">E-mailadres</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jouw@email.nl"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Code Input Field - alleen zichtbaar na "Stuur login code" */}
          {showCodeInput && (
            <div className="mb-4">
              <label className="block text-black font-medium mb-2">Inlogcode</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center text-2xl tracking-widest font-mono"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                />
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Voer de 6-cijferige code in die we naar je email hebben gestuurd
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowCodeInput(false)
                  setCode('')
                }}
                className="text-sm text-primary mt-2 hover:underline w-full text-center"
              >
                Code opnieuw versturen
              </button>
            </div>
          )}

          {/* Password Field - verberg als code input zichtbaar is */}
          {!showCodeInput && (
            <div className="mb-4">
              <label className="block text-black font-medium mb-2">Wachtwoord</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="........"
                className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
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

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Remember Me Checkbox */}
          <div className="mb-4 flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 focus:ring-primary focus:ring-2"
              style={{ accentColor: '#e72d81' }}
            />
            <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700 cursor-pointer">
              Wachtwoord onthouden
            </label>
          </div>

          {/* Login Buttons */}
          {!showCodeInput ? (
            <div className="flex gap-3 mb-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Laden...' : 'Inloggen'}
              </button>
              <button
                type="button"
                onClick={handleMagicLinkLogin}
                disabled={loading || !email}
                className="flex-1 bg-white border-2 border-primary text-primary py-3 rounded-lg font-semibold hover:bg-pink-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verzenden...' : 'Stuur login code'}
              </button>
            </div>
          ) : (
            <div className="mb-4">
              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifiëren...' : 'Verifieer code'}
              </button>
            </div>
          )}

          {/* Forgot Password Link */}
          <button
            type="button"
            onClick={handleForgotPassword}
            className="w-full text-primary text-sm font-medium hover:underline"
          >
            Wachtwoord vergeten?
          </button>
        </form>
      </div>
    </div>
  )
}
