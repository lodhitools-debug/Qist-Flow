import { format } from "date-fns";

export interface TemplateContext {
  customerName?: string;
  guarantorName?: string;
  account?: string;
  emi?: number;
  balance?: number;
  dueDate?: Date | string | null;
  daysOverdue?: number;
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
    slug: "before-due-roman-urdu",
    name: "1 Day Before Due (Roman Urdu)",
    type: "BEFORE_DUE",
    language: "ROMAN_URDU",
    body: `Assalam-o-Alaikum {{customer_name}},

Yeh ek yad-dihani paigham hai ke aap ki Rs. {{emi}} mahana qist ki due date kal ({{due_date}}) hai (Account: {{account}}).

Barah-e-karam waqt par payment kar ke late fee aur kisi bhi pareshani se bachein.

Shukriya,
{{recovery_person}}
QistBazar / QistFlow`,
  },
  {
    slug: "due-today-roman-urdu",
    name: "Due Today Reminder (Roman Urdu)",
    type: "DUE_TODAY",
    language: "ROMAN_URDU",
    body: `Assalam-o-Alaikum {{customer_name}},

Aap ki Rs. {{emi}} qist ki due date AAJ ({{due_date}}) hai (Account: {{account}}).

Barah-e-karam aaj hi apni payment clear kar dein taake aap ka record behtar rahe.

Remaining Balance: Rs. {{balance}}
Shukriya,
{{recovery_person}}
QistBazar`,
  },
  {
    slug: "overdue-1d-roman-urdu",
    name: "1 Day Overdue (Roman Urdu)",
    type: "OVERDUE",
    language: "ROMAN_URDU",
    body: `Muazzaz {{customer_name}},

Aap ki Rs. {{emi}} qist ki due date {{due_date}} guzar chuki hai aur payment abhi tak receive nahi hui.

Barah-e-karam fori tor par payment ada karein. Agar aap payment kar chuke hain to receipt share farmayein.

Account: {{account}}
Shukriya,
Recovery Team ({{recovery_person}})`,
  },
  {
    slug: "overdue-3d-roman-urdu",
    name: "3 Days Overdue (Roman Urdu)",
    type: "OVERDUE",
    language: "ROMAN_URDU",
    body: `Notice - Installment Overdue

Assalam-o-Alaikum {{customer_name}},

Aap ki installment Rs. {{emi}} guzashta {{days_overdue}} din se overdue hai (Due Date: {{due_date}}).

Total Remaining Balance: Rs. {{balance}}
Barah-e-karam aaj hi payment process karein taake recovery team ki taraf se verification call ya visit se bacha ja sake.

Account: {{account}}
Branch: {{branch}}
Recovery Officer: {{recovery_person}}`,
  },
  {
    slug: "overdue-7d-roman-urdu",
    name: "7 Days Overdue - Urgent Notice (Roman Urdu)",
    type: "OVERDUE",
    language: "ROMAN_URDU",
    body: `URGENT RECOVERY NOTICE

Muazzaz {{customer_name}},

Aap ka account ({{account}}) pichle {{days_overdue}} din se unpaid hai.
Payable Amount: Rs. {{emi}}
Total Balance: Rs. {{balance}}

Kripya fori tor par branch visit karein ya payment online bhej kar confirmation dein. Legal/Guarantor verification se pehle apna account regularize karein.

Recovery Officer: {{recovery_person}}
Branch: {{branch}}`,
  },
  {
    slug: "payment-received-roman-urdu",
    name: "Payment Confirmation (Roman Urdu)",
    type: "PAYMENT_RECEIVED",
    language: "ROMAN_URDU",
    body: `Assalam-o-Alaikum {{customer_name}},

Aap ki Rs. {{last_payment_amount}} payment successfully receive ho gayi hai.

Aap ka remaining balance Rs. {{balance}} hai.
Waqt par payment karne ka shukriya!

Account: {{account}}
QistBazar Team`,
  },
  // Guarantor Escalation Templates
  {
    slug: "guarantor-first-notice-roman-urdu",
    name: "Guarantor First Notice (Level 1/2)",
    type: "GUARANTOR_FIRST_NOTICE",
    language: "ROMAN_URDU",
    body: `Assalam-o-Alaikum {{guarantor_name}},

Yeh paigham aap ko bataur Zamanat-daar (Guarantor) bhaija ja raha hai.

Customer: {{customer_name}}
Account: {{account}}
Pending Amount: Rs. {{balance}}
Due Date: {{due_date}}

Barah-e-karam customer se rabta kar ke unhein un ki pending qist ada karne ki yad-dihani karwayein taake un ka account regularize ho sake.

Shukriya,
{{recovery_person}}
QistFlow Recovery Team ({{branch}})`,
  },
  {
    slug: "guarantor-followup-roman-urdu",
    name: "Guarantor Follow-up Notice (Level 2)",
    type: "GUARANTOR_FOLLOWUP",
    language: "ROMAN_URDU",
    body: `Yad-dihani Paigham - Zamanat

Assalam-o-Alaikum {{guarantor_name}},

{{customer_name}} ke account ({{account}}) ki installment pichle {{days_overdue}} din se unpaid hai.

Aap is account ke mohtaram guarantor hain. Hum customer se rabta karne ki koshish kar rahe hain. Barah-e-karam fori tor par customer se baat kar ke payment schedule confirm karwayein.

Pending Balance: Rs. {{balance}}
Recovery Officer: {{recovery_person}}
QistFlow Recovery Department`,
  },
  {
    slug: "guarantor-final-notice-roman-urdu",
    name: "Guarantor Final Notice (Level 3)",
    type: "GUARANTOR_FINAL_NOTICE",
    language: "ROMAN_URDU",
    body: `IMPORTANT NOTICE - GUARANTOR OBLIGATION

Muazzaz {{guarantor_name}},

{{customer_name}} (Account: {{account}}) ka account {{days_overdue}} din se overdue chal raha hai aur mutaddad koshishon ke bawajood payment masool nahi hui.

Bataur Guarantor aap ki zimadari hai ke customer se rabta kar ke mamla fori hal karwayein.

Total Balance: Rs. {{balance}}
Branch: {{branch}}
Recovery Contact: {{recovery_person}}

Barah-e-karam mazeed karwai se pehle humari recovery team se rabta karein.`,
  },
];
