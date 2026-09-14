import { PrismaClient } from "@prisma/client";
import { DEFAULT_TEMPLATES } from "../src/lib/template-renderer";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Restoring Default Templates...");

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
    console.log(`✅ Restored template: ${tmpl.name} (ID: ${tmpl.id})`);
  }

  console.log("🎉 Templates restored successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Script error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
