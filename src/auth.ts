
import NextAuth, { NextAuthConfig, User } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

// Helper to interact with backend
async function backendRegister(user: any) {
  const apiUrl = process.env.NEXT_PRIVATE_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || 'https://localhost:7007';
  // Standardize provider
  const provider = user.provider || 'email';
  
  // Random password if not provided (e.g. Google auth)
  const password = user.password || Array(16).fill(0).map(() => Math.random().toString(36).charAt(2)).join('') + 'Aa1';

  try {
    const res = await fetch(`${apiUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Email: user.email,
        DisplayName: user.name,
        AvatarUrl: user.image,
        Password: password,
        Provider: provider
      }),
    });
    
    if (!res.ok) {
      if (res.status === 409) return null; // Already exists
      const text = await res.text();
      // console.error('Backend registration failed:', text);
      return null;
    }
    
    return await res.json();
  } catch (error) {
    // console.error('Backend registration error:', error);
    return null;
  }
}

async function backendLogin(credentials: any) {
  const apiUrl = process.env.NEXT_PRIVATE_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || 'https://localhost:7007';
  try {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Email: credentials.email,
        Password: credentials.password,
      }),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    // console.error('Backend login error:', error);
    return null;
  }
}

async function getBackendProfile(email: string, provider?: string) {
  const apiUrl = process.env.NEXT_PRIVATE_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || 'https://localhost:7007';
  try {
    let url = `${apiUrl}/api/profiles/email/${encodeURIComponent(email)}`;
    if (provider) {
      url += `?provider=${encodeURIComponent(provider)}`;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

// Allow self-signed certificates for .NET backend in development
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export const config = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        const user = await backendLogin(credentials);
        
        if (user) {
          return {
            id: user.id || user.Id,
            name: user.displayName || user.DisplayName,
            email: user.email || user.Email,
            image: user.avatarUrl || user.AvatarUrl,
            provider: 'email', 
          };
        }
        return null;
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const email = user.email;
        if (!email) return false;

        try {
          // Check if user exists in backend specifically for this provider
          let backendUser = await getBackendProfile(email, 'google');

          if (!backendUser) {
            // Register user
            backendUser = await backendRegister({
              email,
              name: user.name,
              image: user.image,
              provider: 'google'
            });
            
            if (!backendUser) {
               // console.error('Core Auth: Failed to register user in backend.');
               return false; 
            }
          }
          
          // Mutate user object to include backend ID so it propagates to JWT
          user.id = backendUser.id || backendUser.Id;
          return true;
        } catch (e) {
            // console.error('Core Auth: Error in signIn callback', e);
            return false;
        }
      }
      return true; // Credentials provider already validated in authorize
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.provider = account?.provider;
      }
      // If we signed in with Google, 'user' arg in jwt callback has the backend ID we set in signIn callback?
      // Actually signIn callback runs BEFORE jwt callback. 
      // In signIn callback we mutated 'user'. But does it persist to here?
      // Yes, usually.
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        // @ts-ignore
        session.user.provider = token.provider as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/', // Show login modal on home? Or just redirect home.
    error: '/', // Redirect to home on error for now
  },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(config)
