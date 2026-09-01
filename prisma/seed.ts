import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_TEMPLATES } from "../src/lib/template-renderer";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting QistFlow Production Database Seed...");

  // 0. Create default Tenant (required for multi-tenant schema)
  console.log("🏢 Creating default tenant...");
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      id: "default",
      slug: "default",
      name: "Default Company",
      isActive: true,
    },
  });
  console.log(`✅ Default tenant ready: ${defaultTenant.id}`);

  // 1. Templates & Settings Seeding (No hardcoded users - Admin logs in via Google or creates account on initial launch)
  console.log("ℹ️ No hardcoded demo users. Admin can sign in with Google or create credentials on initial launch.");

  // 2. Create Default Templates
  const templateMap: Record<string, string> = {};
  for (const t of DEFAULT_TEMPLATES) {
    const tmpl = await prisma.messageTemplate.upsert({
      where: { slug_tenantId: { slug: t.slug, tenantId: "default" } },
      update: {
        body: t.body,
        name: t.name,
      },
      create: {
        slug: t.slug,
        tenantId: "default",
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
        where: { name: r.name, tenantId: "default" },
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
            tenantId: "default",
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
    where: { key_tenantId: { key: "business_profile", tenantId: "default" } },
    update: {},
    create: {
      key: "business_profile",
      tenantId: "default",
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
    where: { key_tenantId: { key: "whatsapp_config", tenantId: "default" } },
    update: {},
    create: {
      key: "whatsapp_config",
      tenantId: "default",
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

  await prisma.systemSetting.upsert({
    where: { key_tenantId: { key: "guarantor_escalation_config", tenantId: "default" } },
    update: {},
    create: {
      key: "guarantor_escalation_config",
      tenantId: "default",
      value: JSON.stringify({
        enabled: true,
        level1DelayDays: 1,
        level2OverdueDays: 3,
        level3OverdueDays: 7,
        maxMessagesPerAccount: 3,
        maxMessagesPerDay: 50,
        onlyAfterCustomerFailure: false,
        onlyAfterOverdue: true,
        requireManagerApproval: false,
      }),
      description: "Guarantor recovery escalation policy parameters",
    },
  });

  console.log("✅ Initialized System Settings");

  // NOTE: WhatsApp sessions are now user-scoped.
  // The WhatsAppSessionManager creates sessions automatically when a user connects.
  // No default/global session seed needed.

  console.log("🎉 Production seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
