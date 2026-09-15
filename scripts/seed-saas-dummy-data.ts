import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding dummy SaaS data...");

  // 1. Get the "Default Company" tenant
  const defaultTenant = await prisma.tenant.findUnique({
    where: { id: "default" },
  });

  if (!defaultTenant) {
    console.error("Default Company tenant not found! Cannot seed dummy data.");
    return;
  }

  // 2. Get a Plan (Growth or any available)
  const plan = await prisma.planVersion.findFirst({
    where: { slug: "growth" }
  });

  if (!plan) {
    console.error("No plans found. Please run seed-saas-plans.ts first.");
    return;
  }

  // 3. Seed Subscription
  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId: defaultTenant.id }
  });
  
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        tenantId: defaultTenant.id,
        planVersionId: plan.id,
        status: "ACTIVE",
        billingCycle: "MONTHLY",
        startAt: new Date(),
        renewsAt: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        amount: plan.monthlyPrice,
        currency: plan.currency,
        paymentStatus: "PAID"
      }
    });
    console.log("Created Dummy Subscription");
  }

  // 4. Seed Invoices
  const existingInvoice = await prisma.invoice.findFirst({
    where: { tenantId: defaultTenant.id }
  });

  if (!existingInvoice) {
    await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-2026-0001",
        tenantId: defaultTenant.id,
        amount: 5000,
        total: 5000,
        currency: "PKR",
        status: "PAID",
        createdAt: new Date(new Date().setDate(new Date().getDate() - 30)), // Last month
        paidAt: new Date(new Date().setDate(new Date().getDate() - 29))
      }
    });
    await prisma.invoice.create({
      data: {
        invoiceNumber: "INV-2026-0002",
        tenantId: defaultTenant.id,
        amount: 5000,
        total: 5000,
        currency: "PKR",
        status: "PENDING",
        createdAt: new Date(),
        dueAt: new Date(new Date().setDate(new Date().getDate() + 7)) // Due in 7 days
      }
    });
    console.log("Created Dummy Invoices");
  }

  // 5. Seed Support Tickets
  const existingTickets = await prisma.supportTicket.findFirst({
    where: { tenantId: defaultTenant.id }
  });

  if (!existingTickets) {
    await prisma.supportTicket.createMany({
      data: [
        {
          tenantId: defaultTenant.id,
          subject: "How do I add a new Guarantor template?",
          category: "WHATSAPP",
          priority: "LOW",
          status: "RESOLVED",
          description: "I need to add a new template in Sindhi for my guarantors. How can I do this?",
          createdAt: new Date(new Date().setDate(new Date().getDate() - 10))
        },
        {
          tenantId: defaultTenant.id,
          subject: "WhatsApp API is disconnected",
          category: "TECHNICAL",
          priority: "URGENT",
          status: "IN_PROGRESS",
          description: "My WhatsApp is showing as disconnected since this morning. Please check immediately.",
          createdAt: new Date(new Date().setHours(new Date().getHours() - 5))
        },
        {
          tenantId: defaultTenant.id,
          subject: "Billing issue with latest invoice",
          category: "BILLING",
          priority: "MEDIUM",
          status: "OPEN",
          description: "I was charged twice for the month of September. Please refund the extra amount.",
          createdAt: new Date()
        }
      ]
    });
    console.log("Created Dummy Support Tickets");
  }

  console.log("Dummy data seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
