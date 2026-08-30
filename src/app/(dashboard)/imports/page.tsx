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
  ShieldCheck,
  RefreshCw,
  Sliders,
  Table,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from "lucide-react";
import clsx from "clsx";

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

      const data = await res.json();
      if (!res.ok) {
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Validation failed");
      }

      setValidationSummary(data.summary);
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

      const data = await res.json();
      if (!res.ok) {
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
      console.error("Failed to download error report", err);
    }
  };

  const updateMappingField = (key: string, headerName: string) => {
    setMapping((prev: any) => ({
      ...prev,
      [key]: headerName,
    }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Steps */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            <span>QistBazar Excel Import Studio</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Import Excel → Column Mapping → Validation → Preview → Snapshot & Process.
          </p>
        </div>

        {/* Step Badges */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className={clsx("px-3 py-1.5 rounded-lg border", step === 1 ? "bg-emerald-50 text-emerald-700 font-bold border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800")}>
            1. Upload
          </span>
          <span>→</span>
          <span className={clsx("px-3 py-1.5 rounded-lg border", step === 2 ? "bg-emerald-50 text-emerald-700 font-bold border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800")}>
            2. Mapping
          </span>
          <span>→</span>
          <span className={clsx("px-3 py-1.5 rounded-lg border", step === 3 ? "bg-emerald-50 text-emerald-700 font-bold border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800")}>
            3. Preview
          </span>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* STEP 1: Upload Excel */}
      {step === 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm text-center space-y-6 animate-in fade-in">
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-12 hover:border-emerald-500/50 transition-colors bg-slate-50/50 dark:bg-slate-800/20 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Upload QistBazar Recovery Report (.xlsx)
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Drag and drop your Excel file here or click browse. Standard reference: <code className="text-emerald-600 dark:text-emerald-400">ud-recovery_QBLAN_without_2026-08-30.xlsx</code>
            </p>

            <label className="mt-6 inline-block">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <span className="cursor-pointer px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all hover:scale-105 inline-flex items-center gap-2">
                {uploadLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                <span>Select Excel File</span>
              </span>
            </label>
          </div>

          <div className="text-xs text-slate-400 flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Automatic pre-import backup snapshot is created before processing data.</span>
          </div>
        </div>
      )}

      {/* STEP 2: Column Mapping */}
      {step === 2 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-500" />
                <span>Excel Column Mapping ({rawRows.length} Rows Found)</span>
              </h2>
              <p className="text-xs text-slate-400">
                All 31 columns from your file <code className="text-slate-600 dark:text-slate-300 font-bold">{fileName}</code> have been auto-matched.
              </p>
            </div>

            <button
              onClick={handleRunValidation}
              disabled={validating}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {validating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>Run Validation Engine</span>
            </button>
          </div>

          {/* Mapping Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: "account", label: "Account Number", required: true },
              { key: "customerName", label: "Customer Name", required: true },
              { key: "primaryPhone", label: "Primary Phone (Cell Number)", required: true },
              { key: "secondaryPhone", label: "Secondary Phone (Cell Number 2)" },
              { key: "cnic", label: "CNIC" },
              { key: "webNo", label: "Web Order No" },
              { key: "address", label: "Address" },
              { key: "branch", label: "Branch" },
              { key: "emi", label: "Monthly EMI", required: true },
              { key: "balance", label: "Remaining Balance" },
              { key: "shortExcess", label: "Short / Excess" },
              { key: "advanceReceived", label: "Advance Received" },
              { key: "dueDate", label: "Due Date", required: true },
              { key: "saleDate", label: "Sale Date" },
              { key: "noOfMonths", label: "No. of Months" },
              { key: "installmentTotal", label: "Installment Total" },
              { key: "lastPaymentDate", label: "Last Payment Date" },
              { key: "lastPaymentAmount", label: "Last Payment Amount" },
              { key: "salesPerson", label: "Sales Person" },
              { key: "recoveryPerson", label: "Recovery Person" },
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Rows</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-1 block">
                {validationSummary.totalRows}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900">
              <span className="text-[10px] uppercase font-bold text-emerald-600 block">Valid Rows</span>
              <span className="text-lg font-bold text-emerald-600 mt-1 block">
                {validationSummary.validRows}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900">
              <span className="text-[10px] uppercase font-bold text-blue-600 block">New Accounts</span>
              <span className="text-lg font-bold text-blue-600 mt-1 block">
                {validationSummary.newCustomers}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Existing Accounts</span>
              <span className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                {validationSummary.existingCustomers}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Duplicates</span>
              <span className="text-lg font-bold text-amber-500 mt-1 block">
                {validationSummary.duplicateRecords}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Invalid Phone</span>
              <span className="text-lg font-bold text-rose-500 mt-1 block">
                {validationSummary.invalidPhoneNumbers}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Missing Data</span>
              <span className="text-lg font-bold text-rose-500 mt-1 block">
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
              const matchesSearch =
                searchQuery.trim() === "" ||
                r.account?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.primaryPhone?.includes(searchQuery);

              const matchesValidity =
                filterValidity === "ALL" ||
                (filterValidity === "VALID" && r.isValid) ||
                (filterValidity === "INVALID" && !r.isValid);

              return matchesSearch && matchesValidity;
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

            return (
              <div className="space-y-4">
                {/* Parsed Rows Preview Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  {/* Header Toolbar */}
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Table className="w-4 h-4 text-emerald-500" />
                        <span>
                          Pre-Import Inspection ({totalFiltered} of {validationSummary.totalRows} Records)
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Browse all {validationSummary.totalRows} rows before final database commit.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Search Box */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search account, name, phone..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="pl-8 pr-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-48 sm:w-60"
                        />
                      </div>

                      {/* Validity Filter */}
                      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterValidity("ALL");
                            setCurrentPage(1);
                          }}
                          className={clsx(
                            "px-2.5 py-1 rounded-md transition-colors",
                            filterValidity === "ALL"
                              ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
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
                              ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                              : "text-slate-500 hover:text-slate-800"
                          )}
                        >
                          Valid ({validationSummary.validRows})
                        </button>
                        {validationSummary.invalidRows > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFilterValidity("INVALID");
                              setCurrentPage(1);
                            }}
                            className={clsx(
                              "px-2.5 py-1 rounded-md transition-colors",
                              filterValidity === "INVALID"
                                ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            )}
                          >
                            Invalid ({validationSummary.invalidRows})
                          </button>
                        )}
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
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={-1}>All ({validationSummary.totalRows})</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Account</th>
                          <th className="py-2.5 px-3">Customer Name</th>
                          <th className="py-2.5 px-3">Clean Phone</th>
                          <th className="py-2.5 px-3">Product</th>
                          <th className="py-2.5 px-3">EMI</th>
                          <th className="py-2.5 px-3">Balance</th>
                          <th className="py-2.5 px-3">Due Date</th>
                          <th className="py-2.5 px-3">Account Type</th>
                          <th className="py-2.5 px-3 text-right">Validity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {paginatedRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                              No customer records match the selected filter or search query.
                            </td>
                          </tr>
                        ) : (
                          paginatedRows.map((r: any) => (
                            <tr
                              key={r.rowNumber}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">#{r.rowNumber}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                {r.account}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                {r.customerName}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                                {r.primaryPhone}
                              </td>
                              <td className="py-2.5 px-3 truncate max-w-[160px] text-slate-600 dark:text-slate-300">
                                {r.productName || "—"}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">Rs. {r.emi}</td>
                              <td className="py-2.5 px-3 font-bold text-rose-600 dark:text-rose-400">
                                Rs. {r.balance}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                                {r.dueDate ? new Date(r.dueDate).toISOString().split("T")[0] : "Invalid"}
                              </td>
                              <td className="py-2.5 px-3">
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
                              <td className="py-2.5 px-3 text-right">
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
                    <div className="text-slate-500 dark:text-slate-400 text-xs">
                      Showing <strong className="text-slate-900 dark:text-white">{startRow}</strong> to{" "}
                      <strong className="text-slate-900 dark:text-white">{endRow}</strong> of{" "}
                      <strong className="text-slate-900 dark:text-white">{totalFiltered}</strong> rows
                      {searchQuery && ` (filtered from ${validationSummary.totalRows} total)`}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={effectivePage === 1}
                          onClick={() => setCurrentPage(1)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="First Page"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={effectivePage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Previous Page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <span className="px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                          Page {effectivePage} of {totalPages}
                        </span>

                        <button
                          type="button"
                          disabled={effectivePage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Next Page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={effectivePage === totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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
