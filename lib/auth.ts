export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('customer_api_key');
}

export function setApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('customer_api_key', apiKey);
}

export function removeApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('customer_api_key');
}

