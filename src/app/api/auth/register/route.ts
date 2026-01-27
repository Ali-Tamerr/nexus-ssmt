// app/api/auth/register/route.ts

import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import type { RegisterRequest, Profile } from '@/types/knowledge';

export async function POST(req: Request) {
  try {
    const body: RegisterRequest = await req.json();

    if (!body.email || !body.password || !body.displayName) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Call backend API to register user (sync with backend)
    const apiUrl = process.env.NEXT_PRIVATE_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || 'https://localhost:7007';
    const response = await fetch(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Email: body.email,
        Password: body.password,
        DisplayName: body.displayName,
        AvatarUrl: body.avatarUrl ?? null,
      }),
    });

    if (response.status === 409) {
      return NextResponse.json(
        { message: 'Email already exists' },
        { status: 409 }
      );
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: error.message || 'Failed to register user' },
        { status: response.status }
      );
    }

    const newUser: Profile = await response.json();

    // If Google OAuth, set provider field
    if (body.avatarUrl && newUser.provider !== 'google') {
      newUser.provider = 'google';
    }

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to register user' },
      { status: 500 }
    );
  }
}
