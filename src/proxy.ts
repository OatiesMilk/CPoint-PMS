import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { ROLE_HOME } from "@/lib/domain";
import { authConfig } from "@/server/lib/auth.config";

// Optimistic, cookie-only check (no database). The real authorization happens in the Data Access
// Layer (src/server/policies/guard.ts). API routes are excluded by the matcher: they authenticate
// themselves (sessions now, device tokens from Phase 3) and answer 401/403 as JSON.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/logout"];

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const user = request.auth?.user;

  // GET only: a late prefetch response can restore the session cookie right after /logout cleared
  // it. Redirecting the sign-in POST (a server action) would then break the login form.
  if (pathname === "/login" && user?.role && request.method === "GET") {
    return NextResponse.redirect(new URL(ROLE_HOME[user.role], request.nextUrl));
  }

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    const login = new URL("/login", request.nextUrl);
    if (pathname !== "/") login.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|icon.jpg|images/).*)"],
};
