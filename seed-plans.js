const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: "Starter",
      price: 5000,
      maxUsers: 5,
      maxCustomers: 2000,
      features: JSON.stringify(["Basic Recovery Workflow", "WhatsApp Notifications", "Max 2000 Customers", "5 Team Members"]),
      isPublic: true,
    },
    {
      name: "Growth (Pro)",
      price: 15000,
      maxUsers: 15,
      maxCustomers: 10000,
      features: JSON.stringify(["Advanced Workflows", "Bulk WhatsApp Broadcasting", "Escalation Approvals", "Max 10,000 Customers", "15 Team Members"]),
      isPublic: true,
    },
    {
      name: "Enterprise",
      price: 35000,
      maxUsers: 50,
      maxCustomers: 50000,
      features: JSON.stringify(["Unlimited Campaigns", "Custom Integrations", "Priority Support", "Dedicated WhatsApp API", "Max 50,000 Customers", "50 Team Members"]),
      isPublic: true,
    }
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.create({
      data: plan,
    });
    console.log(`Created plan: ${plan.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
