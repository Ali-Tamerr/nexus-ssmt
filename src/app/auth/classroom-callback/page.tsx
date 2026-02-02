'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ClassroomCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setStatus('error');
        setError(errorParam);
        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({ type: 'CLASSROOM_AUTH_ERROR', error: errorParam }, window.location.origin);
        }
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        return;
      }

      try {
        // Exchange the code for an access token
        const response = await fetch('/api/auth/classroom-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}/auth/classroom-callback`,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to get access token');
        }

        const { accessToken, expiresAt } = await response.json();

        // Store the token in localStorage
        localStorage.setItem('classroom_access_token', accessToken);
        localStorage.setItem('classroom_token_expires_at', expiresAt.toString());

        setStatus('success');

        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'CLASSROOM_AUTH_SUCCESS', 
            accessToken,
            expiresAt,
          }, window.location.origin);
          
          // Close the popup after a short delay
          setTimeout(() => window.close(), 1000);
        }
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'Authentication failed');
        
        if (window.opener) {
          window.opener.postMessage({ type: 'CLASSROOM_AUTH_ERROR', error: err.message }, window.location.origin);
        }
      }
    }

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-900">
      <div className="text-center p-8 bg-zinc-800 rounded-lg border border-zinc-700 max-w-md">
        {status === 'processing' && (
          <>
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-white">Connecting to Google Classroom...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-medium mb-2">Connected to Google Classroom!</p>
            <p className="text-zinc-400 text-sm">This window will close automatically...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-white font-medium mb-2">Connection Failed</p>
            <p className="text-red-400 text-sm">{error}</p>
            <button 
              onClick={() => window.close()} 
              className="mt-4 px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
