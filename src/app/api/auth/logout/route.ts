import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req);
  if (session) {
    await logActivity({
      userId: session.userId,
      action: "LOGOUT",
      details: { email: session.email },
    });
  }

  const response = NextResponse.json({ success: true, message: "Logged out successfully" });
  response.cookies.delete("qistflow_token");
  return response;
}
