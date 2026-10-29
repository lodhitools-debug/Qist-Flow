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
Mohtaram {{guarantor_name}},
Yeh paigham aap ko bataur Zamanat-daar (Guarantor) bhaija ja raha hai.
Customer: {{customer_name}}
Account: {{account}}
Pending Amount: Rs. {{balance}}

Barah-e-karam customer se rabta kar ke unhein un ki pending qist ada karne ki yad-dihani karwayein.
Qistbazar Recovery Officer
{{recovery_person}}
-------------------------
فوری ریکوری نوٹس برائے ضامن
محترم {{guarantor_name}}،
یہ پیغام آپ کو بطور ضمانت دار (Guarantor) بھیجا جا رہا ہے۔
کسٹمر: {{customer_name}}
اکاؤنٹ: {{account}}
بقایا رقم: Rs. {{balance}}

براہِ کرم کسٹمر سے رابطہ کر کے انہیں ان کی بقایا قسط ادا کرنے کی یاد دہانی کروائیں۔
Qistbazar Recovery Officer
{{recovery_person}}`
    },
    {
      name: "Guarantor Level 2 Follow-Up Notice (Bilingual)",
      slug: "guarantor-followup-bilingual",
      type: "GUARANTOR_FOLLOWUP",
      language: "BILINGUAL",
      isActive: true,
      body: `URGENT FOLLOW-UP — GUARANTOR
Assalam-o-Alaikum {{guarantor_name}},
Customer {{customer_name}} (Account: {{account}}) ki overdue qist Rs. {{balance}} abhi tak ada nahi hui.
Bataur Zamin, barah-e-karam foran customer se rabta kar ke baqaya qist ki adaigi clear karwayein.
Qistbazar Recovery Officer
{{recovery_person}}
-------------------------
دوسرا نوٹس برائے ضامن
السلام علیکم {{guarantor_name}}،
کسٹمر {{customer_name}} (اکاؤنٹ نمبر: {{account}}) کی واجب الادا قسط Rs. {{balance}} ابھی تک ادا نہیں ہوئی۔
بطور ضامن، براہِ کرم فوری طور پر کسٹمر سے رابطہ کرکے ادائیگی کلیئر کروائیں۔
Qistbazar Recovery Officer
{{recovery_person}}`
    },
    {
      name: "Guarantor Level 3 Final Notice (Bilingual)",
      slug: "guarantor-final-notice-bilingual",
      type: "GUARANTOR_FINAL_NOTICE",
      language: "BILINGUAL",
      isActive: true,
      body: `FINAL LEGAL NOTICE — GUARANTOR
Mohtaram {{guarantor_name}},
Customer {{customer_name}} (Account: {{account}}) ki qist mutadad notices ke bawajood ada nahi hui.
Bataur Guarantor aap par bhi yeh zimmedari aaid hoti hai. Barah-e-karam foran payment clear karwayein warna company policy ke mutabiq legal action initialize kiya ja sakta hai.
Qistbazar Recovery Officer
{{recovery_person}}
-------------------------
حتمی قانونی نوٹس برائے ضامن
محترم {{guarantor_name}}،
کسٹمر {{customer_name}} (اکاؤنٹ نمبر: {{account}}) کی قسط متعدد نوٹسز کے باوجود ادا نہیں ہوئی۔
بطور ضامن آپ پر بھی یہ قانونی ذمہ داری عائد ہوتی ہے۔ براہِ کرم فوری ادائیگی یقینی بنائیں ورنہ قانونی کارروائی عمل میں لائی جا سکتی ہے۔
Qistbazar Recovery Officer
{{recovery_person}}`
    }
  ];

  for (const t of templates) {
    await prisma.messageTemplate.upsert({
      where: {
        slug_tenantId: {
          slug: t.slug,
          tenantId: "default",
        },
      },
      update: {
        ...t,
        tenantId: "default",
      },
      create: {
        ...t,
        tenantId: "default",
      },
    });
    console.log(`Upserted template: ${t.name}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
