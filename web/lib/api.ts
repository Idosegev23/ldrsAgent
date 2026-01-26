/**
 * API Client with Supabase Auth
 * All API calls go directly to /api/* (no external proxy)
 */

import { supabase } from './supabase';

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  console.log('[API Client] Getting auth headers:', { 
    hasSession: !!session, 
    hasToken: !!session?.access_token,
    error: error?.message 
  });
  
  if (session?.access_token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    };
  }
  
  console.warn('[API Client] No session found - request will fail with 401');
  
  return {
    'Content-Type': 'application/json',
  };
}

export async function apiGet<T = any>(endpoint: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(endpoint, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

export async function apiPost<T = any>(endpoint: string, data?: any): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

export async function apiPut<T = any>(endpoint: string, data?: any): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

export async function apiDelete<T = any>(endpoint: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}
