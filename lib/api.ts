// API Configuration - Haalt data direct uit de database via Next.js API route
export async function getCustomerData(apiKey: string) {
  try {
    // Gebruik Next.js API route die direct uit Supabase database haalt
    const API_ENDPOINT = '/api/get-customer-data';
    
    const response = await fetch(API_ENDPOINT, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      let errorMessage = 'Failed to fetch customer data';
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } catch (e) {
        // If response is not JSON, get text
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    console.error('API Error:', error);
    if (error.message) {
      throw error;
    } else {
      throw new Error('Onbekende fout bij ophalen data');
    }
  }
}

export async function cancelLesson(apiKey: string, lessonId: string) {
  try {
    // Use Next.js API route as proxy to avoid CORS issues
    const API_ENDPOINT = '/api/cancel-lesson';
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lessonId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to cancel lesson');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

export async function enrollLesson(apiKey: string, lessonId: string) {
  try {
    // Use Next.js API route as proxy to avoid CORS issues
    const API_ENDPOINT = '/api/enroll-lesson';
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lessonId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to enroll in lesson');
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
