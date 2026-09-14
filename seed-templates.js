const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const templates = [
    {
      name: "Bilingual Overdue Reminder",
      slug: "bilingual-overdue-1m",
      type: "OVERDUE_1M",
      language: "BILINGUAL",
      isActive: true,
      body: `URGENT RECOVERY NOTICE
Mohtaram {{customer_name}},
Aap ka Account No. {{account}} abhi tak unpaid/overdue hai.
Product: {{product_name}}
Branch: {{branch}}

Barah-e-karam apni pending qist foran ada karein aur payment online bhejne ki surat mein confirmation share karein, ya branch visit karke apna account regularize karwain.
Important: Agar aap ne waqt par qist ada na ki to aap ki eCIB/credit history mutasir ho sakti hai.

Qistbazar Recovery Officer
{{recovery_person}}
-------------------------
فوری ریکوری نوٹس
محترم {{customer_name}}،
آپ کا اکاؤنٹ نمبر {{account}} ابھی تک غیر ادا شدہ / واجب الادا ہے۔
پروڈکٹ: {{product_name}}
برانچ: {{branch}}

براہِ کرم اپنی بقایا قسط فوری طور پر ادا کریں اور آن لائن ادائیگی کی صورت میں ادائیگی کی تصدیق فراہم کریں، یا برانچ وزٹ کرکے اپنا اکاؤنٹ ریگولرائز کروائیں۔
اہم اطلاع: اگر آپ نے مقررہ وقت پر قسط ادا نہ کی تو آپ کی eCIB/کریڈٹ ہسٹری متاثر ہو سکتی ہے۔

Qistbazar Recovery Officer
{{recovery_person}}`
    },
    {
      name: "Guarantor First Notice (Bilingual)",
      slug: "guarantor-first-notice-bilingual",
      type: "GUARANTOR_FIRST_NOTICE",
      language: "BILINGUAL",
      isActive: true,
      body: `URGENT RECOVERY NOTICE (GUARANTOR)
Mohtaram {{customer_name}},
Yeh paigham aap ko bataur Zamanat-daar (Guarantor) bhaija ja raha hai.
Account: {{account}}
Pending Amount: Rs. {{balance}}

Barah-e-karam customer se rabta kar ke unhein un ki pending qist ada karne ki yad-dihani karwayein.
Qistbazar Recovery Officer
{{recovery_person}}
-------------------------
فوری ریکوری نوٹس برائے ضامن
محترم {{customer_name}}،
یہ پیغام آپ کو بطور ضمانت دار (Guarantor) بھیجا جا رہا ہے۔
اکاؤنٹ: {{account}}
بقایا رقم: Rs. {{balance}}

براہِ کرم کسٹمر سے رابطہ کر کے انہیں ان کی بقایا قسط ادا کرنے کی یاد دہانی کروائیں۔
Qistbazar Recovery Officer
{{recovery_person}}`
    }
  ];

  for (const t of templates) {
    await prisma.messageTemplate.upsert({
      where: { slug: t.slug },
      update: t,
      create: t,
    });
    console.log(`Upserted template: ${t.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
