import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Watching DB WhatsApp Session for testing user...");
  const testingUserId = "cmth31ulf0001ycqu0hfklnct";

  let lastStatus = null;
  for (let i = 0; i < 20; i++) {
    const session = await prisma.whatsAppSession.findUnique({
      where: { userId: testingUserId },
      select: { status: true, errorMessage: true, updatedAt: true }
    });
    
    if (session?.status !== lastStatus) {
      console.log(`[${new Date().toISOString()}] Status changed to: ${session?.status} (Error: ${session?.errorMessage})`);
      lastStatus = session?.status;
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await prisma.$disconnect();
}
main();
