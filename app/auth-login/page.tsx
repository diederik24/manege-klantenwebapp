'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase-client'

export default function AuthLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!supabaseClient) {
      setError('Supabase client niet geconfigureerd')
      setLoading(false)
      return
    }

    try {
      if (isSignUp) {
        // Sign up
        const { data, error: signUpError } = await supabaseClient.auth.signUp({
          email,
          password,
        })

        if (signUpError) throw signUpError

        if (data.user) {
          setError('Account aangemaakt! Check je email voor verificatie, of log direct in.')
          setIsSignUp(false)
        }
      } else {
        // Sign in
        const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) throw signInError

        if (data.user) {
          // Redirect naar leskaarten pagina
          router.push('/leskaarten')
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err)
      setError(err.message || 'Fout bij inloggen')
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
          <p className="text-gray-600 text-sm">
            {isSignUp ? 'Maak een account aan' : 'Log in met je account'}
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="bg-white rounded-2xl shadow-lg p-6">
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

          {error && (
            <div className={`mb-4 text-sm p-3 rounded-lg ${
              error.includes('aangemaakt') || error.includes('verificatie')
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-dark transition disabled:opacity-50 mb-4"
          >
            {loading ? 'Laden...' : isSignUp ? 'Account aanmaken' : 'Inloggen'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            className="w-full text-primary text-sm font-medium"
          >
            {isSignUp 
              ? 'Al een account? Log in' 
              : 'Nog geen account? Maak er een aan'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-yellow-50 rounded-lg text-xs text-yellow-800">
          <p className="font-bold mb-1">Let op:</p>
          <p>Na het aanmaken van een account moet je account worden gekoppeld aan een klant via de database.</p>
          <p className="mt-2">
            Gebruik: <code className="bg-yellow-100 px-1 rounded">klantappversie1.link_customer_account()</code>
          </p>
        </div>
      </div>
    </div>
  )
}

