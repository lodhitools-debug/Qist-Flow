import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_TEMPLATES } from "../src/lib/template-renderer";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting QistFlow Database Seed...");

  // 1. Create Default Users (Configurable via ENV for production)
  const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || "admin@qistflow.com").toLowerCase().trim();
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || "admin123";
  const isDefaultPassword = initialAdminPassword === "admin123";

  const adminPasswordHash = await bcrypt.hash(initialAdminPassword, 10);
  const managerPassword = await bcrypt.hash(process.env.INITIAL_MANAGER_PASSWORD || "manager123", 10);
  const officerPassword = await bcrypt.hash(process.env.INITIAL_OFFICER_PASSWORD || "officer123", 10);

  const admin = await prisma.user.upsert({
    where: { email: initialAdminEmail },
    update: {},
    create: {
      name: process.env.INITIAL_ADMIN_NAME || "Super Admin",
      email: initialAdminEmail,
      passwordHash: adminPasswordHash,
      phone: "03001234567",
      role: "ADMIN",
      branch: "HEAD_OFFICE",
      mustChangePassword: isDefaultPassword,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@qistflow.com" },
    update: {},
    create: {
      name: "Recovery Manager",
      email: "manager@qistflow.com",
      passwordHash: managerPassword,
      phone: "03119876543",
      role: "MANAGER",
      branch: "QBLAN",
    },
  });

  const officer = await prisma.user.upsert({
    where: { email: "officer@qistflow.com" },
    update: {},
    create: {
      name: "Ghulam Ahmed razaqi",
      email: "officer@qistflow.com",
      passwordHash: officerPassword,
      phone: "03122621292",
      role: "RECOVERY_OFFICER",
      branch: "QBLAN",
    },
  });

  console.log("✅ Created Users: Admin, Manager, Recovery Officer");

  // 2. Create Default Templates
  const templateMap: Record<string, string> = {};
  for (const t of DEFAULT_TEMPLATES) {
    const tmpl = await prisma.messageTemplate.upsert({
      where: { slug: t.slug },
      update: {
        body: t.body,
        name: t.name,
      },
      create: {
        slug: t.slug,
        name: t.name,
        type: t.type,
        language: t.language,
        body: t.body,
        variables: "{{customer_name}},{{account}},{{emi}},{{balance}},{{due_date}},{{days_overdue}},{{branch}},{{recovery_person}}",
        isActive: true,
      },
    });
    templateMap[t.slug] = tmpl.id;
  }

  console.log("✅ Created Standard Message Templates");

  // 3. Create Default Reminder Rules
  const defaultRules = [
    {
      name: "1 Day Before Due Date Reminder",
      ruleType: "BEFORE_DUE",
      daysOffset: -1,
      timeWindowStart: "10:00",
      timeWindowEnd: "19:00",
      templateSlug: "before-due-roman-urdu",
      maxReminders: 1,
      minGapDays: 1,
    },
    {
      name: "Due Date Reminder (Due Today)",
      ruleType: "DUE_TODAY",
      daysOffset: 0,
      timeWindowStart: "10:00",
      timeWindowEnd: "19:00",
      templateSlug: "due-today-roman-urdu",
      maxReminders: 1,
      minGapDays: 1,
    },
    {
      name: "1 Day Overdue Notice",
      ruleType: "OVERDUE_1D",
      daysOffset: 1,
      timeWindowStart: "10:00",
      timeWindowEnd: "19:00",
      templateSlug: "overdue-1d-roman-urdu",
      maxReminders: 1,
      minGapDays: 1,
    },
    {
      name: "3 Days Overdue Notice",
      ruleType: "OVERDUE_3D",
      daysOffset: 3,
      timeWindowStart: "10:00",
      timeWindowEnd: "19:00",
      templateSlug: "overdue-3d-roman-urdu",
      maxReminders: 2,
      minGapDays: 2,
    },
    {
      name: "7 Days Overdue Urgent Notice",
      ruleType: "OVERDUE_7D",
      daysOffset: 7,
      timeWindowStart: "10:00",
      timeWindowEnd: "19:00",
      templateSlug: "overdue-7d-roman-urdu",
      maxReminders: 3,
      minGapDays: 3,
    },
  ];

  for (const r of defaultRules) {
    const templateId = templateMap[r.templateSlug];
    if (templateId) {
      const existing = await prisma.reminderRule.findFirst({
        where: { name: r.name },
      });

      if (!existing) {
        await prisma.reminderRule.create({
          data: {
            name: r.name,
            ruleType: r.ruleType,
            daysOffset: r.daysOffset,
            timeWindowStart: r.timeWindowStart,
            timeWindowEnd: r.timeWindowEnd,
            templateId,
            maxReminders: r.maxReminders,
            minGapDays: r.minGapDays,
            isActive: true,
          },
        });
      }
    }
  }

  console.log("✅ Created Default Reminder Rules");

  // 4. Initial System Settings
  await prisma.systemSetting.upsert({
    where: { key: "business_profile" },
    update: {},
    create: {
      key: "business_profile",
      value: JSON.stringify({
        companyName: "QistFlow Recovery (QistBazar)",
        tagline: "Smart Recovery & WhatsApp Reminder System",
        supportPhone: "021-111-747835",
        defaultBranch: "QBLAN",
        branches: ["QBLAN", "QBKOR", "QBNZN", "QBGUL", "MAIN"],
      }),
      description: "Business identity and operational settings",
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: "whatsapp_config" },
    update: {},
    create: {
      key: "whatsapp_config",
      value: JSON.stringify({
        provider: "WEB",
        minDelayMs: 6000,
        maxDelayMs: 14000,
        dailyLimit: 250,
        antiBanEnabled: true,
        autoReconnect: true,
      }),
      description: "WhatsApp throttling, anti-ban rate limiting, and safety rules",
    },
  });

  console.log("✅ Initialized System Settings");

  // 5. Initial WhatsApp Session entry
  await prisma.whatsAppSession.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      status: "DISCONNECTED",
      reconnectAttempts: 0,
    },
  });

  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
