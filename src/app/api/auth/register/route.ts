// app/api/auth/register/route.ts

import { NextResponse } from "next/server";
import { api } from "@/lib/api";
import type { RegisterRequest, Profile } from "@/types/knowledge";

export async function POST(req: Request) {
  try {
    const body: any = await req.json();

    const email = body.email || body.Email;
    const password = body.password || body.Password;
    const displayName = body.displayName || body.DisplayName;
    const avatarUrl = body.avatarUrl || body.AvatarUrl;
    const provider = body.provider || body.Provider;

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
      );
    }

    // Call backend API to register user (sync with backend)
    const apiUrl =
      process.env.NEXT_PRIVATE_API_URL?.trim() ||
      process.env.NEXT_PUBLIC_API_URL?.trim() ||
      "https://localhost:7007";

    console.log("Registration route: Attempting to register user", {
      email,
      provider,
      apiUrl,
    });

    const response = await fetch(`${apiUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Email: email,
        Password: password,
        DisplayName: displayName,
        AvatarUrl: avatarUrl ?? null,
        Provider: provider,
      }),
    });

    if (response.status === 409) {
      console.log("Registration route: User already exists");
      return NextResponse.json(
        { message: "Email already exists" },
        { status: 409 },
      );
    }

    if (!response.ok) {
      const error = await response.text();
      console.error("Registration route: Backend registration failed:", {
        status: response.status,
        error,
        url: `${apiUrl}/api/auth/register`,
      });
      return NextResponse.json(
        { message: `Failed to connect to Supabase Auth service` },
        { status: response.status },
      );
    }

    const newUser: Profile = await response.json();

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Registration route: Unexpected error:", error);
    return NextResponse.json(
      { message: "Failed to register user" },
      { status: 500 },
    );
  }
}
