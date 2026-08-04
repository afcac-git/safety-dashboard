import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "afcac_session";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "afcac-dashboard-dev-secret-key-2024-change-in-prod";
  return new TextEncoder().encode(secret);
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths — no auth required
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (!isPublic) {
    if (!(await isAuthenticated(request))) {
      // Protect all API write operations with 401
      if (pathname.startsWith("/api/") && request.method !== "GET") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Redirect all other pages to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next.js internals and static files.
     * /login and /api/auth are allowed through above in the isPublic check.
     */
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
