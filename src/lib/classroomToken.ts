/**
 * Utility functions for managing the separate Google Classroom access token
 * This token is stored in localStorage and is independent of the main session
 */

const STORAGE_KEY_TOKEN = 'classroom_access_token';
const STORAGE_KEY_EXPIRES = 'classroom_token_expires_at';

/**
 * Get the stored Classroom access token
 */
export function getClassroomToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  const expiresAt = localStorage.getItem(STORAGE_KEY_EXPIRES);
  
  if (!token || !expiresAt) return null;
  
  // Check if token is expired (with 5 minute buffer)
  const expiresAtMs = parseInt(expiresAt, 10);
  if (Date.now() > expiresAtMs - 5 * 60 * 1000) {
    // Token expired or about to expire, clear it
    clearClassroomToken();
    return null;
  }
  
  return token;
}

/**
 * Store the Classroom access token
 */
export function setClassroomToken(accessToken: string, expiresAt: number): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
  localStorage.setItem(STORAGE_KEY_EXPIRES, expiresAt.toString());
}

/**
 * Clear the stored Classroom token
 */
export function clearClassroomToken(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_EXPIRES);
}

/**
 * Check if a valid Classroom token exists
 */
export function hasValidClassroomToken(): boolean {
  return getClassroomToken() !== null;
}

/**
 * Get the Google OAuth URL for Classroom-only access
 */
export function getClassroomOAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/classroom-callback`;
  
  const scopes = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me',
    'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  ].join(' ');
  
  const params = new URLSearchParams({
    client_id: clientId || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
