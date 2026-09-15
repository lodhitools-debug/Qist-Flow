import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Global WhatsApp Templates...");

  const templates = [
    {
      name: "Customer Notice (Urdu)",
      slug: "customer-notice-urdu",
      type: "OVERDUE",
      language: "URDU",
      body: "Mohtaram {{customerName}},\n\nAap ki qist ki raqam Rs. {{amount}} overdue hai. Baraye meharbani jald az jald jama karwayen taake mazeed pareshani se bacha ja sake.\n\nShukriya,\n{{branchName}}",
      tenantId: "default",
    },
    {
      name: "Guarantor Notice (Urdu)",
      slug: "guarantor-notice-urdu",
      type: "OVERDUE",
      language: "URDU",
      body: "Mohtaram Guarantor,\n\nAap ne jinki guarantee di thi ({{customerName}}), unki qist Rs. {{amount}} abhi tak jama nahi hui hai. Baraye meharbani unse raabta karein.\n\nShukriya,\n{{branchName}}",
      tenantId: "default",
    }
  ];

  for (const t of templates) {
    const exists = await prisma.messageTemplate.findFirst({
      where: { slug: t.slug, tenantId: "default" },
    });
    
    if (!exists) {
      await prisma.messageTemplate.create({ data: t });
      console.log(`Created template: ${t.name}`);
    } else {
      console.log(`Template already exists: ${t.name}`);
    }
  }

  console.log("Global templates seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
