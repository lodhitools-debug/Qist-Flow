import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || url.origin;

    if (error) {
      return NextResponse.redirect(`${appOrigin}/login?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${appOrigin}/login?error=missing_code`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appOrigin}/login?error=oauth_not_configured`);
    }

    // 1. Exchange code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("[Google OAuth Token Error]:", tokenData);
      return NextResponse.redirect(`${appOrigin}/login?error=token_exchange_failed`);
    }

    // 2. Fetch User Profile from Google
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await userinfoResponse.json();

    if (!userinfoResponse.ok || !profile.email) {
      console.error("[Google OAuth UserInfo Error]:", profile);
      return NextResponse.redirect(`${appOrigin}/login?error=userinfo_failed`);
    }

    const email = profile.email.toLowerCase().trim();
    const name = profile.name || email.split("@")[0];

    // 3. Find or Create User in Database
    let user = await prisma.user.findUnique({
      where: { email },
    });

    const totalUsersCount = await prisma.user.count();
    const isFirstUser = totalUsersCount === 0;

    if (!user) {
      // If no admin exists in database, or if email matches ADMIN_EMAIL, designate as ADMIN
      const configuredAdminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
      const shouldBeAdmin = isFirstUser || (configuredAdminEmail && configuredAdminEmail === email);

      // Generate a random high-entropy password hash since user logs in via Google
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await hashPassword(randomPassword);

      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: shouldBeAdmin ? "ADMIN" : "RECOVERY_OFFICER",
          branch: "MAIN",
          isActive: true,
          mustChangePassword: false,
        },
      });

      await logActivity({
        userId: user.id,
        action: "GOOGLE_USER_CREATED",
        details: { email, role: user.role, isFirstUser },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      });
    }

    if (!user.isActive) {
      return NextResponse.redirect(`${appOrigin}/login?error=account_deactivated`);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    // 4. Sign JWT Token
    const jwtToken = await signToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role as any,
      branch: user.branch,
      managerId: user.managerId,
      mustChangePassword: user.mustChangePassword,
      tenantId: user.tenantId || "default",
    });

    await logActivity({
      userId: user.id,
      action: "GOOGLE_LOGIN_SUCCESS",
      details: { email: user.email, role: user.role },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    // 5. Redirect to Dashboard with Session Cookie
    const response = NextResponse.redirect(`${appOrigin}/`);

    response.cookies.set({
      name: "qistflow_token",
      value: jwtToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error("[Google OAuth Callback Exception]:", err);
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "";
    return NextResponse.redirect(`${appOrigin}/login?error=internal_error`);
  }
}
