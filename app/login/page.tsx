'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setApiKey } from '@/lib/auth'
import { getCustomerData } from '@/lib/api'

export default function LoginPage() {
  const [apiKey, setApiKeyInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/43d83abe-87cf-49d2-9be1-d1ae6b8f86c9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/page.tsx:14',message:'handleLogin entry',data:{apiKeyLength:apiKey?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    try {
      // Test de API key door data op te halen
      await getCustomerData(apiKey)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/43d83abe-87cf-49d2-9be1-d1ae6b8f86c9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/page.tsx:22',message:'getCustomerData success',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Sla API key op
      setApiKey(apiKey)
      
      // Redirect naar home
      router.push('/home')
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/43d83abe-87cf-49d2-9be1-d1ae6b8f86c9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/login/page.tsx:28',message:'Login error',data:{errorName:err?.name,errorMessage:err?.message,errorStack:err?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,D'})}).catch(()=>{});
      // #endregion
      console.error('Login error:', err);
      // Show more detailed error message
      const errorMessage = err.message || 'Ongeldige API key. Controleer je key en probeer opnieuw.';
      setError(errorMessage);
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
          <p className="text-gray-600 text-sm">Log in met je API key</p>
        </div>
        
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg p-6">
          <div className="mb-4">
            <label className="block text-black font-medium mb-2">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Voer je API key in"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {error && (
            <div className="mb-4 text-red-500 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-dark transition disabled:opacity-50"
          >
            {loading ? 'Laden...' : 'Inloggen'}
          </button>
        </form>
      </div>
    </div>
  )
}

