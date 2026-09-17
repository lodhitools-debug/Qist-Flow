import { PrismaClient } from '@prisma/client';
import { DEFAULT_TEMPLATES } from './src/lib/template-renderer';

const prisma = new PrismaClient();

async function main() {
  const customerTemplate = DEFAULT_TEMPLATES.find(t => t.slug === 'customer-urgent-recovery');
  const guarantorTemplate = DEFAULT_TEMPLATES.find(t => t.slug === 'guarantor-urgent-notice');

  if (customerTemplate) {
    await prisma.messageTemplate.updateMany({
      where: { slug: 'customer-urgent-recovery' },
      data: { body: customerTemplate.body }
    });
    console.log('Customer template updated');
  }

  if (guarantorTemplate) {
    await prisma.messageTemplate.updateMany({
      where: { slug: 'guarantor-urgent-notice' },
      data: { body: guarantorTemplate.body }
    });
    console.log('Guarantor template updated');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
