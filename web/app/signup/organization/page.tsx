"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { BrandLogo } from "@/components/common/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDomainLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaxonomySubcategories } from "@/lib/query-hooks";
import { SESSION_COOKIE_KEYS } from "@/lib/session";
import * as liveApi from "@/lib/api/live-api";

const STORAGE_KEY = "pc_signup_org_draft_v1";
const industryOptions = ["Manufacturing", "Mining", "Retail", "Financial Services", "Logistics", "Construction", "Healthcare", "Education", "Technology", "Energy", "Public Sector", "Other"];
const companySizeOptions = ["1-10", "11-50", "51-200", "201-500", "500+"];
const roleOptions = ["Procurement", "Finance", "Operations", "Other"];
const spendOptions = ["< R100k", "R100k-R500k", "R500k-R1m", "R1m-R5m", "R5m+"];
const supplierCountOptions = ["1-10", "11-25", "26-50", "51-100", "100+"];

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

function initialsFromName(name: string) {
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "OR"
  );
}

function emailValid(value: string) {
  return /\S+@\S+\.\S+/.test(value.trim());
}

export default function OrganizationSignupPage() {
  const router = useRouter();
  const taxonomy = useTaxonomySubcategories();

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("ZA");
  const [companySize, setCompanySize] = useState("");
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState("");
  const [monthlyProcurementSpendRange, setMonthlyProcurementSpendRange] = useState("");
  const [mainCategoriesPurchased, setMainCategoriesPurchased] = useState<string[]>([]);
  const [numberOfSuppliersCurrentlyUsed, setNumberOfSuppliersCurrentlyUsed] = useState("");
  const [usesProcurementSystemToday, setUsesProcurementSystemToday] = useState("YES");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Record<string, unknown>;
      setStep(Number(draft.step) || 1);
      setCompanyName(String(draft.companyName ?? ""));
      setRegistrationNumber(String(draft.registrationNumber ?? ""));
      setIndustry(String(draft.industry ?? ""));
      setCountry(String(draft.country ?? "ZA"));
      setCompanySize(String(draft.companySize ?? ""));
      setFullName(String(draft.fullName ?? ""));
      setWorkEmail(String(draft.workEmail ?? ""));
      setPassword(String(draft.password ?? ""));
      setConfirmPassword(String(draft.confirmPassword ?? ""));
      setPhoneNumber(String(draft.phoneNumber ?? ""));
      setRole(String(draft.role ?? ""));
      setMonthlyProcurementSpendRange(String(draft.monthlyProcurementSpendRange ?? ""));
      setMainCategoriesPurchased(Array.isArray(draft.mainCategoriesPurchased) ? draft.mainCategoriesPurchased.map(String) : []);
      setNumberOfSuppliersCurrentlyUsed(String(draft.numberOfSuppliersCurrentlyUsed ?? ""));
      setUsesProcurementSystemToday(String(draft.usesProcurementSystemToday ?? "YES"));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step,
        companyName,
        registrationNumber,
        industry,
        country,
        companySize,
        fullName,
        workEmail,
        password,
        confirmPassword,
        phoneNumber,
        role,
        monthlyProcurementSpendRange,
        mainCategoriesPurchased,
        numberOfSuppliersCurrentlyUsed,
        usesProcurementSystemToday,
      }),
    );
  }, [
    hydrated,
    step,
    companyName,
    registrationNumber,
    industry,
    country,
    companySize,
    fullName,
    workEmail,
    password,
    confirmPassword,
    phoneNumber,
    role,
    monthlyProcurementSpendRange,
    mainCategoriesPurchased,
    numberOfSuppliersCurrentlyUsed,
    usesProcurementSystemToday,
  ]);

  const categoryOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of taxonomy.data ?? []) values.add(row.level1);
    return Array.from(values).sort((a, b) => formatDomainLabel(a).localeCompare(formatDomainLabel(b)));
  }, [taxonomy.data]);

  const stepErrors = useMemo(() => {
    if (step === 1) {
      return {
        companyName: companyName.trim() ? "" : "Company name is required.",
        industry: industry ? "" : "Select an industry.",
        country: country ? "" : "Select a country.",
        companySize: companySize ? "" : "Select a company size.",
      };
    }
    if (step === 2) {
      return {
        fullName: fullName.trim() ? "" : "Full name is required.",
        workEmail: workEmail.trim() ? (emailValid(workEmail) ? "" : "Enter a valid work email.") : "Work email is required.",
        password: password.trim() ? (password.trim().length >= 8 ? "" : "Password must be at least 8 characters.") : "Password is required.",
        confirmPassword:
          confirmPassword.trim()
            ? confirmPassword === password
              ? ""
              : "Passwords do not match."
            : "Confirm your password.",
        role: role ? "" : "Select your role.",
      };
    }
    return {
      monthlyProcurementSpendRange: monthlyProcurementSpendRange ? "" : "Select a monthly procurement spend range.",
      numberOfSuppliersCurrentlyUsed: numberOfSuppliersCurrentlyUsed ? "" : "Select supplier count.",
      mainCategoriesPurchased: mainCategoriesPurchased.length > 0 ? "" : "Select at least one category.",
    };
  }, [
    step,
    companyName,
    industry,
    country,
    companySize,
    fullName,
    workEmail,
    password,
    confirmPassword,
    role,
    monthlyProcurementSpendRange,
    numberOfSuppliersCurrentlyUsed,
    mainCategoriesPurchased,
  ]);

  const stepIsValid = Object.values(stepErrors).every((value) => !value);

  const toggleCategory = (value: string) => {
    setMainCategoriesPurchased((current) =>
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
    );
  };

  const goNext = () => {
    if (!stepIsValid) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setStep((current) => Math.min(3, current + 1));
  };

  const submit = async () => {
    if (!stepIsValid) {
      setShowValidation(true);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await liveApi.signupOrganization({
        companyName,
        registrationNumber: registrationNumber || undefined,
        industry: industry || undefined,
        country,
        companySize: companySize || undefined,
        fullName,
        workEmail,
        password,
        phoneNumber: phoneNumber || undefined,
        role: role || undefined,
        monthlyProcurementSpendRange: monthlyProcurementSpendRange || undefined,
        mainCategoriesPurchased,
        numberOfSuppliersCurrentlyUsed: numberOfSuppliersCurrentlyUsed || undefined,
        usesProcurementSystemToday: usesProcurementSystemToday === "YES",
      });

      window.localStorage.removeItem(STORAGE_KEY);
      setCookie(SESSION_COOKIE_KEYS.portal, "organization");
      setCookie(SESSION_COOKIE_KEYS.tenantId, result.tenantId);
      setCookie(SESSION_COOKIE_KEYS.companyId, result.companyId);
      setCookie(SESSION_COOKIE_KEYS.actorId, result.userId);
      setCookie(SESSION_COOKIE_KEYS.actorName, fullName.trim() || companyName.trim());
      setCookie(SESSION_COOKIE_KEYS.actorInitials, initialsFromName(fullName.trim() || companyName.trim()));
      setCookie(SESSION_COOKIE_KEYS.actorRoles, result.roles.join(","));
      document.cookie = `${SESSION_COOKIE_KEYS.supplierId}=; Path=/; Max-Age=0; SameSite=Lax`;

      toast.success("Organization account created");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err);
      toast.error("Organization signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showError = (key: string) =>
    showValidation ? (((stepErrors as unknown) as Record<string, string | undefined>)[key] ?? "") : "";

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7f6f1_0%,#eef4ff_48%,#e9f8f3_100%)] px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
            <BrandLogo variant="horizontal" className="w-[210px]" imageClassName="w-full" priority />
          </div>
          <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
            <Link href="/login">Back to login</Link>
          </Button>
        </div>

        {error ? <ApiErrorAlert error={error} /> : null}
        {taxonomy.error ? <ApiErrorAlert error={taxonomy.error} /> : null}

        <div className="grid gap-8 lg:grid-cols-[1.02fr_460px]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(155deg,rgba(255,255,255,0.92)_0%,rgba(243,247,255,0.94)_52%,rgba(236,248,243,0.92)_100%)] p-8 shadow-[0_24px_80px_rgba(45,51,74,0.12)] lg:p-10">
            <div className="absolute -right-10 top-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,#c7dcff_0%,rgba(199,220,255,0)_72%)]" />
            <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,#cfeee1_0%,rgba(207,238,225,0)_72%)]" />
            <div className="relative space-y-8">
              <div className="space-y-4">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Create Account</p>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Set up your organization workspace in three steps.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600">
                  Your progress is saved automatically in this browser until you complete signup.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { id: 1, title: "Company", text: "Core company profile and business identity." },
                  { id: 2, title: "Admin Contact", text: "Primary account owner and login credentials." },
                  { id: 3, title: "Procurement", text: "Buying profile and category focus." },
                ].map((item) => (
                  <Card key={item.id} className={`border-white/70 bg-white/80 shadow-sm ${step === item.id ? "ring-2 ring-slate-900/10" : ""}`}>
                    <CardContent className="space-y-3 p-5">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${step >= item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {step > item.id ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-sm font-semibold">{item.id}</span>}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <Card className="border-white/80 bg-white/92 shadow-[0_24px_80px_rgba(45,51,74,0.14)] backdrop-blur">
            <CardContent className="space-y-6 p-7">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Step {step} of 3</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {step === 1 ? "Organization Details" : step === 2 ? "Primary Admin" : "Procurement Profile"}
                </h2>
              </div>

              {step === 1 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-11" placeholder="Acme Procurement Ltd" />
                    {showError("companyName") ? <p className="text-xs text-red-600">{showError("companyName")}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registrationNumber">Registration Number</Label>
                    <Input id="registrationNumber" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className="h-11" placeholder="2026/123456/07" />
                  </div>
                  <div className="space-y-2">
                    <Label>Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select industry" /></SelectTrigger>
                      <SelectContent>{industryOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                    </Select>
                    {showError("industry") ? <p className="text-xs text-red-600">{showError("industry")}</p> : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Select value={country} onValueChange={setCountry}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Select country" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ZA">South Africa</SelectItem>
                          <SelectItem value="BW">Botswana</SelectItem>
                          <SelectItem value="NA">Namibia</SelectItem>
                          <SelectItem value="ZM">Zambia</SelectItem>
                          <SelectItem value="GLOBAL">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {showError("country") ? <p className="text-xs text-red-600">{showError("country")}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Company Size</Label>
                      <Select value={companySize} onValueChange={setCompanySize}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Select size" /></SelectTrigger>
                        <SelectContent>{companySizeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      {showError("companySize") ? <p className="text-xs text-red-600">{showError("companySize")}</p> : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" placeholder="Jane Buyer" />
                    {showError("fullName") ? <p className="text-xs text-red-600">{showError("fullName")}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workEmail">Work Email</Label>
                    <Input id="workEmail" type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} className="h-11" placeholder="jane@acme.com" />
                    {showError("workEmail") ? <p className="text-xs text-red-600">{showError("workEmail")}</p> : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" placeholder="At least 8 characters" />
                      {showError("password") ? <p className="text-xs text-red-600">{showError("password")}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11" placeholder="Repeat password" />
                      {showError("confirmPassword") ? <p className="text-xs text-red-600">{showError("confirmPassword")}</p> : null}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <Input id="phoneNumber" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="h-11" placeholder="+27..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent>{roleOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      {showError("role") ? <p className="text-xs text-red-600">{showError("role")}</p> : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Monthly Procurement Spend</Label>
                      <Select value={monthlyProcurementSpendRange} onValueChange={setMonthlyProcurementSpendRange}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Select spend range" /></SelectTrigger>
                        <SelectContent>{spendOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      {showError("monthlyProcurementSpendRange") ? <p className="text-xs text-red-600">{showError("monthlyProcurementSpendRange")}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Suppliers Currently Used</Label>
                      <Select value={numberOfSuppliersCurrentlyUsed} onValueChange={setNumberOfSuppliersCurrentlyUsed}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Select supplier count" /></SelectTrigger>
                        <SelectContent>{supplierCountOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      {showError("numberOfSuppliersCurrentlyUsed") ? <p className="text-xs text-red-600">{showError("numberOfSuppliersCurrentlyUsed")}</p> : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Do you use a procurement system today?</Label>
                    <Select value={usesProcurementSystemToday} onValueChange={setUsesProcurementSystemToday}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select answer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YES">Yes</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Main Categories Purchased</Label>
                      <p className="text-sm text-slate-500">Select the primary category groups relevant to this organization.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {categoryOptions.map((option) => {
                        const active = mainCategoriesPurchased.includes(option);
                        return (
                          <Button key={option} type="button" variant={active ? "default" : "outline"} className="rounded-full" onClick={() => toggleCategory(option)}>
                            {formatDomainLabel(option)}
                          </Button>
                        );
                      })}
                    </div>
                    {showError("mainCategoriesPurchased") ? <p className="text-xs text-red-600">{showError("mainCategoriesPurchased")}</p> : null}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
                <Button type="button" variant="outline" className="rounded-xl" disabled={step === 1 || isSubmitting} onClick={() => { setShowValidation(false); setStep((current) => Math.max(1, current - 1)); }}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                {step < 3 ? (
                  <Button type="button" className="rounded-xl" onClick={goNext}>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" className="rounded-xl" disabled={isSubmitting} onClick={() => void submit()}>
                    {isSubmitting ? "Creating account..." : "Create Organization Account"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
