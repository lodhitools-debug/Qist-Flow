"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Building, UserPlus, CreditCard, ChevronRight, 
  CheckCircle2, AlertTriangle, ArrowLeft, RefreshCw 
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

export default function AddTenantPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    businessName: "",
    slug: "",
    country: "Pakistan",
    timezone: "Asia/Karachi",
    
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    ownerPassword: "",

    plan: "TRIAL",
    trialDays: 14
  });

  const generateSlug = (name: string) => {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(100 + Math.random() * 900);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      businessName: name,
      slug: prev.slug === generateSlug(prev.businessName) || prev.slug === "" ? generateSlug(name) : prev.slug
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const nextStep = () => {
    // Basic validation
    if (step === 1 && (!formData.businessName || !formData.slug)) {
      setError("Please fill in required business details");
      return;
    }
    if (step === 2 && (!formData.ownerName || !formData.ownerEmail || !formData.ownerPassword)) {
      setError("Please fill in required admin account details");
      return;
    }
    setError(null);
    setStep(s => s + 1);
  };

  const submitTenant = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/saas/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.businessName,
          slug: formData.slug,
          country: formData.country,
          timezone: formData.timezone,
          adminName: formData.ownerName,
          adminEmail: formData.ownerEmail,
          adminPhone: formData.ownerPhone,
          adminPassword: formData.ownerPassword,
          plan: formData.plan,
          trialDays: formData.trialDays
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to provision tenant");

      router.push("/saas/tenants");
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/saas/tenants" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Provision New Tenant</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create a new isolated environment, admin account, and subscription.
          </p>
        </div>
      </div>

      <div className="max-w-4xl">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-10" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-500 -z-10 transition-all duration-500" style={{ width: `${((step - 1) / 2) * 100}%` }} />
          
          <StepIndicator currentStep={step} stepNumber={1} icon={Building} label="Business Profile" />
          <StepIndicator currentStep={step} stepNumber={2} icon={UserPlus} label="Admin Account" />
          <StepIndicator currentStep={step} stepNumber={3} icon={CreditCard} label="Plan & Billing" />
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl flex gap-3 items-center shadow-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Step 1: Business */}
          {step === 1 && (
            <div className="p-6 md:p-8 animate-in slide-in-from-right-4 fade-in duration-300">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Business Details</h2>
              <div className="space-y-5 max-w-xl">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Business / Company Name <span className="text-rose-500">*</span></label>
                  <input type="text" name="businessName" value={formData.businessName} onChange={handleNameChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" placeholder="e.g. Acme Corporation" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tenant Slug (Unique ID) <span className="text-rose-500">*</span></label>
                  <div className="flex relative">
                    <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-medium">qistflow.com/t/</span>
                    <input type="text" name="slug" value={formData.slug} onChange={handleChange} className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-r-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" placeholder="acme-corp" />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">This forms the unique login URL for the tenant's users.</p>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Country</label>
                    <select name="country" value={formData.country} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                      <option value="Pakistan">Pakistan</option>
                      <option value="UAE">UAE</option>
                      <option value="Saudi Arabia">Saudi Arabia</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Timezone</label>
                    <select name="timezone" value={formData.timezone} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                      <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                      <option value="Asia/Riyadh">Asia/Riyadh (AST)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Admin */}
          {step === 2 && (
            <div className="p-6 md:p-8 animate-in slide-in-from-right-4 fade-in duration-300">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Initial Administrator Account</h2>
              <div className="space-y-5 max-w-xl">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Admin Full Name <span className="text-rose-500">*</span></label>
                  <input type="text" name="ownerName" value={formData.ownerName} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="John Doe" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Address <span className="text-rose-500">*</span></label>
                    <input type="email" name="ownerEmail" value={formData.ownerEmail} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="admin@acme.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Phone Number</label>
                    <input type="text" name="ownerPhone" value={formData.ownerPhone} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="+92 300 1234567" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Temporary Password <span className="text-rose-500">*</span></label>
                  <input type="text" name="ownerPassword" value={formData.ownerPassword} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="SecretPass123!" />
                  <p className="text-xs text-slate-500 mt-1.5">User will be forced to change this upon first login.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Plan */}
          {step === 3 && (
            <div className="p-6 md:p-8 animate-in slide-in-from-right-4 fade-in duration-300">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Subscription & Plan Configuration</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mb-8">
                {['TRIAL', 'ESSENTIAL', 'PRO'].map((plan) => (
                  <label key={plan} className={clsx(
                    "cursor-pointer rounded-2xl p-5 border-2 transition-all",
                    formData.plan === plan ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900 dark:text-white">{plan === 'TRIAL' ? '14-Day Trial' : plan === 'ESSENTIAL' ? 'Essential Plan' : 'Professional Plan'}</span>
                      <div className={clsx("w-5 h-5 rounded-full border-2 flex items-center justify-center", formData.plan === plan ? "border-indigo-500" : "border-slate-300 dark:border-slate-600")}>
                        {formData.plan === plan && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {plan === 'TRIAL' ? 'Full features for 14 days, no credit card required.' : plan === 'ESSENTIAL' ? 'Basic CRM and WhatsApp reminders. Limits apply.' : 'Unlimited templates, priority support, full automation.'}
                    </p>
                    <input type="radio" name="plan" value={plan} className="hidden" checked={formData.plan === plan} onChange={handleChange} />
                  </label>
                ))}
              </div>

              {formData.plan === 'TRIAL' && (
                <div className="max-w-xl">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Trial Duration (Days)</label>
                  <input type="number" name="trialDays" value={formData.trialDays} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" min="1" max="90" />
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="p-6 md:p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex justify-between items-center">
            <button 
              onClick={() => step > 1 ? setStep(s => s - 1) : router.push("/saas/tenants")}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {step > 1 ? "Back" : "Cancel"}
            </button>
            
            {step < 3 ? (
              <button 
                onClick={nextStep}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 transition-all"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={submitTenant}
                disabled={submitting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 transition-all"
              >
                {submitting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Provisioning...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Provision Tenant</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ currentStep, stepNumber, icon: Icon, label }: { currentStep: number, stepNumber: number, icon: any, label: string }) {
  const isCompleted = currentStep > stepNumber;
  const isCurrent = currentStep === stepNumber;
  const isUpcoming = currentStep < stepNumber;

  return (
    <div className="flex flex-col items-center gap-2 relative bg-slate-50 dark:bg-slate-950 px-2 z-10">
      <div className={clsx(
        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2",
        isCompleted ? "bg-indigo-500 border-indigo-500 text-white" :
        isCurrent ? "bg-white dark:bg-slate-900 border-indigo-500 text-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]" :
        "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400"
      )}>
        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      </div>
      <span className={clsx(
        "text-[11px] font-bold uppercase tracking-wider absolute top-12 whitespace-nowrap",
        isCurrent ? "text-indigo-500" : isCompleted ? "text-slate-700 dark:text-slate-300" : "text-slate-400"
      )}>
        {label}
      </span>
    </div>
  );
}
