import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/auth";
const AUTH_COOKIE = "dz_logged_in"; // نفس الاسم في authStorage.ts
const PROTECTED_PREFIXES = ["/admin", "/pos"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = request.cookies.has(AUTH_COOKIE);

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !loggedIn) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  // المسجّل لا يحتاج صفحة الدخول
  if (pathname === LOGIN_PATH && loggedIn) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth", "/admin/:path*", "/pos/:path*"],
};
