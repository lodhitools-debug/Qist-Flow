export interface ExcelColumnMapping {
  account: string;           // e.g. "Account"
  customerName: string;      // e.g. "Customer"
  primaryPhone: string;      // e.g. "Cell Number"
  secondaryPhone?: string;    // e.g. "Cell Number 2"
  cnic?: string;             // e.g. "CNIC"
  webNo?: string;            // e.g. "Web No"
  address?: string;          // e.g. "Address"
  branch?: string;           // e.g. "Branch"
  emi: string;               // e.g. "EMI"
  balance?: string;          // e.g. "Balance"
  shortExcess?: string;      // e.g. "Short/Excess"
  advanceReceived?: string;  // e.g. "Advance Received"
  dueDate: string;           // e.g. "Due Date"
  saleDate?: string;         // e.g. "Sale Date"
  noOfMonths?: string;       // e.g. "No. of Months"
  installmentTotal?: string; // e.g. "Installment Total"
  lastPaymentDate?: string;  // e.g. "Last Payment Date"
  lastPaymentAmount?: string;// e.g. "Last Payment Amount"
  salesPerson?: string;      // e.g. "Sales Person"
  recoveryPerson?: string;   // e.g. "Recovery Person"
  omsRecoveryPerson?: string;// e.g. "OMS Recovery Person"
  comment?: string;          // e.g. "Comment"
  productName?: string;      // e.g. "Product Name"
  brand?: string;            // e.g. "Brand"
  imei1?: string;            // e.g. "IMEI1"
  imei2?: string;            // e.g. "IMEI2"
  guarantor1Name?: string;   // e.g. "Guarantor Name 1"
  guarantor1Phone?: string;  // e.g. "Guarantor 1 Phone"
  guarantor2Name?: string;   // e.g. "Guarantor Name 2"
  guarantor2Phone?: string;  // e.g. "Guarantor 2 Phone"
}

export interface ParsedCustomerRecord {
  rowNumber: number;
  account: string;
  customerName: string;
  primaryPhone: string;
  secondaryPhone?: string;
  cnic?: string;
  webNo?: string;
  address?: string;
  branch: string;
  
  emi: number;
  balance: number;
  shortExcess: number;
  advanceReceived: number;
  dueDate: Date | null;
  saleDate: Date | null;
  noOfMonths: number;
  installmentTotal: number;
  lastPaymentDate: Date | null;
  lastPaymentAmount: number | null;
  
  salesPerson?: string;
  recoveryPerson?: string;
  omsRecoveryPerson?: string;
  comment?: string;
  
  productName?: string;
  brand?: string;
  imei1?: string;
  imei2?: string;
  
  guarantor1Name?: string;
  guarantor1Phone?: string;
  guarantor2Name?: string;
  guarantor2Phone?: string;

  rawRow: Record<string, any>;
  errors: string[];
  isValid: boolean;
  isExisting?: boolean;
}

export interface ImportValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newCustomers: number;
  existingCustomers: number;
  duplicateRecords: number;
  invalidPhoneNumbers: number;
  missingCustomerNames: number;
  missingDueDates: number;
  missingEmi: number;
  errors: Array<{
    rowNumber: number;
    account?: string;
    customerName?: string;
    field: string;
    message: string;
  }>;
  previewRows: ParsedCustomerRecord[];
}
