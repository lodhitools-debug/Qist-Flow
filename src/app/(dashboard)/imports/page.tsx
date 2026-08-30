"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Download,
  Sliders,
  SlidersHorizontal,
  Table,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  X,
  User,
  CreditCard,
  Smartphone,
  Briefcase,
  Users,
  Calendar,
  Layers,
} from "lucide-react";
import clsx from "clsx";

async function safeJsonParse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: `Server HTTP ${res.status}: ${text.slice(0, 250)}`,
    };
  }
}

interface ColumnDef {
  key: string;
  label: string;
  category: "Identity" | "Financials" | "Dates" | "Product" | "Staff" | "Guarantors";
  minWidth: string;
  render: (record: any) => React.ReactNode;
}

const ALL_COLUMNS: ColumnDef[] = [
  {
    key: "account",
    label: "Account",
    category: "Identity",
    minWidth: "130px",
    render: (r) => (
      <span className="font-mono font-bold text-slate-900 dark:text-white">
        {r.account}
      </span>
    ),
  },
  {
    key: "customerName",
    label: "Customer",
    category: "Identity",
    minWidth: "160px",
    render: (r) => (
      <span className="font-semibold text-slate-800 dark:text-slate-200">
        {r.customerName}
      </span>
    ),
  },
  {
    key: "primaryPhone",
    label: "Cell Number",
    category: "Identity",
    minWidth: "130px",
    render: (r) => (
      <span className="font-mono text-slate-600 dark:text-slate-300">
        {r.primaryPhone}
      </span>
    ),
  },
  {
    key: "secondaryPhone",
    label: "Cell Number 2",
    category: "Identity",
    minWidth: "130px",
    render: (r) => (
      <span className="font-mono text-slate-500">
        {r.secondaryPhone || "—"}
      </span>
    ),
  },
  {
    key: "address",
    label: "Address",
    category: "Identity",
    minWidth: "200px",
    render: (r) => (
      <span className="truncate max-w-[190px] block text-slate-600 dark:text-slate-400" title={r.address}>
        {r.address || "—"}
      </span>
    ),
  },
  {
    key: "cnic",
    label: "CNIC",
    category: "Identity",
    minWidth: "140px",
    render: (r) => (
      <span className="font-mono text-slate-600 dark:text-slate-400">
        {r.cnic || "—"}
      </span>
    ),
  },
  {
    key: "webNo",
    label: "Web No",
    category: "Identity",
    minWidth: "120px",
    render: (r) => (
      <span className="font-mono text-slate-500">
        {r.webNo || "—"}
      </span>
    ),
  },
  {
    key: "branch",
    label: "Branch",
    category: "Identity",
    minWidth: "110px",
    render: (r) => (
      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
        {r.branch || "MAIN"}
      </span>
    ),
  },
  {
    key: "emi",
    label: "EMI",
    category: "Financials",
    minWidth: "120px",
    render: (r) => (
      <span className="font-bold text-slate-900 dark:text-white">
        Rs. {r.emi?.toLocaleString()}
      </span>
    ),
  },
  {
    key: "balance",
    label: "Balance",
    category: "Financials",
    minWidth: "120px",
    render: (r) => (
      <span className="font-bold text-rose-600 dark:text-rose-400">
        Rs. {r.balance?.toLocaleString()}
      </span>
    ),
  },
  {
    key: "shortExcess",
    label: "Short/Excess",
    category: "Financials",
    minWidth: "120px",
    render: (r) => (
      <span
        className={clsx(
          "font-semibold",
          r.shortExcess < 0
            ? "text-amber-600 dark:text-amber-400"
            : r.shortExcess > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-slate-400"
        )}
      >
        Rs. {r.shortExcess || 0}
      </span>
    ),
  },
  {
    key: "advanceReceived",
    label: "Advance Received",
    category: "Financials",
    minWidth: "130px",
    render: (r) => (
      <span className="text-slate-600 dark:text-slate-300">
        Rs. {r.advanceReceived?.toLocaleString() || 0}
      </span>
    ),
  },
  {
    key: "dueDate",
    label: "Due Date",
    category: "Dates",
    minWidth: "120px",
    render: (r) => (
      <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
        {r.dueDate ? new Date(r.dueDate).toISOString().split("T")[0] : "Invalid"}
      </span>
    ),
  },
  {
    key: "saleDate",
    label: "Sale Date",
    category: "Dates",
    minWidth: "120px",
    render: (r) => (
      <span className="font-mono text-slate-500">
        {r.saleDate ? new Date(r.saleDate).toISOString().split("T")[0] : "—"}
      </span>
    ),
  },
  {
    key: "noOfMonths",
    label: "No. of Months",
    category: "Financials",
    minWidth: "110px",
    render: (r) => (
      <span className="text-slate-600 dark:text-slate-300">
        {r.noOfMonths || 12} Mo
      </span>
    ),
  },
  {
    key: "installmentTotal",
    label: "Installment Total",
    category: "Financials",
    minWidth: "140px",
    render: (r) => (
      <span className="font-semibold text-slate-800 dark:text-slate-200">
        Rs. {r.installmentTotal?.toLocaleString() || 0}
      </span>
    ),
  },
  {
    key: "lastPaymentDate",
    label: "Last Payment Date",
    category: "Dates",
    minWidth: "140px",
    render: (r) => (
      <span className="font-mono text-slate-500">
        {r.lastPaymentDate ? new Date(r.lastPaymentDate).toISOString().split("T")[0] : "—"}
      </span>
    ),
  },
  {
    key: "lastPaymentAmount",
    label: "Last Payment Amount",
    category: "Financials",
    minWidth: "140px",
    render: (r) => (
      <span className="text-slate-600 dark:text-slate-300">
        {r.lastPaymentAmount ? `Rs. ${r.lastPaymentAmount.toLocaleString()}` : "—"}
      </span>
    ),
  },
  {
    key: "salesPerson",
    label: "Sales Person",
    category: "Staff",
    minWidth: "130px",
    render: (r) => (
      <span className="text-slate-600 dark:text-slate-300">
        {r.salesPerson || "—"}
      </span>
    ),
  },
  {
    key: "recoveryPerson",
    label: "Recovery Person",
    category: "Staff",
    minWidth: "140px",
    render: (r) => (
      <span className="text-slate-600 dark:text-slate-300">
        {r.recoveryPerson || "—"}
      </span>
    ),
  },
  {
    key: "omsRecoveryPerson",
    label: "OMS Recovery Person",
    category: "Staff",
    minWidth: "160px",
    render: (r) => (
      <span className="text-slate-600 dark:text-slate-300">
        {r.omsRecoveryPerson || "—"}
      </span>
    ),
  },
  {
    key: "comment",
    label: "Comment",
    category: "Staff",
    minWidth: "180px",
    render: (r) => (
      <span className="truncate max-w-[180px] block text-slate-500" title={r.comment}>
        {r.comment || "—"}
      </span>
    ),
  },
  {
    key: "productName",
    label: "Product Name",
    category: "Product",
    minWidth: "160px",
    render: (r) => (
      <span className="truncate max-w-[160px] block font-medium text-slate-800 dark:text-slate-200" title={r.productName}>
        {r.productName || "—"}
      </span>
    ),
  },
  {
    key: "brand",
    label: "Brand",
    category: "Product",
    minWidth: "110px",
    render: (r) => (
      <span className="text-slate-600 dark:text-slate-300">
        {r.brand || "—"}
      </span>
    ),
  },
  {
    key: "imei1",
    label: "IMEI1",
    category: "Product",
    minWidth: "150px",
    render: (r) => (
      <span className="font-mono text-xs text-slate-500">
        {r.imei1 || "—"}
      </span>
    ),
  },
  {
    key: "imei2",
    label: "IMEI2",
    category: "Product",
    minWidth: "150px",
    render: (r) => (
      <span className="font-mono text-xs text-slate-500">
        {r.imei2 || "—"}
      </span>
    ),
  },
  {
    key: "guarantor1Name",
    label: "Guarantor Name 1",
    category: "Guarantors",
    minWidth: "150px",
    render: (r) => (
      <span className="text-slate-700 dark:text-slate-300">
        {r.guarantor1Name || "—"}
      </span>
    ),
  },
  {
    key: "guarantor1Phone",
    label: "Guarantor 1 Phone",
    category: "Guarantors",
    minWidth: "130px",
    render: (r) => (
      <span className="font-mono text-slate-500">
        {r.guarantor1Phone || "—"}
      </span>
    ),
  },
  {
    key: "guarantor2Name",
    label: "Guarantor Name 2",
    category: "Guarantors",
    minWidth: "150px",
    render: (r) => (
      <span className="text-slate-700 dark:text-slate-300">
        {r.guarantor2Name || "—"}
      </span>
    ),
  },
  {
    key: "guarantor2Phone",
    label: "Guarantor 2 Phone",
    category: "Guarantors",
    minWidth: "130px",
    render: (r) => (
      <span className="font-mono text-slate-500">
        {r.guarantor2Phone || "—"}
      </span>
    ),
  },
];

const ALL_COLUMN_KEYS = ALL_COLUMNS.map((c) => c.key);

export default function ExcelImportPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Upload, 2: Map, 3: Validate & Preview, 4: Done
  const [file, setFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload response
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<any>({});
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);

  // Validation response
  const [validationSummary, setValidationSummary] = useState<any>(null);
  const [validating, setValidating] = useState(false);

  // Preview Pagination & Filter state
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterValidity, setFilterValidity] = useState<"ALL" | "VALID" | "INVALID">("ALL");

  // Column Selector state (All 30 visible by default)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(ALL_COLUMN_KEYS));
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // View Full Row Modal state
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  // Process response
  const [processing, setProcessing] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const handleFileUpload = async (selectedFile: File) => {
    try {
      setUploadLoading(true);
      setUploadError(null);
      setFile(selectedFile);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/imports/upload", {
        method: "POST",
        body: formData,
      });

      const data = await safeJsonParse(res);
      if (!res.ok || !data.headers) {
        throw new Error(data.error || "Failed to parse Excel file");
      }

      setHeaders(data.headers || []);
      setRawRows(data.rawRows || []);
      setMapping(data.detectedMapping || {});
      setFileName(data.fileName);
      setFileSize(data.fileSize);

      setStep(2); // Go to mapping step
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRunValidation = async () => {
    try {
      setValidating(true);
      const res = await fetch("/api/imports/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rawRows,
          mapping,
        }),
      });

      const data = await safeJsonParse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Validation failed");
      }

      setValidationSummary(data.summary);
      setCurrentPage(1);
      setStep(3); // Go to Preview step
    } catch (err: any) {
      alert("Validation Error: " + err.message);
    } finally {
      setValidating(false);
    }
  };

  const handleProcessImport = async () => {
    try {
      setProcessing(true);
      const res = await fetch("/api/imports/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          fileSize,
          rows: rawRows,
          mapping,
        }),
      });

      const data = await safeJsonParse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Import processing failed");
      }

      setImportResult(data);
      setStep(4);
    } catch (err: any) {
      alert("Import Failed: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadErrors = async () => {
    if (!validationSummary?.errors) return;
    try {
      const res = await fetch("/api/imports/export-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errors: validationSummary.errors,
          rawRows,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `qistflow_errors_${fileName}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      alert("Export failed");
    }
  };

  const updateMappingField = (fieldKey: string, headerValue: string) => {
    setMapping((prev: any) => ({
      ...prev,
      [fieldKey]: headerValue || undefined,
    }));
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllColumns = () => {
    setVisibleColumns(new Set(ALL_COLUMN_KEYS));
  };

  const deselectAllColumns = () => {
    // Keep at least Account & Customer
    setVisibleColumns(new Set(["account", "customerName"]));
  };

  const resetDefaultColumns = () => {
    setVisibleColumns(new Set(ALL_COLUMN_KEYS));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
            <span>Excel Recovery Import</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Import QistBazar installment recovery sheets (31 columns, 94 accounts) into Supabase PostgreSQL.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          {[
            { num: 1, label: "Upload" },
            { num: 2, label: "Mapping" },
            { num: 3, label: "Inspect & Preview" },
            { num: 4, label: "Complete" },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-1.5">
              <span
                className={clsx(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors",
                  step === s.num
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                    : step > s.num
                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                )}
              >
                {step > s.num ? "✓" : s.num}
              </span>
              <span
                className={clsx(
                  step === s.num
                    ? "text-slate-900 dark:text-white font-bold"
                    : "text-slate-400 hidden sm:inline"
                )}
              >
                {s.label}
              </span>
              {s.num < 4 && <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: Upload */}
      {step === 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm text-center space-y-6 max-w-xl mx-auto animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900/50">
            <Upload className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Upload QistBazar Excel Workbook
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Select or drop your standard QistBazar recovery spreadsheet (.xlsx, .xls, .csv).
            </p>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
            }}
            className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-8 bg-slate-50/50 dark:bg-slate-800/30 transition-colors cursor-pointer group"
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
              className="hidden"
              id="file-upload-input"
            />
            <label htmlFor="file-upload-input" className="cursor-pointer block space-y-2">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 group-hover:text-emerald-500 mx-auto transition-colors" />
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Click to browse or drag & drop file here
              </div>
              <div className="text-[11px] text-slate-400">Supports .xlsx, .xls up to 50MB</div>
            </label>
          </div>

          {uploadLoading && (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-600">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span>Analyzing spreadsheet columns & parsing rows...</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Column Mapping */}
      {step === 2 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-500" />
                <span>Verify Excel Column Mapping</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {rawRows.length} rows and {headers.length} headers detected in <strong className="text-slate-800 dark:text-slate-200">{fileName}</strong>
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
              Auto-Matched {Object.keys(mapping).length} of 31 Fields
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[
              { key: "account", label: "Account Number", required: true },
              { key: "customerName", label: "Customer Name", required: true },
              { key: "primaryPhone", label: "Primary Phone (Cell Number)", required: true },
              { key: "secondaryPhone", label: "Secondary Phone (Cell 2)" },
              { key: "emi", label: "EMI (Installment)", required: true },
              { key: "dueDate", label: "Due Date", required: true },
              { key: "balance", label: "Remaining Balance" },
              { key: "shortExcess", label: "Short / Excess" },
              { key: "advanceReceived", label: "Advance Received" },
              { key: "saleDate", label: "Sale Date" },
              { key: "noOfMonths", label: "No. of Months" },
              { key: "installmentTotal", label: "Installment Total" },
              { key: "lastPaymentDate", label: "Last Payment Date" },
              { key: "lastPaymentAmount", label: "Last Payment Amount" },
              { key: "address", label: "Customer Address" },
              { key: "cnic", label: "CNIC Number" },
              { key: "webNo", label: "Web / Tracking No" },
              { key: "branch", label: "Branch Code" },
              { key: "salesPerson", label: "Sales Person" },
              { key: "recoveryPerson", label: "Recovery Person" },
              { key: "omsRecoveryPerson", label: "OMS Recovery Person" },
              { key: "comment", label: "Comment / Remarks" },
              { key: "productName", label: "Product Name" },
              { key: "brand", label: "Brand" },
              { key: "imei1", label: "IMEI 1" },
              { key: "imei2", label: "IMEI 2" },
              { key: "guarantor1Name", label: "Guarantor 1 Name" },
              { key: "guarantor1Phone", label: "Guarantor 1 Phone" },
              { key: "guarantor2Name", label: "Guarantor 2 Name" },
              { key: "guarantor2Phone", label: "Guarantor 2 Phone" },
            ].map((f) => (
              <div key={f.key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{f.label}</span>
                  {f.required && <span className="text-rose-500 font-bold">*Required</span>}
                </label>
                <select
                  value={mapping[f.key] || ""}
                  onChange={(e) => updateMappingField(f.key, e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- Not Mapped --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Upload</span>
            </button>
            <button
              onClick={handleRunValidation}
              disabled={validating}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20"
            >
              <span>Validate & Inspect Rows</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Validation Summary & Row Preview */}
      {step === 3 && validationSummary && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Rows</span>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 block">
                {validationSummary.totalRows}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-indigo-500 block">Total Columns</span>
              <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 block">
                {validationSummary.totalColumns || 31}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block">Valid Rows</span>
              <span className="text-xl font-extrabold text-emerald-600 mt-1 block">
                {validationSummary.validRows}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Invalid Rows</span>
              <span className="text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-1 block">
                {validationSummary.invalidRows}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Duplicates</span>
              <span className="text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-1 block">
                {validationSummary.duplicateRecords}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Missing Data</span>
              <span className="text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-1 block">
                {validationSummary.missingDueDates + validationSummary.missingCustomerNames}
              </span>
            </div>
          </div>

          {/* Error Report Download if any */}
          {validationSummary.errors && validationSummary.errors.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span className="text-xs text-amber-900 dark:text-amber-200 font-semibold">
                  {validationSummary.errors.length} validation issue(s) detected. Valid rows will still be imported.
                </span>
              </div>
              <button
                onClick={handleDownloadErrors}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Error Report (.xlsx)</span>
              </button>
            </div>
          )}

          {/* Filter and Pagination Computations */}
          {(() => {
            const filteredRows = (validationSummary?.previewRows || []).filter((r: any) => {
              if (searchQuery.trim() !== "") {
                const q = searchQuery.toLowerCase();
                const matchesAnyField =
                  r.account?.toLowerCase().includes(q) ||
                  r.customerName?.toLowerCase().includes(q) ||
                  r.primaryPhone?.includes(q) ||
                  r.secondaryPhone?.includes(q) ||
                  r.address?.toLowerCase().includes(q) ||
                  r.cnic?.includes(q) ||
                  r.webNo?.toLowerCase().includes(q) ||
                  r.productName?.toLowerCase().includes(q) ||
                  r.brand?.toLowerCase().includes(q) ||
                  r.imei1?.toLowerCase().includes(q) ||
                  r.imei2?.toLowerCase().includes(q) ||
                  r.salesPerson?.toLowerCase().includes(q) ||
                  r.recoveryPerson?.toLowerCase().includes(q) ||
                  r.omsRecoveryPerson?.toLowerCase().includes(q) ||
                  r.guarantor1Name?.toLowerCase().includes(q) ||
                  r.guarantor2Name?.toLowerCase().includes(q);

                if (!matchesAnyField) return false;
              }

              if (filterValidity === "VALID" && !r.isValid) return false;
              if (filterValidity === "INVALID" && r.isValid) return false;

              return true;
            });

            const totalFiltered = filteredRows.length;
            const totalPages = pageSize === -1 ? 1 : Math.ceil(totalFiltered / pageSize) || 1;
            const effectivePage = Math.min(Math.max(currentPage, 1), totalPages);

            const paginatedRows =
              pageSize === -1
                ? filteredRows
                : filteredRows.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);

            const startRow =
              totalFiltered === 0
                ? 0
                : (effectivePage - 1) * (pageSize === -1 ? totalFiltered : pageSize) + 1;
            const endRow = pageSize === -1 ? totalFiltered : Math.min(effectivePage * pageSize, totalFiltered);

            // Visible columns filter
            const activeColumns = ALL_COLUMNS.filter((c) => visibleColumns.has(c.key));

            return (
              <div className="space-y-4">
                {/* Main Card Container */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Top Bar: Title & Status Banner */}
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Table className="w-4 h-4 text-emerald-500" />
                        <span>PRE-IMPORT INSPECTION ({totalFiltered} OF {validationSummary.totalRows} RECORDS)</span>
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          Showing {startRow}–{endRow} of {totalFiltered} rows
                        </span>
                        <span>•</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          30 mapped columns
                        </span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {validationSummary.validRows} valid rows
                        </span>
                        <span>•</span>
                        <span className="text-slate-500 font-semibold">
                          {validationSummary.invalidRows} invalid rows
                        </span>
                      </div>
                    </div>

                    {/* Toolbar Controls */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Search Box */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search any field..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-40 sm:w-52 shadow-sm"
                        />
                      </div>

                      {/* Validity Filter */}
                      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800 text-[11px] font-semibold shadow-sm">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterValidity("ALL");
                            setCurrentPage(1);
                          }}
                          className={clsx(
                            "px-2.5 py-1 rounded-md transition-colors",
                            filterValidity === "ALL"
                              ? "bg-slate-100 dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          All ({validationSummary.totalRows})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterValidity("VALID");
                            setCurrentPage(1);
                          }}
                          className={clsx(
                            "px-2.5 py-1 rounded-md transition-colors",
                            filterValidity === "VALID"
                              ? "bg-slate-100 dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 font-bold"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          Valid ({validationSummary.validRows})
                        </button>
                      </div>

                      {/* Rows per page Selector */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <span>Rows:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-sm"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={-1}>All ({validationSummary.totalRows})</option>
                        </select>
                      </div>

                      {/* Prominent Columns Selector Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowColumnSelector(!showColumnSelector)}
                          className={clsx(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm transition-all",
                            showColumnSelector
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-600"
                          )}
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Columns ({activeColumns.length}/{ALL_COLUMNS.length})</span>
                        </button>

                        {/* Column Selector Dropdown Menu */}
                        {showColumnSelector && (
                          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95">
                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Show / Hide Columns</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={selectAllColumns}
                                  className="text-[10px] font-bold text-emerald-600 hover:underline"
                                >
                                  Select All
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <button
                                  type="button"
                                  onClick={deselectAllColumns}
                                  className="text-[10px] font-bold text-slate-400 hover:underline"
                                >
                                  Deselect All
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <button
                                  type="button"
                                  onClick={resetDefaultColumns}
                                  className="text-[10px] font-bold text-indigo-600 hover:underline"
                                >
                                  Reset
                                </button>
                              </div>
                            </div>

                            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 my-2 pr-1">
                              {ALL_COLUMNS.map((col) => {
                                const isChecked = visibleColumns.has(col.key);
                                return (
                                  <label
                                    key={col.key}
                                    className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg cursor-pointer text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                                        {col.category}
                                      </span>
                                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                                        {col.label}
                                      </span>
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleColumn(col.key)}
                                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                    />
                                  </label>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={() => setShowColumnSelector(false)}
                              className="w-full py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                            >
                              Apply Columns ({activeColumns.length} Active)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Scroll Guidance Banner */}
                  <div className="px-4 py-2 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>
                        Horizontal Scrolling Active — Scroll right → to inspect all 30 Excel data columns (or click <strong>Inspect</strong> on any row).
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full font-bold">
                      {activeColumns.length} Columns Visible
                    </span>
                  </div>

                  {/* Table with Horizontal Scrollbar */}
                  <div className="overflow-x-auto max-h-[580px] scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                    <table className="w-full text-left text-xs border-collapse min-w-[3400px]">
                      <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] sticky top-0 backdrop-blur-sm z-30">
                        <tr>
                          {/* Sticky Column 1: Row # */}
                          <th className="py-3 px-3 sticky left-0 bg-slate-100 dark:bg-slate-800 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[48px] min-w-[48px]">
                            #
                          </th>

                          {/* Sticky Column 2: Inspect Action */}
                          <th className="py-3 px-3 sticky left-[48px] bg-slate-100 dark:bg-slate-800 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[85px] min-w-[85px] text-center">
                            Inspect
                          </th>

                          {/* Sticky Column 3: Account */}
                          <th className="py-3 px-3 sticky left-[133px] bg-slate-100 dark:bg-slate-800 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[120px] min-w-[120px]">
                            Account
                          </th>

                          {/* Sticky Column 4: Customer Name */}
                          <th className="py-3 px-3 sticky left-[253px] bg-slate-100 dark:bg-slate-800 z-40 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)] w-[160px] min-w-[160px]">
                            Customer
                          </th>

                          {/* Remaining Columns */}
                          {activeColumns
                            .filter((c) => c.key !== "account" && c.key !== "customerName")
                            .map((col) => (
                              <th
                                key={col.key}
                                style={{ minWidth: col.minWidth }}
                                className="py-3 px-3 border-l border-slate-200/50 dark:border-slate-800/50"
                              >
                                {col.label}
                              </th>
                            ))}
                          <th className="py-3 px-3 min-w-[100px] border-l border-slate-200/50 dark:border-slate-800/50">
                            Account Type
                          </th>
                          <th className="py-3 px-3 min-w-[90px] text-right border-l border-slate-200/50 dark:border-slate-800/50">
                            Validity
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {paginatedRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={activeColumns.length + 4}
                              className="py-12 text-center text-slate-400 text-xs"
                            >
                              No customer records match the selected filter or search query.
                            </td>
                          </tr>
                        ) : (
                          paginatedRows.map((r: any) => (
                            <tr
                              key={r.rowNumber}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                            >
                              {/* Sticky Column 1: Row # */}
                              <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] w-[48px] min-w-[48px]">
                                #{r.rowNumber}
                              </td>

                              {/* Sticky Column 2: Inspect Action */}
                              <td className="py-2.5 px-3 text-center sticky left-[48px] bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] w-[85px] min-w-[85px]">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord(r)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800 transition-all shadow-sm"
                                  title="View Full Row (All 31 Fields)"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Inspect</span>
                                </button>
                              </td>

                              {/* Sticky Column 3: Account */}
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white sticky left-[133px] bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] w-[120px] min-w-[120px]">
                                {r.account}
                              </td>

                              {/* Sticky Column 4: Customer Name */}
                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 sticky left-[253px] bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/60 z-20 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] w-[160px] min-w-[160px]">
                                {r.customerName}
                              </td>

                              {/* Remaining Columns */}
                              {activeColumns
                                .filter((c) => c.key !== "account" && c.key !== "customerName")
                                .map((col) => (
                                  <td
                                    key={col.key}
                                    className="py-2.5 px-3 border-l border-slate-100 dark:border-slate-800/50"
                                  >
                                    {col.render(r)}
                                  </td>
                                ))}

                              <td className="py-2.5 px-3 border-l border-slate-100 dark:border-slate-800/50">
                                {r.isExisting ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    Existing
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                    New
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-right border-l border-slate-100 dark:border-slate-800/50">
                                {r.isValid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Valid</span>
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                    title={r.errors?.join(", ")}
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Invalid</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls Bar */}
                  <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900 text-xs">
                    <div className="text-slate-600 dark:text-slate-400 text-xs font-semibold">
                      Showing <strong className="text-slate-900 dark:text-white font-bold">{startRow}–{endRow}</strong> of{" "}
                      <strong className="text-slate-900 dark:text-white font-bold">{totalFiltered}</strong> rows
                      {searchQuery && ` (filtered from ${validationSummary.totalRows} total)`}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={effectivePage === 1}
                          onClick={() => setCurrentPage(1)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                          title="First Page"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={effectivePage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                          title="Previous Page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <span className="px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                          Page {effectivePage} of {totalPages}
                        </span>

                        <button
                          type="button"
                          disabled={effectivePage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                          title="Next Page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={effectivePage === totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                          title="Last Page"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Mapping</span>
            </button>

            <button
              disabled={processing || validationSummary.validRows === 0}
              onClick={handleProcessImport}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all hover:scale-105"
            >
              {processing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Confirm & Import All {validationSummary.validRows} Records</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW FULL ROW MODAL (All 31 Fields Inspection) */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 p-6 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold font-mono">
                  #{selectedRecord.rowNumber}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{selectedRecord.customerName}</span>
                    <span className="font-mono text-xs font-normal text-slate-400">
                      ({selectedRecord.account})
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedRecord.isValid ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        ✓ Valid Record
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700">
                        ⚠ Invalid Record
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">
                      Branch: <strong>{selectedRecord.branch}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Structured Fields Grid */}
            <div className="space-y-4 text-xs">
              {/* Section 1: Customer Profile */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Customer Identity & Contact</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Primary Phone</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {selectedRecord.primaryPhone}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Secondary Phone</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedRecord.secondaryPhone || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">CNIC</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedRecord.cnic || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Web / Order No</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedRecord.webNo || "—"}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-400 block">Address</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {selectedRecord.address || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Financials & Installments */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Loan, Balance & Installment Terms</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Monthly EMI</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      Rs. {selectedRecord.emi?.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Outstanding Balance</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      Rs. {selectedRecord.balance?.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Short / Excess</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Rs. {selectedRecord.shortExcess || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Advance Received</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      Rs. {selectedRecord.advanceReceived?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Installment Total</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Rs. {selectedRecord.installmentTotal?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Tenure (No. of Months)</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {selectedRecord.noOfMonths || 12} Months
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Dates & Payments */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Due Dates & Payment History</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Current Due Date</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {selectedRecord.dueDate ? new Date(selectedRecord.dueDate).toISOString().split("T")[0] : "Invalid"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Sale Date</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedRecord.saleDate ? new Date(selectedRecord.saleDate).toISOString().split("T")[0] : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Last Payment Date</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {selectedRecord.lastPaymentDate ? new Date(selectedRecord.lastPaymentDate).toISOString().split("T")[0] : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Last Payment Amount</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedRecord.lastPaymentAmount ? `Rs. ${selectedRecord.lastPaymentAmount.toLocaleString()}` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 4: Product & Device */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Product & Hardware Serial Numbers</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-400 block">Product Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedRecord.productName || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Brand</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {selectedRecord.brand || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">IMEI 1</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {selectedRecord.imei1 || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 5: Staff & Remarks */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Assigned Staff & Recovery Remarks</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Sales Person</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {selectedRecord.salesPerson || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Recovery Person</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {selectedRecord.recoveryPerson || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">OMS Recovery Person</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {selectedRecord.omsRecoveryPerson || "—"}
                    </span>
                  </div>
                  <div className="sm:col-span-3">
                    <span className="text-[10px] text-slate-400 block">Comment / Notes</span>
                    <span className="text-slate-600 dark:text-slate-300 italic">
                      {selectedRecord.comment || "No special comments."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 6: Guarantors */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Guarantors Information</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Guarantor 1 Name</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {selectedRecord.guarantor1Name || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Guarantor 1 Phone</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {selectedRecord.guarantor1Phone || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Guarantor 2 Name</span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {selectedRecord.guarantor2Name || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Guarantor 2 Phone</span>
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {selectedRecord.guarantor2Phone || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Import Complete */}
      {step === 4 && importResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl text-center space-y-4 max-w-lg mx-auto animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Excel Import Successfully Processed!
          </h2>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Customer profiles, installment schedules, and payment dates have been updated in the database.
          </p>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs text-left space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">File Name:</span>
              <span className="font-bold">{importResult.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Processed Rows:</span>
              <span className="font-bold">{importResult.totalRows}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">New Customer Accounts:</span>
              <span className="font-bold text-blue-600">{importResult.newRecords}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Updated Accounts:</span>
              <span className="font-bold text-emerald-600">{importResult.updatedRecords}</span>
            </div>
          </div>

          <div className="pt-3 flex justify-center gap-3">
            <Link
              href="/customers"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20"
            >
              View Customers Directory
            </Link>
            <Link
              href="/recovery/send-reminders"
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold border border-slate-700"
            >
              Dispatch Reminders
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
