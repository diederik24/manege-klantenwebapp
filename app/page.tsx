'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getApiKey } from '@/lib/auth'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const apiKey = getApiKey()
    if (apiKey) {
      router.push('/home')
    } else {
      router.push('/login')
    }
  }, [router])

  return null
}
