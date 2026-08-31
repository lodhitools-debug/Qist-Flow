"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  CreditCard,
  Users,
  Send,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import clsx from "clsx";

export default function ReportsPage() {
  const [reportType, setReportType] = useState<"DAILY" | "MONTHLY" | "OFFICERS" | "WHATSAPP" | "GUARANTOR_ESCALATION">("DAILY");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: reportType,
        date: reportDate,
      });

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load report", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, reportDate]);

  const formatPKR = (val: number = 0) => {
    return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(Math.round(val));
  };

  // Export Excel
  const handleExportExcel = () => {
    if (!data) return;

    let sheetData: any[] = [];
    if (reportType === "DAILY" || reportType === "OFFICERS" || reportType === "GUARANTOR_ESCALATION") {
      sheetData = data.rows || [];
    } else if (reportType === "MONTHLY" || reportType === "WHATSAPP") {
      sheetData = [{ ...data.metrics }];
    }

    const ws = XLSX.utils.json_to_sheet(sheetData.length > 0 ? sheetData : [{ Message: "No records" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${reportType}_Report`);
    XLSX.writeFile(wb, `QistFlow_${reportType}_Report_${reportDate}.xlsx`);
  };

  // Export PDF
  const handleExportPDF = () => {
    if (!data) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`QistFlow — ${reportType.replace(/_/g, " ")} Report`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated Date: ${reportDate} | QistBazar Operations`, 14, 25);

    if (reportType === "GUARANTOR_ESCALATION" && data.rows) {
      autoTable(doc, {
        startY: 32,
        head: [["Customer", "Account", "Overdue (PKR)", "Due Date", "Guarantor", "Phone", "Level", "Status", "Sent At", "Officer"]],
        body: data.rows.map((r: any) => [
          r.customerName,
          r.account,
          formatPKR(r.overdueAmount),
          r.dueDate,
          r.guarantorName,
          r.guarantorPhone,
          `Level ${r.escalationLevel}`,
          r.status,
          r.sentAt,
          r.recoveryOfficer,
        ]),
      });
    } else if (reportType === "DAILY" && data.rows) {
      autoTable(doc, {
        startY: 32,
        head: [["Account", "Customer Name", "Phone", "EMI (PKR)", "Balance (PKR)", "Status", "Officer"]],
        body: data.rows.map((r: any) => [
          r.account,
          r.customerName,
          r.phone,
          formatPKR(r.emi),
          formatPKR(r.balance),
          r.status,
          r.recoveryPerson,
        ]),
      });
    } else if (reportType === "OFFICERS" && data.rows) {
      autoTable(doc, {
        startY: 32,
        head: [["Officer Name", "Assigned Accounts", "Due Amount", "Collected Amount", "Overdue", "Efficiency"]],
        body: data.rows.map((r: any) => [
          r.name,
          r.assignedCustomers,
          formatPKR(r.dueAmount),
          formatPKR(r.collectedAmount),
          r.overdueCustomers,
          r.efficiency,
        ]),
      });
    } else if (data.metrics) {
      autoTable(doc, {
        startY: 32,
        head: [["Metric Key", "Metric Value"]],
        body: Object.entries(data.metrics).map(([k, v]) => [k, String(v)]),
      });
    }

    doc.save(`QistFlow_${reportType}_Report_${reportDate}.pdf`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            <span>Recovery Reports & Analytics</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daily recoveries, monthly financial volume, recovery officer performance, and guarantor escalation reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors min-h-[38px]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white border border-slate-700 transition-colors min-h-[38px]"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Filter & Subtabs Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: "DAILY", label: "Daily Report" },
            { id: "MONTHLY", label: "Monthly Recovery" },
            { id: "OFFICERS", label: "Recovery Officers" },
            { id: "GUARANTOR_ESCALATION", label: "Guarantor Escalations" },
            { id: "WHATSAPP", label: "WhatsApp Analytics" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={clsx(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[38px]",
                reportType === tab.id
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-semibold">Reference Date:</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-semibold"
          />
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Generating analytical report...</span>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Guarantor Escalation Report Table */}
          {reportType === "GUARANTOR_ESCALATION" && data.rows && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Guarantor Recovery Escalation Log ({data.rows.length} records)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Account</th>
                      <th className="py-3 px-4">Overdue Amount</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Guarantor</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Level</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Sent At</th>
                      <th className="py-3 px-4">Recovery Officer</th>
                      <th className="py-3 px-4">Manager</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {data.rows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          No guarantor escalation records found.
                        </td>
                      </tr>
                    ) : (
                      data.rows.map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{r.customerName}</td>
                          <td className="py-3 px-4 font-mono font-semibold">{r.account}</td>
                          <td className="py-3 px-4 font-bold text-rose-600">Rs. {formatPKR(r.overdueAmount)}</td>
                          <td className="py-3 px-4 text-slate-500">{r.dueDate}</td>
                          <td className="py-3 px-4 font-semibold text-purple-700 dark:text-purple-300">
                            {r.guarantorName} ({r.guarantorType})
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{r.guarantorPhone}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              Level {r.escalationLevel}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={clsx(
                                "px-2 py-0.5 rounded text-[10px] font-bold",
                                r.status === "SENT" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              )}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">{r.sentAt}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{r.recoveryOfficer}</td>
                          <td className="py-3 px-4 text-slate-500">{r.manager}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Metrics Overview Cards */}
          {reportType === "DAILY" && data.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 block">Total Due Today</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
                  Rs. {formatPKR(data.metrics.totalDue)}
                </span>
                <span className="text-[11px] text-slate-400">{data.metrics.totalDueCount} accounts</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900">
                <span className="text-xs font-semibold text-emerald-600 block">Total Collected</span>
                <span className="text-xl font-bold text-emerald-600 mt-1 block">
                  Rs. {formatPKR(data.metrics.totalCollected)}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold">{data.metrics.recoveryRate}% collection rate</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200 dark:border-rose-900">
                <span className="text-xs font-semibold text-rose-600 block">Total Overdue Portfolio</span>
                <span className="text-xl font-bold text-rose-600 mt-1 block">
                  Rs. {formatPKR(data.metrics.totalOverdue)}
                </span>
                <span className="text-[11px] text-rose-500 font-semibold">{data.metrics.overdueCount} accounts</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 block">WhatsApp Reminders Sent</span>
                <span className="text-xl font-bold text-blue-500 mt-1 block">
                  {data.metrics.waSent}
                </span>
                <span className="text-[11px] text-slate-400">{data.metrics.waFailed} failed</span>
              </div>
            </div>
          )}

          {reportType === "MONTHLY" && data.metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 block">Monthly Installment Volume</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
                  Rs. {formatPKR(data.metrics.totalDueAmount)}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900">
                <span className="text-xs font-semibold text-emerald-600 block">Monthly Collected Amount</span>
                <span className="text-xl font-bold text-emerald-600 mt-1 block">
                  Rs. {formatPKR(data.metrics.totalCollectedAmount)}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 block">Total Portfolio Outstanding</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
                  Rs. {formatPKR(data.metrics.totalOutstanding)}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-blue-900">
                <span className="text-xs font-semibold text-blue-600 block">Monthly Recovery Rate</span>
                <span className="text-xl font-bold text-blue-600 mt-1 block">
                  {data.metrics.recoveryPercentage}%
                </span>
              </div>
            </div>
          )}

          {/* Table Details for OFFICERS */}
          {reportType === "OFFICERS" && data.rows && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Officer Name</th>
                      <th className="py-3 px-4">Assigned Accounts</th>
                      <th className="py-3 px-4">Due Volume</th>
                      <th className="py-3 px-4">Collected Volume</th>
                      <th className="py-3 px-4">Outstanding Balance</th>
                      <th className="py-3 px-4">Overdue Accounts</th>
                      <th className="py-3 px-4">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {data.rows.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{row.name}</td>
                        <td className="py-3 px-4 font-semibold">{row.assignedCustomers}</td>
                        <td className="py-3 px-4 font-medium">Rs. {formatPKR(row.dueAmount)}</td>
                        <td className="py-3 px-4 font-bold text-emerald-600">Rs. {formatPKR(row.collectedAmount)}</td>
                        <td className="py-3 px-4 font-bold text-rose-600">Rs. {formatPKR(row.outstandingAmount)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700">
                            {row.overdueCustomers}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-600">{row.efficiency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table Details for DAILY */}
          {reportType === "DAILY" && data.rows && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                Daily Due Customer Breakdown ({data.rows.length} Accounts)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-400 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Account</th>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">EMI</th>
                      <th className="py-3 px-4">Balance</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Recovery Officer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {data.rows.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">{r.account}</td>
                        <td className="py-3 px-4 font-semibold">{r.customerName}</td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{r.phone}</td>
                        <td className="py-3 px-4 font-bold">Rs. {formatPKR(r.emi)}</td>
                        <td className="py-3 px-4 font-bold text-rose-600">Rs. {formatPKR(r.balance)}</td>
                        <td className="py-3 px-4">{r.status}</td>
                        <td className="py-3 px-4 text-slate-500">{r.recoveryPerson}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
