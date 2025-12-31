'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase-client'

type LoginMethod = 'password' | 'magiclink'

export default function LoginPage() {
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
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
      })

      if (signInError) throw signInError

      if (data.user) {
        // Redirect naar home
        router.push('/home')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Fout bij inloggen. Controleer je email en wachtwoord.')
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (!supabaseClient) {
      setError('Supabase client niet geconfigureerd')
      setLoading(false)
      return
    }

    try {
      const { error: magicLinkError } = await supabaseClient.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (magicLinkError) throw magicLinkError

      setSuccess('Check je email! We hebben een inloglink gestuurd naar ' + email)
      setEmail('')
    } catch (err: any) {
      console.error('Magic link error:', err)
      setError(err.message || 'Fout bij versturen van inloglink. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-3xl font-bold text-black mb-2">Manege Duikse Hoef</h1>
          <p className="text-gray-600 text-sm">Log in met je account</p>
        </div>
        
        {/* Login Method Toggle */}
        <div className="mb-6 bg-gray-100 rounded-lg p-1 flex">
          <button
            type="button"
            onClick={() => {
              setLoginMethod('password')
              setError('')
              setSuccess('')
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
              loginMethod === 'password'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Email & Wachtwoord
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMethod('magiclink')
              setError('')
              setSuccess('')
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
              loginMethod === 'magiclink'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Eenmalige Mailcode
          </button>
        </div>

        <form 
          onSubmit={loginMethod === 'password' ? handlePasswordLogin : handleMagicLinkLogin} 
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <div className="mb-4">
            <label className="block text-black font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jouw@email.nl"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {loginMethod === 'password' && (
            <div className="mb-4">
              <label className="block text-black font-medium mb-2">Wachtwoord</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
                minLength={6}
              />
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 text-red-700 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 text-green-700 text-sm p-3 rounded-lg">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-dark transition disabled:opacity-50 mb-4"
          >
            {loading 
              ? 'Laden...' 
              : loginMethod === 'password' 
                ? 'Inloggen' 
                : 'Stuur inloglink'}
          </button>

          {loginMethod === 'password' && (
            <button
              type="button"
              onClick={() => {
                setLoginMethod('magiclink')
                setError('')
                setSuccess('')
              }}
              className="w-full text-primary text-sm font-medium"
            >
              Inloggen met eenmalige mailcode
            </button>
          )}

          {loginMethod === 'magiclink' && (
            <div className="text-center text-sm text-gray-600">
              <p>We sturen je een veilige inloglink naar je email.</p>
              <p className="mt-2">Klik op de link in de email om in te loggen.</p>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

