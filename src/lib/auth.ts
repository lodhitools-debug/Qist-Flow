import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "qistflow_super_secure_jwt_secret_key_2026_pk"
);

export interface TokenPayload {
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "RECOVERY_OFFICER";
  branch?: string | null;
  managerId?: string | null;
  mustChangePassword?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const p = payload as any;
    const userId = (p.userId || p.id || p.sub || "") as string;
    return {
      ...p,
      userId,
    } as TokenPayload;
  } catch (error) {
    return null;
  }
}

export async function getSessionUser(req?: NextRequest): Promise<TokenPayload | null> {
  let token: string | undefined;

  if (req) {
    // Check Authorization header or cookie
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else {
      token = req.cookies.get("qistflow_token")?.value;
    }
  } else {
    // Server component / action
    const cookieStore = cookies();
    token = cookieStore.get("qistflow_token")?.value;
  }

  if (!token) return null;
  return verifyToken(token);
}

export function hasRole(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Standard server-side auth guard for Next.js route handlers
 */
export async function requireAuth(
  req: NextRequest,
  allowedRoles?: string[]
): Promise<{ user: TokenPayload; errorResponse?: null } | { user: null; errorResponse: NextResponse }> {
  const user = await getSessionUser(req);

  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { success: false, error: "Authentication required. Please log in." },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { success: false, error: "Access denied. Insufficient permissions." },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}

/**
 * Generates a high-entropy temporary password
 */
export function generateTemporaryPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  let pwd = "";
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    pwd += chars[bytes[i] % chars.length];
  }
  return pwd;
}
