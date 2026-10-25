import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths and API routes (APIs handle their own auth via requireAuth)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/saas/login") ||
    pathname.startsWith("/change-password") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/offline.html" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check for the authentication token cookie
  const token = request.cookies.get("qistflow_token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // --- SaaS Panel Security Fix ---
  // Ensure only SUPER_ADMIN can access routes starting with /saas
  if (pathname.startsWith("/saas")) {
    try {
      const JWT_SECRET = new TextEncoder().encode(
        process.env.JWT_SECRET || "qistflow_super_secure_jwt_secret_key_2026_pk"
      );
      const { payload } = await jwtVerify(token, JWT_SECRET);
      
      if (payload.role !== "SUPER_ADMIN") {
        // If an ordinary user tries to open the SaaS panel, send them back to the user panel
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch (error) {
      // If token is invalid or expired
      return NextResponse.redirect(new URL("/saas/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
