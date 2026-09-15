import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding default SaaS Plans...");

  const plans = [
    {
      name: "Starter",
      slug: "starter",
      monthlyPrice: 0,
      maxUsers: 2,
      maxBranches: 1,
      maxWaAccounts: 1,
      maxCustomers: 500,
      maxMonthlyMessages: 1000,
      isRecommended: false,
      status: "ACTIVE",
    },
    {
      name: "Growth",
      slug: "growth",
      monthlyPrice: 5000,
      maxUsers: 10,
      maxBranches: 3,
      maxWaAccounts: 2,
      maxCustomers: 5000,
      maxMonthlyMessages: 10000,
      isRecommended: true,
      status: "ACTIVE",
    },
    {
      name: "Enterprise",
      slug: "enterprise",
      monthlyPrice: 15000,
      maxUsers: 50,
      maxBranches: 10,
      maxWaAccounts: 5,
      maxCustomers: 50000,
      maxMonthlyMessages: 100000,
      isRecommended: false,
      status: "ACTIVE",
    }
  ];

  for (const p of plans) {
    const exists = await prisma.planVersion.findFirst({
      where: { slug: p.slug },
    });
    
    if (!exists) {
      await prisma.planVersion.create({ data: p });
      console.log(`Created plan: ${p.name}`);
    } else {
      console.log(`Plan already exists: ${p.name}`);
    }
  }

  console.log("SaaS Plans seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
