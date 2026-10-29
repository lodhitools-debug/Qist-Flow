import React from "react";

export const metadata = {
  title: "Terms of Service | QistFlow",
  description: "Terms of Service for QistFlow and QistBazar Installment Platform",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200 pb-6 mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
          <p className="text-sm text-slate-500 mt-2">
            Last updated: October 2026 | QistFlow & QistBazar
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-6 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">1. Acceptance of Terms</h2>
            <p>
              By utilizing the installment recovery and messaging services provided by QistFlow on behalf of QistBazar, you agree to comply with and be bound by these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">2. Messaging and Notifications</h2>
            <p>
              Customers and authorized guarantors receive periodic WhatsApp reminders concerning installment schedules, payment confirmations, and overdue notices. Recipients may unsubscribe from reminders at any time by replying &quot;STOP&quot;.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">3. Accuracy of Information</h2>
            <p>
              Customers are responsible for ensuring that their contact telephone numbers provided during financing onboarding are accurate and kept up to date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">4. Support & Inquiries</h2>
            <p>
              For support inquiries or assistance with your installment account, please reach out to our recovery officers or contact support@qistflow.vercel.app.
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

