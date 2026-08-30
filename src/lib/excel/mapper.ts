import { ExcelColumnMapping, ParsedCustomerRecord } from "./types";
import { parse, isValid as isDateValid } from "date-fns";

export const DEFAULT_QISTBAZAR_MAPPING: ExcelColumnMapping = {
  account: "Account",
  customerName: "Customer",
  primaryPhone: "Cell Number",
  secondaryPhone: "Cell Number 2",
  address: "Address",
  cnic: "CNIC",
  webNo: "Web No",
  branch: "Branch",
  emi: "EMI",
  balance: "Balance",
  shortExcess: "Short/Excess",
  advanceReceived: "Advance Received",
  dueDate: "Due Date",
  saleDate: "Sale Date",
  noOfMonths: "No. of Months",
  installmentTotal: "Installment Total",
  lastPaymentDate: "Last Payment Date",
  lastPaymentAmount: "Last Payment Amount",
  salesPerson: "Sales Person",
  recoveryPerson: "Recovery Person",
  omsRecoveryPerson: "OMS Recovery Person",
  comment: "Comment",
  productName: "Product Name",
  brand: "Brand",
  imei1: "IMEI1",
  imei2: "IMEI2",
  guarantor1Name: "Guarantor Name 1",
  guarantor1Phone: "Guarantor 1 Phone",
  guarantor2Name: "Guarantor Name 2",
  guarantor2Phone: "Guarantor 2 Phone",
};

/**
 * Automatically detects column mapping from uploaded header strings
 */
export function autoDetectMapping(headers: string[]): ExcelColumnMapping {
  const mapping: Partial<ExcelColumnMapping> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const headerLookup: Record<string, string> = {};
  headers.forEach((h) => {
    headerLookup[normalize(h)] = h;
  });

  const matchCandidates: Record<keyof ExcelColumnMapping, string[]> = {
    account: ["account", "accountno", "accno", "acc", "accountnumber"],
    customerName: ["customer", "customername", "name", "clientname"],
    primaryPhone: ["cellnumber", "cellno", "phonenumber", "phone", "mobile", "contactno"],
    secondaryPhone: ["cellnumber2", "cellno2", "phone2", "secondaryphone", "altphone"],
    cnic: ["cnic", "cnicno", "nic", "identityno"],
    webNo: ["webno", "webnumber", "orderno", "trackingno"],
    address: ["address", "customeraddress", "homeaddress"],
    branch: ["branch", "branchname", "branchcode"],
    emi: ["emi", "installment", "monthlyinstallment", "emiamount"],
    balance: ["balance", "remainingbalance", "outstanding", "balanceamount"],
    shortExcess: ["shortexcess", "shortorsexcess", "short", "excess"],
    advanceReceived: ["advancereceived", "advance", "downpayment"],
    dueDate: ["duedate", "installmentduedate", "qistdate"],
    saleDate: ["saledate", "bookingdate", "purchasedate"],
    noOfMonths: ["noofmonths", "months", "tenure", "duration"],
    installmentTotal: ["installmenttotal", "totalamount", "totalloan"],
    lastPaymentDate: ["lastpaymentdate", "lastpaiddate", "paymentdate"],
    lastPaymentAmount: ["lastpaymentamount", "lastpaidamount", "paidamount"],
    salesPerson: ["salesperson", "salesrep", "agent", "seller"],
    recoveryPerson: ["recoveryperson", "recoveryofficer", "recoveryagent", "officer"],
    omsRecoveryPerson: ["omsrecoveryperson", "omsrecovery", "omsofficer"],
    comment: ["comment", "comments", "remarks", "notes"],
    productName: ["productname", "product", "itemname", "model"],
    brand: ["brand", "company", "make"],
    imei1: ["imei1", "imei", "serial1", "serialnumber"],
    imei2: ["imei2", "serial2"],
    guarantor1Name: ["guarantorname1", "guarantor1", "guarantorname", "g1name"],
    guarantor1Phone: ["guarantor1phone", "guarantorphone1", "g1phone"],
    guarantor2Name: ["guarantorname2", "guarantor2", "g2name"],
    guarantor2Phone: ["guarantor2phone", "guarantorphone2", "g2phone"],
  };

  for (const [key, candidates] of Object.entries(matchCandidates)) {
    for (const cand of candidates) {
      if (headerLookup[cand]) {
        mapping[key as keyof ExcelColumnMapping] = headerLookup[cand];
        break;
      }
    }
  }

  // Fallback to defaults if exact match exists in headers
  for (const [k, defaultHeader] of Object.entries(DEFAULT_QISTBAZAR_MAPPING)) {
    const key = k as keyof ExcelColumnMapping;
    if (!mapping[key] && headers.includes(defaultHeader)) {
      mapping[key] = defaultHeader;
    }
  }

  return mapping as ExcelColumnMapping;
}

/**
 * Cleans and formats phone numbers to standard format (e.g., "923122621292" or "03122621292")
 */
export function formatPhoneNumber(val: any): { raw: string; clean: string; isValid: boolean } {
  if (val === undefined || val === null) return { raw: "", clean: "", isValid: false };
  let str = String(val).trim().replace(/[^0-9]/g, "");

  if (!str) return { raw: "", clean: "", isValid: false };

  // Pakistani numbers:
  // "3122621292" (10 digits starting with 3) -> "923122621292"
  if (str.length === 10 && str.startsWith("3")) {
    str = "92" + str;
  } else if (str.length === 11 && str.startsWith("03")) {
    // "03122621292" -> "923122621292"
    str = "92" + str.substring(1);
  } else if (str.length === 12 && str.startsWith("923")) {
    // Already standard "923122621292"
  } else if (str.length === 13 && str.startsWith("00923")) {
    str = str.substring(2);
  }

  // Valid Pakistani mobile format is 923XXXXXXXXX (12 digits)
  const isValid = /^923[0-9]{9}$/.test(str);
  return {
    raw: String(val),
    clean: str,
    isValid,
  };
}

/**
 * Formats a clean display phone (0312-2621292 or +92 312 2621292)
 */
export function formatDisplayPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("923") && cleaned.length === 12) {
    return `0${cleaned.substring(2, 5)}-${cleaned.substring(5)}`;
  }
  return phone;
}

/**
 * Parses numeric currency / numeric values cleanly
 */
export function parseNumber(val: any, defaultVal = 0): number {
  if (val === undefined || val === null || val === "") return defaultVal;
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;

  const cleanStr = String(val).replace(/Rs\.?|,|\s/gi, "").trim();
  const num = parseFloat(cleanStr);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Parses diverse Excel date formats (Date object, serial number, string like "05-Jul-2026" or "2026-07-05")
 */
export function parseExcelDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && isDateValid(val)) return val;

  // If number, it's an Excel serial date (e.g. 45123)
  if (typeof val === "number" || (!isNaN(Number(val)) && !String(val).includes("-") && !String(val).includes("/"))) {
    const serial = Number(val);
    if (serial > 1000) {
      // Excel base date is 1899-12-30 due to leap year bug
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      if (isDateValid(date_info)) return date_info;
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // Try standard Date parsing
  const directDate = new Date(str);
  if (isDateValid(directDate) && directDate.getFullYear() > 1990 && directDate.getFullYear() < 2100) {
    return directDate;
  }

  // Common custom formats
  const formats = [
    "dd-MMM-yyyy", // "05-Jul-2026"
    "d-MMM-yyyy",  // "5-Jul-2026"
    "dd/MM/yyyy",  // "05/07/2026"
    "d/M/yyyy",
    "yyyy-MM-dd",
    "dd-MM-yyyy",
    "MM/dd/yyyy",
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(str, fmt, new Date());
      if (isDateValid(parsed) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
        return parsed;
      }
    } catch {
      // continue
    }
  }

  return null;
}

/**
 * Maps a single raw row object into a structured ParsedCustomerRecord
 */
export function mapRowToCustomer(
  rawRow: Record<string, any>,
  mapping: ExcelColumnMapping,
  rowNumber: number
): ParsedCustomerRecord {
  const errors: string[] = [];

  const account = String(rawRow[mapping.account] || "").trim();
  const customerName = String(rawRow[mapping.customerName] || "").trim();
  
  const phoneObj = formatPhoneNumber(rawRow[mapping.primaryPhone]);
  const secPhoneObj = mapping.secondaryPhone ? formatPhoneNumber(rawRow[mapping.secondaryPhone]) : { clean: "" };
  
  const emiVal = parseNumber(rawRow[mapping.emi]);
  const balanceVal = mapping.balance ? parseNumber(rawRow[mapping.balance]) : emiVal;
  const shortExcessVal = mapping.shortExcess ? parseNumber(rawRow[mapping.shortExcess]) : 0;
  const advanceVal = mapping.advanceReceived ? parseNumber(rawRow[mapping.advanceReceived]) : 0;
  const totalVal = mapping.installmentTotal ? parseNumber(rawRow[mapping.installmentTotal]) : 0;
  const monthsVal = mapping.noOfMonths ? Math.round(parseNumber(rawRow[mapping.noOfMonths], 12)) : 12;

  const dueDate = parseExcelDate(rawRow[mapping.dueDate]);
  const saleDate = mapping.saleDate ? parseExcelDate(rawRow[mapping.saleDate]) : null;
  const lastPaymentDate = mapping.lastPaymentDate ? parseExcelDate(rawRow[mapping.lastPaymentDate]) : null;
  const lastPaymentAmount = mapping.lastPaymentAmount ? parseNumber(rawRow[mapping.lastPaymentAmount], 0) : null;

  // Validation
  if (!account) {
    errors.push("Account number is required");
  }
  if (!customerName) {
    errors.push("Customer name is required");
  }
  if (!phoneObj.clean || !phoneObj.isValid) {
    errors.push(`Invalid primary phone number: "${phoneObj.raw}"`);
  }
  if (!dueDate) {
    errors.push("Due date is missing or invalid");
  }
  if (emiVal <= 0) {
    errors.push("EMI amount must be greater than 0");
  }

  return {
    rowNumber,
    account,
    customerName,
    primaryPhone: phoneObj.clean,
    secondaryPhone: secPhoneObj.clean || undefined,
    cnic: mapping.cnic && rawRow[mapping.cnic] ? String(rawRow[mapping.cnic]).trim() : undefined,
    webNo: mapping.webNo && rawRow[mapping.webNo] ? String(rawRow[mapping.webNo]).trim() : undefined,
    address: mapping.address && rawRow[mapping.address] ? String(rawRow[mapping.address]).trim() : undefined,
    branch: (mapping.branch && rawRow[mapping.branch] ? String(rawRow[mapping.branch]).trim() : "MAIN") || "MAIN",
    
    emi: emiVal,
    balance: balanceVal,
    shortExcess: shortExcessVal,
    advanceReceived: advanceVal,
    dueDate,
    saleDate,
    noOfMonths: monthsVal,
    installmentTotal: totalVal,
    lastPaymentDate,
    lastPaymentAmount,
    
    salesPerson: mapping.salesPerson && rawRow[mapping.salesPerson] ? String(rawRow[mapping.salesPerson]).trim() : undefined,
    recoveryPerson: mapping.recoveryPerson && rawRow[mapping.recoveryPerson] ? String(rawRow[mapping.recoveryPerson]).trim() : undefined,
    omsRecoveryPerson: mapping.omsRecoveryPerson && rawRow[mapping.omsRecoveryPerson] ? String(rawRow[mapping.omsRecoveryPerson]).trim() : undefined,
    comment: mapping.comment && rawRow[mapping.comment] ? String(rawRow[mapping.comment]).trim() : undefined,
    
    productName: mapping.productName && rawRow[mapping.productName] ? String(rawRow[mapping.productName]).trim() : undefined,
    brand: mapping.brand && rawRow[mapping.brand] ? String(rawRow[mapping.brand]).trim() : undefined,
    imei1: mapping.imei1 && rawRow[mapping.imei1] ? String(rawRow[mapping.imei1]).trim() : undefined,
    imei2: mapping.imei2 && rawRow[mapping.imei2] ? String(rawRow[mapping.imei2]).trim() : undefined,
    
    guarantor1Name: mapping.guarantor1Name && rawRow[mapping.guarantor1Name] ? String(rawRow[mapping.guarantor1Name]).trim() : undefined,
    guarantor1Phone: mapping.guarantor1Phone && rawRow[mapping.guarantor1Phone] ? formatPhoneNumber(rawRow[mapping.guarantor1Phone]).clean : undefined,
    guarantor2Name: mapping.guarantor2Name && rawRow[mapping.guarantor2Name] ? String(rawRow[mapping.guarantor2Name]).trim() : undefined,
    guarantor2Phone: mapping.guarantor2Phone && rawRow[mapping.guarantor2Phone] ? formatPhoneNumber(rawRow[mapping.guarantor2Phone]).clean : undefined,

    rawRow,
    errors,
    isValid: errors.length === 0,
  };
}
