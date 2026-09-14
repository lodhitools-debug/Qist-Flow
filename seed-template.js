const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const body = `فوری ریکوری نوٹس\n\nمحترم {{customerName}}،\n\nآپ کا اکاؤنٹ نمبر {{account}} ابھی تک غیر ادا شدہ / واجب الادا ہے۔\n\nپروڈکٹ: {{productName}}\nبرانچ: {{branch}}\n\nبراہِ کرم اپنی بقایا قسط فوری طور پر ادا کریں اور آن لائن ادائیگی کی صورت میں ادائیگی کی تصدیق فراہم کریں، یا برانچ وزٹ کرکے اپنا اکاؤنٹ ریگولرائز کروائیں۔\n\nاہم اطلاع: اگر آپ نے مقررہ وقت پر قسط ادا نہ کی تو آپ کی eCIB/کریڈٹ ہسٹری متاثر ہو سکتی ہے، جس کی وجہ سے مستقبل میں فنانسنگ حاصل کرنے میں مشکلات پیش آ سکتی ہیں۔ مزید برآں، کمپنی پالیسی اور قابلِ اطلاق قانون کے مطابق قانونی کارروائی بھی کی جا سکتی ہے۔\n\nQistbazar Recovery Officer\nGhulam Ahmad Razzaqi`;
  
  await prisma.messageTemplate.upsert({
    where: { slug_tenantId: { slug: 'urdu-urgent-recovery', tenantId: 'default' } },
    update: { body, language: 'URDU' },
    create: {
      name: 'Urdu Urgent Recovery Notice',
      slug: 'urdu-urgent-recovery',
      type: 'OVERDUE',
      language: 'URDU',
      body,
      tenantId: 'default',
      isActive: true,
      variables: 'customerName,account,productName,branch'
    }
  });
  console.log('Template inserted');
}
main().catch(console.error).finally(() => prisma.$disconnect());
