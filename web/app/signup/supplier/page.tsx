"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Truck } from "lucide-react";
import { toast } from "sonner";

import { ApiErrorAlert } from "@/components/common/api-error-alert";
import { BrandLogo } from "@/components/common/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDomainLabel, formatSubcategoryLabel } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupplierSignup, useTaxonomySubcategories } from "@/lib/query-hooks";
import { SESSION_COOKIE_KEYS } from "@/lib/session";

const STORAGE_KEY = "pc_signup_supplier_draft_v1";
const employeeOptions = ["1-10", "11-50", "51-200", "201-500", "500+"];
const pricingOptions = ["BUDGET", "MARKET", "PREMIUM"] as const;
const regionOptions = ["Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "National"];

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
      .slice(0, 2) || "SP"
  );
}

function emailValid(value: string) {
  return /\S+@\S+\.\S+/.test(value.trim());
}

export default function SupplierSignupPage() {
  const router = useRouter();
  const signup = useSupplierSignup();
  const taxonomy = useTaxonomySubcategories();

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [yearsInOperation, setYearsInOperation] = useState("");
  const [numberOfEmployees, setNumberOfEmployees] = useState("");
  const [website, setWebsite] = useState("");
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [regionsServed, setRegionsServed] = useState<string[]>([]);
  const [selectedLevel1, setSelectedLevel1] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [completedProjects, setCompletedProjects] = useState("");
  const [maxOrderValue, setMaxOrderValue] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [certifications, setCertifications] = useState("");
  const [hasQualityControlProcess, setHasQualityControlProcess] = useState("YES");
  const [responseTimeHours, setResponseTimeHours] = useState("");
  const [dedicatedAccountManager, setDedicatedAccountManager] = useState("YES");
  const [onTimeDeliveryRate, setOnTimeDeliveryRate] = useState("");
  const [disputeHistory, setDisputeHistory] = useState("NO");
  const [pricingPosition, setPricingPosition] = useState<(typeof pricingOptions)[number] | "">("");
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
      setYearsInOperation(String(draft.yearsInOperation ?? ""));
      setNumberOfEmployees(String(draft.numberOfEmployees ?? ""));
      setWebsite(String(draft.website ?? ""));
      setFullName(String(draft.fullName ?? ""));
      setWorkEmail(String(draft.workEmail ?? ""));
      setPassword(String(draft.password ?? ""));
      setConfirmPassword(String(draft.confirmPassword ?? ""));
      setPhoneNumber(String(draft.phoneNumber ?? ""));
      setRegionsServed(Array.isArray(draft.regionsServed) ? draft.regionsServed.map(String) : []);
      setSelectedLevel1(Array.isArray(draft.selectedLevel1) ? draft.selectedLevel1.map(String) : []);
      setSelectedSubcategories(Array.isArray(draft.selectedSubcategories) ? draft.selectedSubcategories.map(String) : []);
      setCompletedProjects(String(draft.completedProjects ?? ""));
      setMaxOrderValue(String(draft.maxOrderValue ?? ""));
      setLeadTimeDays(String(draft.leadTimeDays ?? ""));
      setCertifications(String(draft.certifications ?? ""));
      setHasQualityControlProcess(String(draft.hasQualityControlProcess ?? "YES"));
      setResponseTimeHours(String(draft.responseTimeHours ?? ""));
      setDedicatedAccountManager(String(draft.dedicatedAccountManager ?? "YES"));
      setOnTimeDeliveryRate(String(draft.onTimeDeliveryRate ?? ""));
      setDisputeHistory(String(draft.disputeHistory ?? "NO"));
      setPricingPosition(String(draft.pricingPosition ?? "") as (typeof pricingOptions)[number] | "");
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
        yearsInOperation,
        numberOfEmployees,
        website,
        fullName,
        workEmail,
        password,
        confirmPassword,
        phoneNumber,
        regionsServed,
        selectedLevel1,
        selectedSubcategories,
        completedProjects,
        maxOrderValue,
        leadTimeDays,
        certifications,
        hasQualityControlProcess,
        responseTimeHours,
        dedicatedAccountManager,
        onTimeDeliveryRate,
        disputeHistory,
        pricingPosition,
      }),
    );
  }, [
    hydrated,
    step,
    companyName,
    registrationNumber,
    yearsInOperation,
    numberOfEmployees,
    website,
    fullName,
    workEmail,
    password,
    confirmPassword,
    phoneNumber,
    regionsServed,
    selectedLevel1,
    selectedSubcategories,
    completedProjects,
    maxOrderValue,
    leadTimeDays,
    certifications,
    hasQualityControlProcess,
    responseTimeHours,
    dedicatedAccountManager,
    onTimeDeliveryRate,
    disputeHistory,
    pricingPosition,
  ]);

  const level1Options = useMemo(() => {
    const values = new Set<string>();
    for (const row of taxonomy.data ?? []) values.add(row.level1);
    return Array.from(values).sort((a, b) => formatDomainLabel(a).localeCompare(formatDomainLabel(b)));
  }, [taxonomy.data]);

  const availableSubcategories = useMemo(() => {
    const rows = taxonomy.data ?? [];
    if (selectedLevel1.length === 0) return rows;
    return rows.filter((row) => selectedLevel1.includes(row.level1));
  }, [selectedLevel1, taxonomy.data]);

  const stepErrors = useMemo(() => {
    if (step === 1) {
      return {
        companyName: companyName.trim() ? "" : "Company name is required.",
        yearsInOperation: yearsInOperation ? "" : "Years in operation is required.",
        numberOfEmployees: numberOfEmployees ? "" : "Select an employee band.",
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
        regionsServed: regionsServed.length > 0 ? "" : "Select at least one region served.",
      };
    }
    if (step === 3) {
      return {
        selectedLevel1: selectedLevel1.length > 0 ? "" : "Select at least one level 1 category.",
        selectedSubcategories: selectedSubcategories.length > 0 ? "" : "Select at least one subcategory.",
      };
    }
    return {
      completedProjects: completedProjects ? "" : "Completed projects is required.",
      leadTimeDays: leadTimeDays ? "" : "Lead time is required.",
      responseTimeHours: responseTimeHours ? "" : "Response time is required.",
      pricingPosition: pricingPosition ? "" : "Select a pricing position.",
    };
  }, [
    step,
    companyName,
    yearsInOperation,
    numberOfEmployees,
    fullName,
    workEmail,
    password,
    confirmPassword,
    regionsServed,
    selectedLevel1,
    selectedSubcategories,
    completedProjects,
    leadTimeDays,
    responseTimeHours,
    pricingPosition,
  ]);

  const stepIsValid = Object.values(stepErrors).every((value) => !value);

  const toggleValue = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  };

  const goNext = () => {
    if (!stepIsValid) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setStep((current) => Math.min(4, current + 1));
  };

  const submit = async () => {
    if (!stepIsValid) {
      setShowValidation(true);
      return;
    }
    try {
      const result = await signup.mutateAsync({
        companyName,
        registrationNumber: registrationNumber || undefined,
        yearsInOperation: yearsInOperation ? Number(yearsInOperation) : undefined,
        numberOfEmployees: numberOfEmployees || undefined,
        regionsServed,
        website: website || undefined,
        fullName: fullName || undefined,
        workEmail,
        password,
        phoneNumber: phoneNumber || undefined,
        categoryIds: selectedLevel1,
        subcategoryIds: selectedSubcategories,
        completedProjects: completedProjects ? Number(completedProjects) : undefined,
        maxOrderValue: maxOrderValue ? Number(maxOrderValue) : undefined,
        leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
        certifications: certifications.split(",").map((entry) => entry.trim()).filter(Boolean),
        hasQualityControlProcess: hasQualityControlProcess === "YES",
        responseTimeHours: responseTimeHours ? Number(responseTimeHours) : undefined,
        dedicatedAccountManager: dedicatedAccountManager === "YES",
        onTimeDeliveryRate: onTimeDeliveryRate ? Number(onTimeDeliveryRate) : undefined,
        disputeHistory: disputeHistory === "YES",
        pricingPosition: pricingPosition || undefined,
      });

      window.localStorage.removeItem(STORAGE_KEY);
      setCookie(SESSION_COOKIE_KEYS.portal, "supplier");
      setCookie(SESSION_COOKIE_KEYS.tenantId, result.tenantId);
      setCookie(SESSION_COOKIE_KEYS.companyId, result.companyId);
      setCookie(SESSION_COOKIE_KEYS.actorId, `supplier-${result.supplierId}`);
      setCookie(SESSION_COOKIE_KEYS.actorName, fullName.trim() || companyName.trim());
      setCookie(SESSION_COOKIE_KEYS.actorInitials, initialsFromName(fullName.trim() || companyName.trim()));
      setCookie(SESSION_COOKIE_KEYS.actorRoles, "SUPPLIER");
      setCookie(SESSION_COOKIE_KEYS.supplierId, result.supplierId);

      toast.success("Supplier account created");
      router.replace("/supplier/profile");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Supplier signup failed");
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

        {signup.error ? <ApiErrorAlert error={signup.error} /> : null}
        {taxonomy.error ? <ApiErrorAlert error={taxonomy.error} /> : null}

        <div className="grid gap-8 lg:grid-cols-[1.02fr_460px]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(155deg,rgba(255,255,255,0.92)_0%,rgba(243,247,255,0.94)_52%,rgba(236,248,243,0.92)_100%)] p-8 shadow-[0_24px_80px_rgba(45,51,74,0.12)] lg:p-10">
            <div className="absolute -right-10 top-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,#c7dcff_0%,rgba(199,220,255,0)_72%)]" />
            <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,#cfeee1_0%,rgba(207,238,225,0)_72%)]" />
            <div className="relative space-y-8">
              <div className="space-y-4">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Create Account</p>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Build your supplier profile in four steps.
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600">
                  Your progress is saved automatically in this browser until you complete signup.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { id: 1, title: "Company", text: "Business identity, tenure, and operating scale." },
                  { id: 2, title: "Primary Contact", text: "Main user profile and login credentials." },
                  { id: 3, title: "Categories", text: "Service families and exact subcategory scope." },
                  { id: 4, title: "Capability", text: "Capacity, delivery, quality, and commercial indicators." },
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
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Step {step} of 4</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {step === 1 ? "Supplier Details" : step === 2 ? "Primary Contact" : step === 3 ? "Category Coverage" : "Capability Profile"}
                </h2>
              </div>

              {step === 1 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-11" placeholder="Sigma Industrial Supplies" />
                    {showError("companyName") ? <p className="text-xs text-red-600">{showError("companyName")}</p> : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Registration Number</Label>
                      <Input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className="h-11" placeholder="2026/654321/07" />
                    </div>
                    <div className="space-y-2">
                      <Label>Website</Label>
                      <Input value={website} onChange={(e) => setWebsite(e.target.value)} className="h-11" placeholder="https://supplier.example" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Years In Operation</Label>
                      <Input type="number" min="0" value={yearsInOperation} onChange={(e) => setYearsInOperation(e.target.value)} className="h-11" />
                      {showError("yearsInOperation") ? <p className="text-xs text-red-600">{showError("yearsInOperation")}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Employees</Label>
                      <Select value={numberOfEmployees} onValueChange={setNumberOfEmployees}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Select employee band" /></SelectTrigger>
                        <SelectContent>{employeeOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      {showError("numberOfEmployees") ? <p className="text-xs text-red-600">{showError("numberOfEmployees")}</p> : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" placeholder="Supplier Admin" />
                    {showError("fullName") ? <p className="text-xs text-red-600">{showError("fullName")}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Work Email</Label>
                    <Input type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} className="h-11" placeholder="admin@supplier.com" />
                    {showError("workEmail") ? <p className="text-xs text-red-600">{showError("workEmail")}</p> : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" placeholder="At least 8 characters" />
                      {showError("password") ? <p className="text-xs text-red-600">{showError("password")}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm Password</Label>
                      <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11" placeholder="Repeat password" />
                      {showError("confirmPassword") ? <p className="text-xs text-red-600">{showError("confirmPassword")}</p> : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="h-11" placeholder="+27..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Regions Served</Label>
                    <div className="flex flex-wrap gap-2">
                      {regionOptions.map((option) => (
                        <Button key={option} type="button" variant={regionsServed.includes(option) ? "default" : "outline"} className="rounded-full" onClick={() => toggleValue(option, regionsServed, setRegionsServed)}>
                          {option}
                        </Button>
                      ))}
                    </div>
                    {showError("regionsServed") ? <p className="text-xs text-red-600">{showError("regionsServed")}</p> : null}
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Level 1 Categories</Label>
                    <p className="text-sm text-slate-500">Choose the primary category families this supplier covers.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {level1Options.map((option) => (
                      <Button key={option} type="button" variant={selectedLevel1.includes(option) ? "default" : "outline"} className="rounded-full" onClick={() => toggleValue(option, selectedLevel1, setSelectedLevel1)}>
                        {formatDomainLabel(option)}
                      </Button>
                    ))}
                  </div>
                  {showError("selectedLevel1") ? <p className="text-xs text-red-600">{showError("selectedLevel1")}</p> : null}
                  <div className="space-y-1">
                    <Label>Subcategories</Label>
                    <p className="text-sm text-slate-500">Select the exact subcategories the supplier should be eligible for.</p>
                  </div>
                  <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap gap-2">
                      {availableSubcategories.map((subcategory) => (
                        <Button key={subcategory.id} type="button" variant={selectedSubcategories.includes(subcategory.id) ? "default" : "outline"} className="rounded-full" onClick={() => toggleValue(subcategory.id, selectedSubcategories, setSelectedSubcategories)}>
                          {formatSubcategoryLabel(subcategory.level3, subcategory.name)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  {showError("selectedSubcategories") ? <p className="text-xs text-red-600">{showError("selectedSubcategories")}</p> : null}
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Completed Projects</Label>
                      <Input type="number" min="0" value={completedProjects} onChange={(e) => setCompletedProjects(e.target.value)} className="h-11" />
                      {showError("completedProjects") ? <p className="text-xs text-red-600">{showError("completedProjects")}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Max Order / Project Value</Label>
                      <Input type="number" min="0" value={maxOrderValue} onChange={(e) => setMaxOrderValue(e.target.value)} className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label>Lead Time (Days)</Label>
                      <Input type="number" min="0" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} className="h-11" />
                      {showError("leadTimeDays") ? <p className="text-xs text-red-600">{showError("leadTimeDays")}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Response Time (Hours)</Label>
                      <Input type="number" min="0" value={responseTimeHours} onChange={(e) => setResponseTimeHours(e.target.value)} className="h-11" />
                      {showError("responseTimeHours") ? <p className="text-xs text-red-600">{showError("responseTimeHours")}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>On-Time Delivery Rate %</Label>
                      <Input type="number" min="0" max="100" value={onTimeDeliveryRate} onChange={(e) => setOnTimeDeliveryRate(e.target.value)} className="h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label>Pricing Position</Label>
                      <Select value={pricingPosition} onValueChange={(value) => setPricingPosition(value as (typeof pricingOptions)[number])}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Select pricing position" /></SelectTrigger>
                        <SelectContent>{pricingOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      {showError("pricingPosition") ? <p className="text-xs text-red-600">{showError("pricingPosition")}</p> : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Certifications</Label>
                    <Input value={certifications} onChange={(e) => setCertifications(e.target.value)} className="h-11" placeholder="ISO 9001, ISO 45001" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Quality Control Process</Label>
                      <Select value={hasQualityControlProcess} onValueChange={setHasQualityControlProcess}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent><SelectItem value="YES">Yes</SelectItem><SelectItem value="NO">No</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Dedicated Account Manager</Label>
                      <Select value={dedicatedAccountManager} onValueChange={setDedicatedAccountManager}>
                        <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent><SelectItem value="YES">Yes</SelectItem><SelectItem value="NO">No</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Dispute History</Label>
                    <Select value={disputeHistory} onValueChange={setDisputeHistory}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="NO">No</SelectItem><SelectItem value="YES">Yes</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
                <Button type="button" variant="outline" className="rounded-xl" disabled={step === 1 || signup.isPending} onClick={() => { setShowValidation(false); setStep((current) => Math.max(1, current - 1)); }}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                {step < 4 ? (
                  <Button type="button" className="rounded-xl" onClick={goNext}>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" className="rounded-xl" disabled={signup.isPending} onClick={() => void submit()}>
                    {signup.isPending ? "Creating supplier..." : "Create Supplier Account"}
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
