import { format } from "date-fns";

export interface TemplateContext {
  customerName?: string;
  guarantorName?: string;
  account?: string;
  emi?: number;
  balance?: number;
  dueDate?: Date | string | null;
  daysOverdue?: number;
  monthsOverdue?: number;
  branch?: string;
  recoveryPerson?: string;
  lastPaymentAmount?: number;
  productName?: string;
}

export const TEMPLATE_VARIABLES = [
  { token: "{{guarantor_name}}", label: "Guarantor Name", sample: "Muhammad Rashid" },
  { token: "{{customer_name}}", label: "Customer Name", sample: "Mirza Amir Baig" },
  { token: "{{account}}", label: "Account Number", sample: "267000473" },
  { token: "{{emi}}", label: "EMI Amount", sample: "2,900" },
  { token: "{{balance}}", label: "Remaining Balance", sample: "10,400" },
  { token: "{{due_date}}", label: "Due Date", sample: "05-Sep-2026" },
  { token: "{{days_overdue}}", label: "Days Overdue", sample: "3" },
  { token: "{{months_overdue}}", label: "Months Overdue", sample: "1" },
  { token: "{{branch}}", label: "Branch", sample: "QBLAN" },
  { token: "{{recovery_person}}", label: "Recovery Officer", sample: "Ghulam Ahmed" },
  { token: "{{last_payment_amount}}", label: "Last Payment Amount", sample: "2,900" },
  { token: "{{product_name}}", label: "Product Name", sample: "Itel P70" },
];

/**
 * Formats numbers with commas
 */
function formatCurrency(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return "0";
  return new Intl.NumberFormat("en-PK").format(Math.round(val));
}

/**
 * Renders a message template with contextual variables
 */
export function renderTemplate(templateString: string, context: TemplateContext): string {
  if (!templateString) return "";

  let dueDateStr = "";
  if (context.dueDate) {
    try {
      const d = typeof context.dueDate === "string" ? new Date(context.dueDate) : context.dueDate;
      dueDateStr = format(d, "dd-MMM-yyyy");
    } catch {
      dueDateStr = String(context.dueDate);
    }
  }

  const replacements: Record<string, string> = {
    "{{guarantor_name}}": context.guarantorName || "Guarantor Sahab",
    "{{customer_name}}": context.customerName || "Customer",
    "{{account}}": context.account || "",
    "{{emi}}": formatCurrency(context.emi),
    "{{balance}}": formatCurrency(context.balance),
    "{{due_date}}": dueDateStr,
    "{{days_overdue}}": String(context.daysOverdue || 0),
    "{{months_overdue}}": String(context.monthsOverdue || 0),
    "{{branch}}": context.branch || "QistBazar",
    "{{recovery_person}}": context.recoveryPerson || "Recovery Department",
    "{{last_payment_amount}}": formatCurrency(context.lastPaymentAmount),
    "{{product_name}}": context.productName || "Installment Product",
  };

  let rendered = templateString;
  for (const [token, value] of Object.entries(replacements)) {
    // Replace all occurrences
    rendered = rendered.split(token).join(value);
  }

  return rendered.trim();
}

/**
 * Standard default templates for QistFlow
 */
export const DEFAULT_TEMPLATES = [
  {
    slug: "customer-urgent-recovery",
    name: "Customer Urgent Recovery Notice",
    type: "OVERDUE",
    language: "URDU_AND_ROMAN",
    body: `URGENT RECOVERY NOTICE
Mohtaram {{customer_name}},
Aap ka Account No. {{account}} abhi tak unpaid/overdue hai
Product: {{product_name}}
Branch: {{branch}}
Barah-e-karam apni pending qist foran ada karein aur payment online bhejne ki surat mein confirmation share karein, ya branch visit karke apna account regularize karwain.
Important: Agar aap ne waqt par qist ada na ki to aap ki eCIB/credit history mutasir ho sakti hai, jis ki wajah se mustaqbil mein financing hasil karne mein mushkil paish aa sakti hai. Mazeed, company policy aur applicable law ke mutabiq legal action bhi liya ja sakta hai.
Qistbazar Recovery Officer
{{recovery_person}}

فوری ریکوری نوٹس

محترم {{customer_name}}،

آپ کا اکاؤنٹ نمبر {{account}} ابھی تک غیر ادا شدہ / واجب الادا ہے۔

پروڈکٹ: {{product_name}}
برانچ: {{branch}}

براہِ کرم اپنی بقایا قسط فوری طور پر ادا کریں اور آن لائن ادائیگی کی صورت میں ادائیگی کی تصدیق فراہم کریں، یا برانچ وزٹ کرکے اپنا اکاؤنٹ ریگولرائز کروائیں۔

اہم اطلاع: اگر آپ نے مقررہ وقت پر قسط ادا نہ کی تو آپ کی eCIB/کریڈٹ ہسٹری متاثر ہو سکتی ہے، جس کی وجہ سے مستقبل میں فنانسنگ حاصل کرنے میں مشکلات پیش آ سکتی ہیں۔ مزید برآں، کمپنی پالیسی اور قابلِ اطلاق قانون کے مطابق قانونی کارروائی بھی کی جا سکتی ہے۔

Qistbazar Recovery Officer
{{recovery_person}}`,
  },
  {
    slug: "guarantor-urgent-notice",
    name: "Guarantor Urgent Notice",
    type: "GUARANTOR_FIRST_NOTICE",
    language: "URDU_AND_ROMAN",
    body: `Yaad-dihani Paigham — Guarantor

Assalam-o-Alaikum {{guarantor_name}},

{{customer_name}} ke account number {{account}} ki qist ta-hala Unpaid/Overdue hai.
Product: {{product_name}}

Aap is account ke mohtaram Guarantor (Zamin) hain. Hum customer se rabta karne ki koshish kar rahe hain. Barah-e-karam fori tor par customer se rabta kar ke baqaya qist ki adaigi aur aainda ke Payment Schedule ki tasdeeq karwayein.

Aham Ittela:

Agar muqarrara waqt par qistain ada na ki gayin aur adaigi mein musalsal takheer hoti rahi to is ke nateejay mein Customer ke sath sath Guarantor ki ECIB/Credit History bhi mutasir ho sakti hai, jis se mustaqbil mein maali sahuliyat/financing hasil karne mein mushkilat paish aa sakti hain.

Mazeed bar-aan, wajebat ki musalsal adam adaigi ki surat mein idaray ki policy aur qabil-e-ittelaq qawaneen ke mutabiq Customer aur Guarantor ke khilaf qanooni karwai bhi amal mein lai ja sakti hai.

Lehaza kisi bhi mazeed takheer se bachne ke liye barah-e-karam fori tor par mutaliqa customer se rabta kar ke baqaya qist ki adaigi yaqini banwayein.

Qistbazar Recovery Officer:
{{recovery_person}}

یاد دہانی پیغام — Guarantor

السلام علیکم {{guarantor_name}}،

{{customer_name}} کے اکاؤنٹ نمبر {{account}} کی قسط تاحال Unpaid/Overdue ہے۔
پروڈکٹ: {{product_name}}

آپ اس اکاؤنٹ کے معزز Guarantor (ضامن) ہیں۔ ہم کسٹمر سے رابطہ کرنے کی کوشش کر رہے ہیں۔ براہِ کرم فوری طور پر کسٹمر سے رابطہ کر کے بقایا قسط کی ادائیگی اور آئندہ کے Payment Schedule کی تصدیق کروائیں۔

اہم اطلاع:

اگر مقررہ وقت پر اقساط ادا نہ کی گئیں اور ادائیگی میں مسلسل تاخیر ہوتی رہی تو اس کے نتیجے میں Customer کے ساتھ ساتھ Guarantor کی ECIB/Credit History بھی متاثر ہو سکتی ہے، جس سے مستقبل میں مالی سہولیات/فنانسنگ کے حصول میں مشکلات پیش آ سکتی ہیں۔

مزید برآں، واجبات کی مسلسل عدم ادائیگی کی صورت میں ادارے کی پالیسی اور قابلِ اطلاق قوانین کے مطابق Customer اور Guarantor کے خلاف قانونی کارروائی بھی عمل میں لائی جا سکتی ہے۔

لہٰذا کسی بھی مزید تاخیر سے بچنے کے لیے براہِ کرم فوری طور پر متعلقہ کسٹمر سے رابطہ کر کے بقایا قسط کی ادائیگی یقینی بنوائیں۔

Qistbazar Recovery Officer:
{{recovery_person}}`,
  }
];
