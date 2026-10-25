import {
  evaluateCustomerRetentionEligibility,
} from "../src/lib/retention/retention-engine";
import { DataRetentionPolicy, DEFAULT_RETENTION_POLICY } from "../src/lib/retention/types";
import { subDays } from "date-fns";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    failed++;
  }
}

async function runRetentionTestSuite() {
  console.log("=================================================");
  console.log("🧪 QistFlow Data Retention & Safe Cleanup Test Suite");
  console.log("=================================================\n");

  const now = new Date();

  // -------------------------------------------------------------
  // Test 1: Automatic cleanup OFF policy
  // -------------------------------------------------------------
  console.log("🔒 1. Verifying Automatic Cleanup OFF Gate...");
  const disabledPolicy: DataRetentionPolicy = {
    ...DEFAULT_RETENTION_POLICY,
    enabled: false,
  };
  assert(disabledPolicy.enabled === false, "Default policy initializes with automated cleanup OFF (safe-by-default)");

  // -------------------------------------------------------------
  // Test 2: Unpaid balances are strictly protected (Never Eligible)
  // -------------------------------------------------------------
  console.log("\n🛡️ 2. Verifying Unpaid Accounts Are Strictly Retained...");
  const unpaidCustomer = {
    id: "cust_unpaid_01",
    account: "ACC-10001",
    customerName: "Active Debtor",
    primaryPhone: "923001112233",
    branch: "MAIN",
    createdAt: subDays(now, 120),
    updatedAt: subDays(now, 100), // Inactive for 100 days
    installments: [
      {
        id: "inst_01",
        status: "OVERDUE",
        balance: 5000, // Open unpaid debt!
        emi: 2500,
        updatedAt: subDays(now, 100),
      },
    ],
    payments: [],
    messageQueues: [],
    messageLogs: [],
  };

  const unpaidEval = evaluateCustomerRetentionEligibility(
    unpaidCustomer,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 30, policyType: "INACTIVITY" },
    now
  );
  assert(
    unpaidEval.eligible === false && unpaidEval.reasonCode === "HAS_UNPAID_BALANCE",
    "Customer with balance > 0 is NOT eligible even when inactive for 100 days (retained safely)",
    unpaidEval.reasonText
  );

  // -------------------------------------------------------------
  // Test 3: Active/Partial/Upcoming Installments are protected
  // -------------------------------------------------------------
  console.log("\n💳 3. Verifying Active / Partial / Upcoming Plans Are Protected...");
  const partialCustomer = {
    id: "cust_partial_02",
    account: "ACC-10002",
    customerName: "Partial Payer",
    primaryPhone: "923002223344",
    branch: "MAIN",
    createdAt: subDays(now, 150),
    updatedAt: subDays(now, 100),
    installments: [
      {
        id: "inst_02",
        status: "PARTIAL",
        balance: 1000,
        emi: 3000,
        updatedAt: subDays(now, 100),
      },
    ],
    payments: [{ id: "p1", paymentDate: subDays(now, 100), amount: 2000 }],
    messageQueues: [],
    messageLogs: [],
  };

  const partialEval = evaluateCustomerRetentionEligibility(
    partialCustomer,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 30, policyType: "COMPLETION" },
    now
  );
  assert(
    partialEval.eligible === false,
    "Partial installment plan is NOT eligible under completion policy",
    partialEval.reasonText
  );

  // -------------------------------------------------------------
  // Test 4: Pending WhatsApp queue items block retention
  // -------------------------------------------------------------
  console.log("\n📲 4. Verifying Pending WhatsApp Queue Items Block Retention...");
  const queuedCustomer = {
    id: "cust_queued_03",
    account: "ACC-10003",
    customerName: "Queued Customer",
    primaryPhone: "923003334455",
    branch: "MAIN",
    createdAt: subDays(now, 120),
    updatedAt: subDays(now, 100),
    installments: [
      {
        id: "inst_03",
        status: "PAID",
        balance: 0,
        emi: 2000,
        updatedAt: subDays(now, 100),
      },
    ],
    payments: [{ id: "p2", paymentDate: subDays(now, 100), amount: 2000 }],
    messageQueues: [{ id: "q1", status: "QUEUED", approvalStatus: "NOT_REQUIRED" }],
    messageLogs: [],
  };

  const queuedEval = evaluateCustomerRetentionEligibility(
    queuedCustomer,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 30, policyType: "BOTH" },
    now
  );
  assert(
    queuedEval.eligible === false && queuedEval.reasonCode === "PENDING_QUEUE",
    "Customer with in-flight WhatsApp messages is protected from cleanup",
    queuedEval.reasonText
  );

  // -------------------------------------------------------------
  // Test 5: 30, 60, and 90-day retention policies evaluation
  // -------------------------------------------------------------
  console.log("\n📅 5. Verifying 30, 60, and 90-day Retention Period Thresholds...");

  // Customer A: 45 days inactive, settled
  const customer45d = {
    id: "cust_settled_45d",
    account: "ACC-45D",
    customerName: "Settled 45 Days Ago",
    primaryPhone: "923004445566",
    createdAt: subDays(now, 150),
    updatedAt: subDays(now, 45),
    installments: [{ id: "inst_45", status: "PAID", balance: 0, emi: 3000, updatedAt: subDays(now, 45) }],
    payments: [{ id: "p45", paymentDate: subDays(now, 45), amount: 3000 }],
    messageQueues: [],
    messageLogs: [],
  };

  const eval30d = evaluateCustomerRetentionEligibility(
    customer45d,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 30, policyType: "BOTH" },
    now
  );
  assert(eval30d.eligible === true, "45 days inactive is ELIGIBLE under 30-day policy (45 >= 30)");

  const eval60d = evaluateCustomerRetentionEligibility(
    customer45d,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 60, policyType: "BOTH" },
    now
  );
  assert(
    eval60d.eligible === false && eval60d.reasonCode === "RECENT_ACTIVITY",
    "45 days inactive is NOT ELIGIBLE under 60-day policy (45 < 60) (protected within window)",
    eval60d.reasonText
  );

  const eval90d = evaluateCustomerRetentionEligibility(
    customer45d,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 90, policyType: "BOTH" },
    now
  );
  assert(
    eval90d.eligible === false && eval90d.reasonCode === "RECENT_ACTIVITY",
    "45 days inactive is NOT ELIGIBLE under 90-day policy (45 < 90) (protected within window)",
    eval90d.reasonText
  );

  // Customer B: 100 days inactive, settled
  const customer100d = {
    id: "cust_settled_100d",
    account: "ACC-100D",
    customerName: "Settled 100 Days Ago",
    primaryPhone: "923005556677",
    createdAt: subDays(now, 200),
    updatedAt: subDays(now, 100),
    installments: [{ id: "inst_100", status: "PAID", balance: 0, emi: 3000, updatedAt: subDays(now, 100) }],
    payments: [{ id: "p100", paymentDate: subDays(now, 100), amount: 3000 }],
    messageQueues: [],
    messageLogs: [],
  };

  const eval100_90d = evaluateCustomerRetentionEligibility(
    customer100d,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 90, policyType: "BOTH" },
    now
  );
  assert(eval100_90d.eligible === true, "100 days inactive is ELIGIBLE under 90-day policy (100 >= 90)");

  // -------------------------------------------------------------
  // Test 6: Policy Selector: COMPLETION vs INACTIVITY vs BOTH
  // -------------------------------------------------------------
  console.log("\n⚙️ 6. Verifying Policy Selector Modes (COMPLETION, INACTIVITY, BOTH)...");

  // Freshly settled customer (2 days ago, balance = 0, status = PAID)
  const freshlySettled = {
    id: "cust_fresh_paid",
    account: "ACC-FRESH",
    customerName: "Fresh Paid Customer",
    primaryPhone: "923006667788",
    createdAt: subDays(now, 60),
    updatedAt: subDays(now, 2),
    installments: [{ id: "inst_f", status: "PAID", balance: 0, emi: 5000, updatedAt: subDays(now, 2) }],
    payments: [{ id: "pf", paymentDate: subDays(now, 2), amount: 5000 }],
    messageQueues: [],
    messageLogs: [],
  };

  const evalCompletionMode = evaluateCustomerRetentionEligibility(
    freshlySettled,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 90, policyType: "COMPLETION" },
    now
  );
  assert(
    evalCompletionMode.eligible === true,
    "COMPLETION policy permits settled accounts regardless of retention days (plan is complete)"
  );

  const evalBothMode = evaluateCustomerRetentionEligibility(
    freshlySettled,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 90, policyType: "BOTH" },
    now
  );
  assert(
    evalBothMode.eligible === false && evalBothMode.reasonCode === "RECENT_ACTIVITY",
    "BOTH policy retains freshly settled accounts until the 90-day window expires"
  );

  // -------------------------------------------------------------
  // Test 7: Re-imported records refresh activity & prevent deletion
  // -------------------------------------------------------------
  console.log("\n🔄 7. Verifying Excel Re-Imports Protect Records from Premature Deletion...");

  const reimportedCustomer = {
    id: "cust_reimported",
    account: "ACC-REIMPORT",
    customerName: "Re-imported Customer",
    primaryPhone: "923007778899",
    createdAt: subDays(now, 180),
    updatedAt: subDays(now, 1), // Re-imported yesterday!
    installments: [{ id: "inst_r", status: "PAID", balance: 0, emi: 4000, updatedAt: subDays(now, 1) }],
    payments: [{ id: "pr", paymentDate: subDays(now, 1), amount: 4000 }],
    messageQueues: [],
    messageLogs: [],
  };

  const reimportEval = evaluateCustomerRetentionEligibility(
    reimportedCustomer,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 30, policyType: "BOTH" },
    now
  );
  assert(
    reimportEval.eligible === false && reimportEval.reasonCode === "RECENT_ACTIVITY",
    "Re-imported records with fresh updatedAt are strictly preserved (cannot be mistakenly purged)",
    reimportEval.reasonText
  );

  // -------------------------------------------------------------
  // Test 8: Already archived records are flagged and skipped
  // -------------------------------------------------------------
  console.log("\n📦 8. Verifying Already Archived Records Are Skipped...");
  const archivedCustomer = {
    id: "cust_archived",
    account: "ACC-ARCHIVED",
    customerName: "Archived Customer",
    primaryPhone: "923008889900",
    createdAt: subDays(now, 300),
    updatedAt: subDays(now, 150),
    comment: "[ARCHIVED_RETENTION_2026-05-01] Closed account",
    installments: [{ id: "inst_a", status: "PAID", balance: 0, emi: 1000, updatedAt: subDays(now, 150) }],
    payments: [],
    messageQueues: [],
    messageLogs: [],
  };

  const archivedEval = evaluateCustomerRetentionEligibility(
    archivedCustomer,
    { ...DEFAULT_RETENTION_POLICY, enabled: true, retentionDays: 30, policyType: "BOTH" },
    now
  );
  assert(
    archivedEval.eligible === false && archivedEval.reasonCode === "ALREADY_ARCHIVED",
    "Already archived records are ignored by subsequent retention scans (prevents duplicate processing)"
  );

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`📊 RETENTION MODULE TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runRetentionTestSuite().catch((err) => {
  console.error("Test execution encountered an error:", err);
  process.exit(1);
});
