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
      return NextResponse.redirect(`${appOrigin}/saas/login?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${appOrigin}/saas/login?error=missing_code`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appOrigin}/saas/login?error=oauth_not_configured`);
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
      return NextResponse.redirect(`${appOrigin}/saas/login?error=token_exchange_failed`);
    }

    // 2. Fetch User Profile from Google
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await userinfoResponse.json();

    if (!userinfoResponse.ok || !profile.email) {
      console.error("[Google OAuth UserInfo Error]:", profile);
      return NextResponse.redirect(`${appOrigin}/saas/login?error=userinfo_failed`);
    }

    const email = profile.email.toLowerCase().trim();
    const name = profile.name || email.split("@")[0];

    // 3. Find or Create User in Database
    let user = await prisma.user.findUnique({
      where: { email },
    });

    const TARGET_ADMIN_EMAIL = "lodhitools@gmail.com";
    if (email !== TARGET_ADMIN_EMAIL) {
      console.warn(`[Google Auth] Unauthorized email attempt: ${email}`);
      return NextResponse.redirect(`${appOrigin}/saas/login?error=unauthorized_email`);
    }

    const shouldBeAdmin = true;

    if (!user) {
      // Generate a random high-entropy password hash since user logs in via Google
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await hashPassword(randomPassword);

      // Ensure 'default' tenant exists for Super Admin
      const defaultTenant = await prisma.tenant.findUnique({ where: { id: "default" } });
      if (!defaultTenant) {
        await prisma.tenant.create({
          data: {
            id: "default",
            name: "System Administration",
            slug: "system-admin",
            isActive: true,
          }
        });
      }

      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: shouldBeAdmin ? "SUPER_ADMIN" : "RECOVERY_OFFICER",
          branch: "MAIN",
          isActive: true,
          mustChangePassword: false,
          tenantId: "default",
        },
      });

      await logActivity({
        userId: user.id,
        action: "GOOGLE_USER_CREATED",
        details: { email, role: user.role, isFirstUser: false },
        ipAddress: req.headers.get("x-forwarded-for") || undefined,
      });
    } else {
      // If user already exists but they should be a SUPER_ADMIN, upgrade them automatically
      if (shouldBeAdmin && user.role !== "SUPER_ADMIN") {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: "SUPER_ADMIN" },
        });
      }
    }

    if (!user.isActive) {
      return NextResponse.redirect(`${appOrigin}/saas/login?error=account_deactivated`);
    }

    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(`${appOrigin}/saas/login?error=not_super_admin`);
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
    const response = NextResponse.redirect(`${appOrigin}/saas`);

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
    return NextResponse.redirect(`${appOrigin}/saas/login?error=internal_error`);
  }
}
