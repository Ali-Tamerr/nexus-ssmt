import { NextRequest, NextResponse } from 'next/server';

/**
 * API route to exchange Google OAuth code for access token
 * This is used for Classroom access without replacing the main session
 */
export async function POST(request: NextRequest) {
  try {
    const { code, redirectUri } = await request.json();
    
    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
    }

    const clientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
    }

    // Exchange the authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.json({ error: 'Failed to exchange code for token' }, { status: 400 });
    }

    const tokens = await tokenResponse.json();
    
    // Return just the access token and expiry
    // We don't store this on the server - the client will store it in localStorage
    return NextResponse.json({
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
    });
  } catch (error) {
    console.error('Classroom token exchange error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
