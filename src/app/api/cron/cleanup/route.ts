import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedCustomers = await prisma.customer.deleteMany({
      where: {
        updatedAt: {
          lt: thirtyDaysAgo
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Deleted ${deletedCustomers.count} customers older than 30 days.`
    });
  } catch (error: any) {
    console.error("[CRON Cleanup Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
