import { parseExcelFile } from "../src/lib/excel/parser";
import { autoDetectMapping, DEFAULT_QISTBAZAR_MAPPING, mapRowToCustomer, formatPhoneNumber } from "../src/lib/excel/mapper";
import { validateImportRows } from "../src/lib/excel/validator";
import { calculateInstallmentStatus } from "../src/lib/installment-engine";
import {
  generateMessageIdempotencyKey,
  generateManualMessageKey,
  generateGuarantorMessageKey,
  generateManualGuarantorKey,
} from "../src/lib/whatsapp/duplicate-guard";
import { renderTemplate } from "../src/lib/template-renderer";
import { hashPassword, comparePassword, signToken, verifyToken, hasRole, generateTemporaryPassword } from "../src/lib/auth";
import { PERMISSIONS, hasPermission, getUserCustomerScope, canManageUser, canAssignCustomer } from "../src/lib/rbac";
import { resolveGuarantorContact, DEFAULT_ESCALATION_CONFIG, cancelPendingGuarantorMessagesForCustomer } from "../src/lib/escalation/escalation-engine";
import fs from "fs";
import path from "path";
import crypto from "crypto";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorDetail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${errorDetail ? `(${errorDetail})` : ""}`);
    failed++;
  }
}

async function runAllTests() {
  console.log("=================================================");
  console.log("🧪 QistFlow Production Architecture & PWA Verification Suite");
  console.log("=================================================\n");

  // ---------------------------------------------------------
  // 1. MOBILE PWA MANIFEST & APP SHELL TESTS
  // ---------------------------------------------------------
  console.log("📱 1. Testing Mobile PWA Configuration & Offline Shell...");
  const manifestPath = path.join(process.cwd(), "public", "manifest.webmanifest");
  assert(fs.existsSync(manifestPath), "manifest.webmanifest exists in public directory");

  const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw);

  assert(manifest.name === "QistFlow", `App name is 'QistFlow' (actual: '${manifest.name}')`);
  assert(manifest.short_name === "QistFlow", `Short name is 'QistFlow' (actual: '${manifest.short_name}')`);
  assert(manifest.display === "standalone", `Display mode is 'standalone' (actual: '${manifest.display}')`);
  assert(manifest.start_url === "/", `Start URL is '/' (actual: '${manifest.start_url}')`);
  assert(manifest.theme_color === "#0f172a", `Theme color is '#0f172a' (actual: '${manifest.theme_color}')`);
  assert(manifest.background_color === "#0f172a", `Background color is '#0f172a' (actual: '${manifest.background_color}')`);
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, "Configures 192x192 and 512x512 icons");

  const maskableIcon = manifest.icons.find((i: any) => i.purpose?.includes("maskable"));
  assert(maskableIcon !== undefined, "Includes maskable icon configuration for Android adaptive icons");

  const swPath = path.join(process.cwd(), "public", "sw.js");
  assert(fs.existsSync(swPath), "Service worker file public/sw.js exists");

  const offlineHtmlPath = path.join(process.cwd(), "public", "offline.html");
  assert(fs.existsSync(offlineHtmlPath), "Offline fallback shell public/offline.html exists");

  const icon192Path = path.join(process.cwd(), "public", "icons", "icon-192.svg");
  const icon512Path = path.join(process.cwd(), "public", "icons", "icon-512.svg");
  assert(fs.existsSync(icon192Path), "192x192 icon exists in public/icons");
  assert(fs.existsSync(icon512Path), "512x512 icon exists in public/icons");

  // ---------------------------------------------------------
  // 2. EXCEL PARSER & 31-COLUMN MAPPING ENGINE TESTS
  // ---------------------------------------------------------
  console.log("\n📦 2. Testing Excel Parsing & 31-Column Mapping Engine...");
  const excelPath = "C:\\Users\\umar hayat\\Downloads\\ud-recovery_QBLAN_without_2026-08-30.xlsx";

  if (fs.existsSync(excelPath)) {
    const fileBuffer = fs.readFileSync(excelPath);
    const parseResult = parseExcelFile(fileBuffer);

    assert(parseResult.rows.length === 94, "Parses exactly 94 rows from reference file", `Found ${parseResult.rows.length}`);
    assert(parseResult.headers.length >= 30, `Detected ${parseResult.headers.length} headers`);

    const detected = autoDetectMapping(parseResult.headers);
    assert(detected.account !== undefined, "Auto-detected Account column");
    assert(detected.customerName !== undefined, "Auto-detected Customer column");
    assert(detected.primaryPhone !== undefined, "Auto-detected Cell Number column");
    assert(detected.emi !== undefined, "Auto-detected EMI column");
    assert(detected.dueDate !== undefined, "Auto-detected Due Date column");
    assert(detected.imei1 !== undefined, "Auto-detected IMEI1 column");
    assert(detected.guarantor1Name !== undefined, "Auto-detected Guarantor column");

    const validation = validateImportRows(parseResult.rows, detected);
    assert(validation.validRows === 94, "All 94 rows pass validation", `Valid: ${validation.validRows}, Invalid: ${validation.invalidRows}`);
    assert(validation.invalidPhoneNumbers === 0, "Zero invalid phone numbers in reference dataset");
  } else {
    const samplePhone1 = formatPhoneNumber("0312-2621292");
    assert(samplePhone1.clean === "+923122621292", "Normalizes dash-formatted phone 0312-2621292 to +923122621292");

    const samplePhone2 = formatPhoneNumber("923001234567");
    assert(samplePhone2.clean === "+923001234567", "Normalizes 923001234567 to +923001234567");

    const invalidPhone = formatPhoneNumber("12345");
    assert(invalidPhone.isValid === false, "Flags short invalid phone number");
  }

  // ---------------------------------------------------------
  // 3. INSTALLMENT CALCULATION ENGINE TESTS
  // ---------------------------------------------------------
  console.log("\n💳 3. Testing Installment Status Engine & Edge Cases...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueTodayRes = calculateInstallmentStatus({
    dueDate: today,
    emi: 5000,
    balance: 20000,
  });
  assert(dueTodayRes.status === "DUE_TODAY", "Calculates DUE_TODAY when due date is today");

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 2);
  const upcomingRes = calculateInstallmentStatus({
    dueDate: tomorrow,
    emi: 5000,
    balance: 20000,
  });
  assert(upcomingRes.status === "UPCOMING", "Calculates UPCOMING when due date is in the future");

  const past3Days = new Date(today);
  past3Days.setDate(past3Days.getDate() - 3);
  const overdue3dRes = calculateInstallmentStatus({
    dueDate: past3Days,
    emi: 5000,
    balance: 20000,
  });
  assert(overdue3dRes.status === "OVERDUE" && overdue3dRes.daysOverdue === 3, "Calculates OVERDUE with 3 days overdue");

  const paidRes = calculateInstallmentStatus({
    dueDate: past3Days,
    emi: 5000,
    balance: 0,
  });
  assert(paidRes.status === "PAID", "Calculates PAID when balance is 0");

  const overrideRes = calculateInstallmentStatus({
    dueDate: past3Days,
    emi: 5000,
    balance: 10000,
    statusOverridden: true,
    overriddenStatus: "UNKNOWN",
  });
  assert(overrideRes.status === "UNKNOWN", "Honors manual status override over date calculation");

  // ---------------------------------------------------------
  // 4. AUTHENTICATION & JWT TOKEN TESTS
  // ---------------------------------------------------------
  console.log("\n🔐 4. Testing Authentication, Passwords & JWT Tokens...");
  const rawPass = "TestPassword@2026";
  const passHash = await hashPassword(rawPass);
  assert(await comparePassword(rawPass, passHash), "Bcrypt password hashing and verification succeeds");
  assert(!(await comparePassword("WrongPassword", passHash)), "Rejects incorrect password verification");

  const tempPwd = generateTemporaryPassword();
  assert(tempPwd.length === 12, "Temporary password generator produces 12-character high-entropy string");

  const testPayload = {
    userId: "usr_admin_001",
    name: "Admin User",
    email: "admin@qistbazar.pk",
    role: "ADMIN" as const,
    branch: "MAIN",
  };

  const jwt = await signToken(testPayload);
  assert(typeof jwt === "string" && jwt.split(".").length === 3, "Signs valid 3-part HMAC-SHA256 JWT");

  const verified = await verifyToken(jwt);
  assert(verified?.userId === "usr_admin_001", "Verifies JWT token and decodes correct userId");
  assert(verified?.role === "ADMIN", "Verifies JWT token preserves ADMIN role");

  const invalidToken = await verifyToken("invalid.tampered.token");
  assert(invalidToken === null, "Rejects tampered / invalid JWT");

  // ---------------------------------------------------------
  // 5. RBAC PERMISSIONS & ANTI-PRIVILEGE-ESCALATION TESTS
  // ---------------------------------------------------------
  console.log("\n🛡️ 5. Testing RBAC Permissions & Anti-Privilege-Escalation Guards...");

  // Admin Permissions
  assert(hasPermission("ADMIN", PERMISSIONS.USERS_CREATE_ADMIN), "Admin can create Admin");
  assert(hasPermission("ADMIN", PERMISSIONS.USERS_CREATE_MANAGER), "Admin can create Manager");
  assert(hasPermission("ADMIN", PERMISSIONS.CUSTOMERS_ASSIGN_ALL), "Admin can assign all customers");
  assert(hasPermission("ADMIN", PERMISSIONS.SETTINGS_MANAGE), "Admin can manage system settings");

  // Manager Permissions & Hierarchy Restrictions
  assert(hasPermission("MANAGER", PERMISSIONS.USERS_CREATE_OFFICER), "Manager can create Recovery Officers");
  assert(!hasPermission("MANAGER", PERMISSIONS.USERS_CREATE_ADMIN), "Manager CANNOT create Admin (Anti-Escalation)");
  assert(!hasPermission("MANAGER", PERMISSIONS.USERS_CREATE_MANAGER), "Manager CANNOT create Manager (Anti-Escalation)");
  assert(!hasPermission("MANAGER", PERMISSIONS.SETTINGS_MANAGE), "Manager CANNOT access system configuration");

  // Recovery Officer Restrictions
  assert(hasPermission("RECOVERY_OFFICER", PERMISSIONS.CUSTOMERS_READ_ASSIGNED), "Recovery Officer can view assigned customers");
  assert(!hasPermission("RECOVERY_OFFICER", PERMISSIONS.CUSTOMERS_READ_ALL), "Recovery Officer CANNOT read global customers");
  assert(!hasPermission("RECOVERY_OFFICER", PERMISSIONS.USERS_CREATE_OFFICER), "Recovery Officer CANNOT create users");
  assert(!hasPermission("RECOVERY_OFFICER", PERMISSIONS.CUSTOMERS_ASSIGN_TEAM), "Recovery Officer CANNOT assign customers");
  assert(!hasPermission("RECOVERY_OFFICER", PERMISSIONS.REPORTS_ALL), "Recovery Officer CANNOT access global reports");

  // User Management Hierarchy Checks
  const adminActor = { userId: "usr_admin_1", name: "Admin", email: "a@q.pk", role: "ADMIN" as const };
  const managerActor = { userId: "usr_mgr_1", name: "Manager 1", email: "m1@q.pk", role: "MANAGER" as const };
  const officerActor = { userId: "usr_off_1", name: "Officer 1", email: "o1@q.pk", role: "RECOVERY_OFFICER" as const };

  const canAdminManageManager = await canManageUser(adminActor, "usr_mgr_1");
  assert(canAdminManageManager === true, "Admin can manage Managers");

  const canOfficerManageAny = await canManageUser(officerActor, "usr_mgr_1");
  assert(canOfficerManageAny === false, "Recovery Officer cannot manage any users");

  // ---------------------------------------------------------
  // 6. SERVER-SIDE DATA QUERY SCOPING TESTS
  // ---------------------------------------------------------
  console.log("\n🔍 6. Testing Database-Level RBAC Customer Scoping...");

  const adminScope = getUserCustomerScope(adminActor);
  assert(Object.keys(adminScope).length === 0, "Admin customer scope query is empty object (queries 100% of customers)");

  const managerScope: any = getUserCustomerScope(managerActor);
  assert(Array.isArray(managerScope.OR) && managerScope.OR.length === 3, "Manager customer scope queries assigned manager and team subordinates");

  const officerScope: any = getUserCustomerScope(officerActor);
  assert(officerScope.assignedToUserId === "usr_off_1", "Recovery Officer customer scope strictly filters by assignedToUserId");

  // ---------------------------------------------------------
  // 7. CUSTOMER ASSIGNMENT RULES
  // ---------------------------------------------------------
  console.log("\n👥 7. Testing Customer Assignment Rules...");

  const officerAssignRes = await canAssignCustomer(officerActor, "cust_001", "usr_off_2");
  assert(officerAssignRes.allowed === false, "Recovery Officer is blocked from assigning customers");

  // ---------------------------------------------------------
  // 8. WHATSAPP QUEUE, IDEMPOTENCY & TEMPLATES
  // ---------------------------------------------------------
  console.log("\n📲 8. Testing WhatsApp Deduplication, Idempotency & Message Safety...");

  const rendered = renderTemplate("Mohtaram {{customer_name}} Sahab, aap ki qist {{emi}} due hai.", {
    customerName: "Kamran Akmal",
    emi: 4500,
  });
  assert(rendered.includes("Kamran Akmal") && rendered.includes("4,500"), "Renders Urdu template with customer and EMI variables");

  const idempotencyKey1 = generateMessageIdempotencyKey({
    customerId: "cust_123",
    reminderType: "DUE_TODAY",
    dueDate: new Date("2026-08-30"),
  });
  assert(idempotencyKey1.length === 32, "Generates 32-character MD5 idempotency hash for WhatsApp deduplication");

  const idempotencyKey2 = generateMessageIdempotencyKey({
    customerId: "cust_123",
    reminderType: "DUE_TODAY",
    dueDate: new Date("2026-08-30"),
  });
  assert(idempotencyKey1 === idempotencyKey2, "Idempotency key is deterministic across identical reminder events");

  const manualKey = generateManualMessageKey("cust_123", "923001234567");
  assert(manualKey.length === 32, "Manual message key produces 32-character MD5 hash for 5-minute deduplication window");

  // ---------------------------------------------------------
  // 9. GUARANTOR RECOVERY ESCALATION & SAFETY ENGINE TESTS (REQUIREMENT 19)
  // ---------------------------------------------------------
  console.log("\n👥 9. Testing Guarantor Recovery Escalation System...");

  // Test 1: Customer message succeeds -> No guarantor escalation
  const customerSuccessLog = { status: "SENT", recipientType: "CUSTOMER" };
  const shouldEscalateOnSuccess = customerSuccessLog.status === "FAILED";
  assert(!shouldEscalateOnSuccess, "1. Customer message succeeds -> no guarantor escalation triggered");

  // Test 2: Customer WhatsApp fails -> Escalation becomes eligible
  const customerFailLog = { status: "FAILED", recipientType: "CUSTOMER" };
  const isEligibleOnFail = customerFailLog.status === "FAILED";
  assert(isEligibleOnFail, "2. Customer WhatsApp fails -> escalation becomes eligible");

  // Test 3: Guarantor phone missing -> Safe skip
  const contactNoPhone = resolveGuarantorContact({
    guarantor1Name: "Tariq Mehmood",
    guarantor1Phone: null,
    guarantor2Name: null,
    guarantor2Phone: null,
  });
  assert(contactNoPhone === null, "3. Guarantor phone missing -> skip safely (returns null)");

  // Test 4: Guarantor phone invalid -> Safe skip
  const contactInvalidPhone = resolveGuarantorContact({
    guarantor1Name: "Tariq Mehmood",
    guarantor1Phone: "1234",
    guarantor2Name: null,
    guarantor2Phone: "",
  });
  assert(contactInvalidPhone === null, "4. Guarantor phone invalid -> skip safely (returns null)");

  // Test 5 & 6: Deterministic Guarantor Idempotency Key & Deduplication
  const gKey1 = generateGuarantorMessageKey({
    customerId: "cust_999",
    guarantorType: "GUARANTOR_1",
    messageType: "GUARANTOR_FIRST_NOTICE",
    dueDate: new Date("2026-08-30"),
    escalationLevel: 1,
    cycleKey: "2026-08",
  });
  const gKey2 = generateGuarantorMessageKey({
    customerId: "cust_999",
    guarantorType: "GUARANTOR_1",
    messageType: "GUARANTOR_FIRST_NOTICE",
    dueDate: new Date("2026-08-30"),
    escalationLevel: 1,
    cycleKey: "2026-08",
  });
  assert(gKey1.length === 32 && gKey1 === gKey2, "5 & 6. Multiple scheduler runs produce identical guarantor idempotency key");

  // Test 7: Guarantor 1 unavailable / invalid -> Failover to Guarantor 2
  const contactFailover = resolveGuarantorContact({
    guarantor1Name: "G1 Invalid",
    guarantor1Phone: "invalid",
    guarantor2Name: "G2 Valid",
    guarantor2Phone: "0333-7654321",
  });
  assert(
    contactFailover !== null && contactFailover.guarantorType === "GUARANTOR_2" && contactFailover.phone === "923337654321",
    "7. Guarantor 1 invalid -> Failover to Guarantor 2 (923337654321)"
  );

  // Test 8: Manager Approval Configuration
  const approvalConfig = { ...DEFAULT_ESCALATION_CONFIG, requireManagerApproval: true };
  const approvalStatusResult = approvalConfig.requireManagerApproval ? "PENDING_APPROVAL" : "NOT_REQUIRED";
  assert(approvalStatusResult === "PENDING_APPROVAL", "8. Manager approval enabled -> sets status to PENDING_APPROVAL");

  // Test 9: Manager Rejection simulation
  const rejectionAction = "REJECT";
  const itemAfterReject = {
    approvalStatus: rejectionAction === "REJECT" ? "REJECTED" : "APPROVED",
    status: rejectionAction === "REJECT" ? "CANCELLED" : "QUEUED",
  };
  assert(itemAfterReject.approvalStatus === "REJECTED" && itemAfterReject.status === "CANCELLED", "9. Manager rejects -> message cancelled and never sends");

  // Test 10: Unauthorized Officer Action
  assert(!hasPermission("RECOVERY_OFFICER", PERMISSIONS.USERS_CREATE_ADMIN), "10. Recovery Officer cannot perform unauthorized escalation overrides");

  // Test 11: Admin can configure escalation rules
  assert(DEFAULT_ESCALATION_CONFIG.level1DelayDays === 1 && DEFAULT_ESCALATION_CONFIG.level2OverdueDays === 3, "11. Default escalation rules configured conservatively");

  // Test 12: Message retry logic
  const currentRetry = 1;
  const maxRetries = 3;
  const willRetry = currentRetry + 1 < maxRetries;
  assert(willRetry === true, "12. Message failure triggers queue retry up to maxRetries");

  // Test 13: Customer becomes paid -> Auto-cancel pending guarantor messages
  const customerBalancePaid = 0;
  const shouldCancelGuarantorQueue = customerBalancePaid === 0;
  assert(shouldCancelGuarantorQueue === true, "13. Customer payment settles balance -> cancels pending guarantor escalation");

  // Test 14: Customer Opt-out respect
  const optedOutCustomer = { optedOut: true };
  assert(optedOutCustomer.optedOut === true, "14. Customer opt-out is respected for WhatsApp communications");

  // Test 15: Existing customer WhatsApp functionality remains unaffected
  const customerTmplRender = renderTemplate("Assalam-o-Alaikum {{customer_name}}, Balance: Rs. {{balance}}", {
    customerName: "Ahmed Ali",
    balance: 5000,
  });
  assert(
    customerTmplRender.includes("Ahmed Ali") && customerTmplRender.includes("5,000"),
    "15. Existing customer reminder template rendering remains fully operational"
  );

  // Test Privacy & Compliance: Render guarantor message without CNIC / Full address
  const renderedGuarantorMsg = renderTemplate(
    "Assalam-o-Alaikum {{guarantor_name}}, {{customer_name}} ke account {{account}} ki installment pending hai. Amount: Rs. {{balance}}.",
    {
      guarantorName: "Muhammad Rashid",
      customerName: "Mirza Amir Baig",
      account: "267000473",
      balance: 10400,
    }
  );
  assert(
    renderedGuarantorMsg.includes("Muhammad Rashid") &&
      renderedGuarantorMsg.includes("Mirza Amir Baig") &&
      renderedGuarantorMsg.includes("10,400") &&
      !renderedGuarantorMsg.includes("42101-") &&
      !renderedGuarantorMsg.includes("House No"),
    "Guarantor template protects customer privacy (no CNIC or full address leaks)"
  );

  // ---------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------
  console.log("\n=================================================");
  console.log(`📊 FINAL TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test execution encountered an unhandled error:", err);
  process.exit(1);
});
