import NextAuth, { type DefaultSession, type Session } from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Auth.js con Google. Pedimos `drive.file` (no sensible) desde el login para que el navegador
 * pueda leer/crear la Sheet del usuario directamente contra las APIs de Google.
 *
 * Decisión de privacidad: el access/refresh token viven SOLO en el JWT cifrado de la cookie del
 * usuario (sin base de datos). Nuestro servidor no persiste tokens ni datos; solo los refresca.
 *
 * `LUCA_MOCK=1`: sesión falsa guardada en una cookie (sin Google) para desarrollo y e2e.
 * Los componentes no saben cuál de las dos está activa: reciben `mode` y usan `getGoogleClient()`.
 */

export const IS_MOCK = process.env.LUCA_MOCK === "1";
export const CLIENT_MODE: "google" | "mock" = IS_MOCK ? "mock" : "google";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshTokenError";
    user: DefaultSession["user"] & { sub?: string };
  }
}

type GoogleToken = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number; // epoch segundos
  error?: "RefreshTokenError";
  sub?: string;
};

async function refreshGoogleToken(token: GoogleToken): Promise<GoogleToken> {
  if (!token.refresh_token) return { ...token, error: "RefreshTokenError" };
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string };
  if (!res.ok || !data.access_token) return { ...token, error: "RefreshTokenError" };
  return {
    ...token,
    access_token: data.access_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    refresh_token: data.refresh_token ?? token.refresh_token,
    error: undefined,
  };
}

const nextAuth = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Google({
      authorization: { params: { scope: SCOPES, access_type: "offline", prompt: "consent" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      const t = token as GoogleToken & typeof token;
      if (account) {
        // Primer login (o re-consentimiento): guardamos tokens en el JWT.
        return {
          ...t,
          sub: profile?.sub ?? t.sub,
          access_token: account.access_token,
          refresh_token: account.refresh_token ?? t.refresh_token,
          expires_at: account.expires_at,
          error: undefined,
        };
      }
      if (t.expires_at && Date.now() / 1000 < t.expires_at - 60) return t;
      return refreshGoogleToken(t);
    },
    async session({ session, token }) {
      const t = token as GoogleToken;
      session.accessToken = t.access_token;
      session.error = t.error;
      session.user.sub = t.sub;
      return session;
    },
  },
});

// --- Modo mock: sesión en cookie, sin Google ---

const MOCK_COOKIE = "luca_mock_session";
const MOCK_USER = { name: "Nombre Apellido", email: "nombre.apellido@example.com", image: "", sub: "mock-sub" };

async function mockAuth(): Promise<Session | null> {
  const jar = await cookies();
  if (jar.get(MOCK_COOKIE)?.value !== "1") return null;
  return { user: MOCK_USER, accessToken: "mock-token", expires: new Date(Date.now() + 86400000).toISOString() };
}

async function mockSignIn(_provider?: string, o?: { redirectTo?: string }): Promise<never> {
  const jar = await cookies();
  jar.set(MOCK_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(o?.redirectTo ?? "/app");
}

async function mockSignOut(o?: { redirectTo?: string }): Promise<never> {
  const jar = await cookies();
  jar.delete(MOCK_COOKIE);
  redirect(o?.redirectTo ?? "/");
}

const mockHandlers = {
  GET: async () => Response.json({ error: "auth deshabilitada en LUCA_MOCK" }, { status: 404 }),
  POST: async () => Response.json({ error: "auth deshabilitada en LUCA_MOCK" }, { status: 404 }),
};

export const handlers = IS_MOCK ? mockHandlers : nextAuth.handlers;
export const auth: () => Promise<Session | null> = IS_MOCK ? mockAuth : () => nextAuth.auth();
export const signIn: (provider: "google", o: { redirectTo: string }) => Promise<void> = IS_MOCK ? mockSignIn : (p, o) => nextAuth.signIn(p, o);
export const signOut: (o: { redirectTo: string }) => Promise<void> = IS_MOCK ? mockSignOut : (o) => nextAuth.signOut(o);
