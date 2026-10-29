import React from "react";

export const metadata = {
  title: "Privacy Policy | QistFlow",
  description: "Privacy Policy for QistFlow and QistBazar Installment Recovery Platform",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200 pb-6 mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-2">
            Last updated: October 2026 | QistFlow & QistBazar
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-6 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Overview</h2>
            <p>
              QistFlow (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the installment management and automated communication system for installment financing and customer recovery services on behalf of QistBazar. This Privacy Policy describes how we collect, use, and protect customer and guarantor personal data when sending payment notifications, installment schedules, and transactional reminders via WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">2. Information We Collect</h2>
            <p>
              We collect and process the following customer data strictly for managing installment agreements:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Customer and Guarantor contact details (Name, WhatsApp Phone Number).</li>
              <li>Installment transaction information (Account number, due dates, outstanding installment balance, product details).</li>
              <li>Communication history and delivery logs for compliance and customer dispute resolution.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">3. How We Use WhatsApp Cloud API</h2>
            <p>
              We utilize Meta’s official WhatsApp Cloud API to send transactional messages, installment reminders, payment receipts, and recovery notifications. We comply with all WhatsApp Business Policies:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Messages are sent solely to registered financing customers and authorized guarantors.</li>
              <li>We do not sell, rent, or lease your personal information to third parties.</li>
              <li>Recipients can opt out of automated WhatsApp messages at any time by replying &quot;STOP&quot;.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Data Security</h2>
            <p>
              All customer records and messaging tokens are encrypted in transit using industry-standard TLS cryptographic protocols and stored in secure cloud databases with role-based access control.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">5. Contact Information</h2>
            <p>
              If you have any questions regarding this Privacy Policy or wish to exercise data rights, please contact the QistFlow / QistBazar Recovery Department at support@qistflow.vercel.app.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} QistFlow / QistBazar. All rights reserved.
        </div>
      </div>
    </div>
  );
}

