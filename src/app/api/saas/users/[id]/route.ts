import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Ensure they don't delete the main SUPER_ADMIN or themselves (simplification)
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.email === "lodhitools@gmail.com") {
      return NextResponse.json({ error: "Cannot delete the primary owner account." }, { status: 403 });
    }

    await prisma.user.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[SAAS_USER_DELETE]", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
