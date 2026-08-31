import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);

    if (session) {
      await logActivity({
        userId: session.userId,
        action: "LOGOUT",
        details: { email: session.email },
      }).catch(() => {});
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    response.cookies.set({
      name: "qistflow_token",
      value: "",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    const response = NextResponse.json(
      { success: false, error: error.message || "Failed to logout" },
      { status: 500 }
    );
    response.cookies.set({
      name: "qistflow_token",
      value: "",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
    return response;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL("/login", req.url);
  const response = NextResponse.redirect(url);
  response.cookies.set({
    name: "qistflow_token",
    value: "",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
