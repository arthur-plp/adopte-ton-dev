import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/contact",
  "/recruteurs",
  "/a-propos",
  "/offres",
  "/developpeurs",
  "/cgu",
  "/confidentialite",
  "/mentions-legales",
];

const REDIRECT_WHEN_AUTHED = ["/sign-in"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rediriger la page d'erreur BetterAuth vers notre UI
  if (pathname === '/api/auth/error') {
    const error = request.nextUrl.searchParams.get('error') ?? 'unknown';
    const isAuthenticated = !!(
      request.cookies.get("better-auth.session_token")?.value ??
      request.cookies.get("__Secure-better-auth.session_token")?.value
    );
    // Si déjà connecté → erreur de liaison de compte → retour sur la page profil
    const dest = isAuthenticated ? '/profile/edit' : '/sign-in';
    const url = new URL(dest, request.url);
    url.searchParams.set('authError', error);
    return NextResponse.redirect(url);
  }

  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value ??
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  if (sessionToken && REDIRECT_WHEN_AUTHED.some((p) => pathname === p)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(p))
  );
  if (isPublic) return NextResponse.next();

  if (!sessionToken) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
