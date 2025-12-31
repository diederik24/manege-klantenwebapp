import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_MANEGE_API_URL || 'https://manegesystem.vercel.app'

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key')
    const body = await request.json()
    const { lessonId } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 }
      )
    }

    const API_ENDPOINT = `${API_BASE_URL}/api/enroll-lesson`

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lessonId })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json(
        { error: error.error || 'Failed to enroll in lesson' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

