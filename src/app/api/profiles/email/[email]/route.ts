// app/api/profiles/email/[email]/route.ts

import { NextResponse, NextRequest } from 'next/server';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await context.params;
    const apiUrl = process.env.NEXT_PRIVATE_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || 'https://localhost:7007';
    const response = await fetch(`${apiUrl}/api/profiles/email/${encodeURIComponent(email)}`);

    if (response.status === 404) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      );
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: error.message || 'Failed to fetch profile' },
        { status: response.status }
      );
    }

    const user = await response.json();
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
