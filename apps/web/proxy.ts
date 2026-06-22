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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rediriger la page d'erreur BetterAuth vers notre UI
  if (pathname === "/api/auth/error") {
    const error = request.nextUrl.searchParams.get("error") ?? "unknown";
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("authError", error);
    return NextResponse.redirect(url);
  }

  const sessionToken =
    request.cookies.get("better-auth.session_token")?.value ??
    request.cookies.get("__Secure-better-auth.session_token")?.value;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(p)),
  );
  if (isPublic) return NextResponse.next();

  // Route protégée sans session → redirection vers /sign-in
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
