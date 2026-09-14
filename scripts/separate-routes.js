const fs = require('fs');
const path = require('path');

const srcFile = path.join('src', 'app', '(dashboard)', 'recovery', 'send-reminders', 'page.tsx');
let content = fs.readFileSync(srcFile, 'utf8');

let customerContent = content
  .replace(/BulkReminderWizardContent/g, 'CustomerReminderWizardContent')
  .replace(/BulkReminderWizardPage/g, 'CustomerReminderWizardPage')
  .replace(/const \[activeTab, setActiveTab\] = useState[^;]*;/, 'const activeTab = "CUSTOMER";')
  .replace(/\{\/\* Top Tabs \*\/\}[\s\S]*?\{\/\* Filters Bar \*\/\}/, '{/* Filters Bar */}')
  .replace(/setTemplates\(data\.templates \|\| \[\]\);/, 'setTemplates((data.templates || []).filter((t: any) => t.type !== "GUARANTOR_FIRST_NOTICE" && t.type !== "GUARANTOR_ESCALATION"));')
  .replace(/Bulk Reminder Campaign Wizard/g, 'Customer Reminder Campaign');

const customerDir = path.join('src', 'app', '(dashboard)', 'recovery', 'customer-reminders');
fs.mkdirSync(customerDir, { recursive: true });
fs.writeFileSync(path.join(customerDir, 'page.tsx'), customerContent);

let guarantorContent = content
  .replace(/BulkReminderWizardContent/g, 'GuarantorReminderWizardContent')
  .replace(/BulkReminderWizardPage/g, 'GuarantorReminderWizardPage')
  .replace(/const \[activeTab, setActiveTab\] = useState[^;]*;/, 'const activeTab = "GUARANTOR_1";')
  .replace(/\{\/\* Top Tabs \*\/\}[\s\S]*?\{\/\* Filters Bar \*\/\}/, '{/* Filters Bar */}')
  .replace(/setTemplates\(data\.templates \|\| \[\]\);/, 'setTemplates((data.templates || []).filter((t: any) => t.type === "GUARANTOR_FIRST_NOTICE" || t.type === "GUARANTOR_ESCALATION"));')
  .replace(/Bulk Reminder Campaign Wizard/g, 'Guarantor Reminder Campaign');

const guarantorDir = path.join('src', 'app', '(dashboard)', 'recovery', 'guarantor-reminders');
fs.mkdirSync(guarantorDir, { recursive: true });
fs.writeFileSync(path.join(guarantorDir, 'page.tsx'), guarantorContent);

fs.rmSync(path.dirname(srcFile), { recursive: true, force: true });
console.log("Separation successful!");
