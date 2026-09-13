import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    settings: {
      appName: "QistFlow SaaS",
      maintenanceMode: false,
      version: "1.0.0"
    }
  });
}
