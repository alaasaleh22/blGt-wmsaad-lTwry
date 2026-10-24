import { type FormEvent, type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronLeft,
  Clipboard, Clock3, Crosshair, FileText, Flame, HeartPulse,
  MapPin, Radio, Send, ShieldCheck, Waves, Activity, Building2, CircleHelp,
} from 'lucide-react';
import {
  getGetReportQueryKey, getGetReportSummaryQueryKey, useCreateReport,
  useGetReport, useGetReportSummary,
} from '@workspace/api-client-react';
import type { Report, ReportInput } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, useParams, Router as WouterRouter, Link } from 'wouter';

const queryClient = new QueryClient();
const incidentOptions = [
  { value: 'fire', label: 'حريق', Icon: Flame },
  { value: 'flood', label: 'سيول أو فيضان', Icon: Waves },
  { value: 'earthquake', label: 'زلزال', Icon: Activity },
  { value: 'medical', label: 'حالة طبية', Icon: HeartPulse },
  { value: 'building', label: 'انهيار أو مبنى', Icon: Building2 },
  { value: 'other', label: 'حالة أخرى', Icon: CircleHelp },
] as const;
const urgencyOptions = [
  { value: 'critical', label: 'خطر مباشر', note: 'توجد إصابة أو تهديد فوري' },
  { value: 'high', label: 'عاجل', note: 'تحتاج الحالة إلى استجابة سريعة' },
  { value: 'normal', label: 'اعتيادي', note: 'لا يوجد خطر مباشر الآن' },
] as const;
const statusSteps = [
  { value: 'received', label: 'تم استلام البلاغ', detail: 'حُفظ البلاغ في النظام.' },
  { value: 'reviewing', label: 'قيد المراجعة', detail: 'يجري التحقق من تفاصيل الحالة' },
  { value: 'dispatched', label: 'تم توجيه المساعدة', detail: 'الفريق المختص في طريقه إليك' },
  { value: 'resolved', label: 'تمت معالجة الحالة', detail: 'أُغلقت الحالة بعد تقديم المساعدة' },
] as const;

function Header() {
  return (
    <header className="topbar sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-home-brand">
          <span className="brand-mark" aria-hidden="true"><Radio size={21} strokeWidth={2.2} /></span>
          <span className="leading-tight">
            <span className="block text-[1.05rem] font-bold tracking-tight">بلاغات الطوارئ</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">أرسل بلاغك وتابع حالته</span>
          </span>
        </Link>
        <div className="hidden items-center gap-2 rounded-full border border-border/80 bg-card/70 px-3 py-2 text-xs font-medium text-muted-foreground sm:flex" data-testid="text-privacy-assurance">
          <ShieldCheck size={15} className="text-primary" />
          بياناتك محفوظة بسرية
        </div>
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-primary no-underline sm:hidden" data-testid="link-submit-report">
          <FileText size={16} /> بلاغ جديد
        </Link>
      </div>
    </header>
  );
}

function SummaryStrip() {
  const { data, isLoading, isError, refetch } = useGetReportSummary();
  const metrics = [
    { label: 'إجمالي البلاغات', value: data?.total, Icon: FileText, tone: 'text-primary' },
    { label: 'حالات قيد المتابعة', value: data?.active, Icon: Activity, tone: 'text-amber-700' },
    { label: 'حالات تمت معالجتها', value: data?.resolved, Icon: CheckCircle2, tone: 'text-emerald-700' },
  ];
  return (
    <section className="panel rounded-2xl p-4 sm:p-5" aria-label="ملخص البلاغات">
      {isError ? (
        <div className="flex min-h-14 items-center justify-between gap-3 text-sm" data-testid="status-summary-error">
          <span className="flex items-center gap-2 text-muted-foreground"><AlertCircle size={17} /> تعذر تحميل ملخص البلاغات.</span>
          <button className="btn-secondary min-h-9 px-3 text-xs" onClick={() => refetch()} data-testid="button-retry-summary">إعادة المحاولة</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-x-reverse">
          {metrics.map(({ label, value, Icon, tone }, index) => (
            <div key={label} className={`flex items-center gap-3 py-3 sm:px-5 sm:py-1 ${index === 0 ? 'sm:pr-0' : ''} ${index === 2 ? 'sm:pl-0' : ''}`} data-testid={`metric-report-${index}`}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary ${tone}`}><Icon size={19} /></span>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                {isLoading ? <div className="skeleton mt-1.5 h-6 w-12" /> : <p className="mt-0.5 text-xl font-bold tabular-nums" data-testid={`value-report-${index}`}>{value ?? '—'}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LookupPanel() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) { setError('أدخل رمز التتبع للمتابعة.'); return; }
    setError('');
    setLocation(`/track/${encodeURIComponent(value)}`);
  };
  return (
    <section className="panel rounded-2xl p-5 sm:p-6" data-testid="panel-track-report">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Clipboard size={19} /></span>
        <div>
          <h2 className="text-base font-bold">تابع بلاغاً سابقاً</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">أدخل رمز التتبع الخاص الذي ظهر لك بعد إرسال البلاغ. احتفظ به ولا تشاركه.</p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <label className="sr-only" htmlFor="tracking-code">رمز التتبع</label>
        <input id="tracking-code" className="field min-w-0 flex-1" value={code} onChange={(e) => { setCode(e.target.value); setError(''); }} placeholder="مثال: ER-7K2P9" dir="ltr" autoComplete="off" data-testid="input-tracking-code" />
        <button className="btn-primary shrink-0" type="submit" data-testid="button-lookup-report">عرض حالة البلاغ <ArrowLeft size={17} /></button>
      </form>
      {error && <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive" role="alert" data-testid="status-lookup-error"><AlertCircle size={15} />{error}</p>}
    </section>
  );
}

function ReportForm() {
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const mutation = useCreateReport();
  const [incidentType, setIncidentType] = useState<ReportInput['incidentType'] | ''>('');
  const [urgency, setUrgency] = useState<ReportInput['urgency']>('high');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoMessage, setGeoMessage] = useState('');
  const [formError, setFormError] = useState('');

  const locate = () => {
    if (!navigator.geolocation) { setGeoMessage('الموقع التلقائي غير متاح على هذا الجهاز.'); return; }
    setGeoMessage('جارٍ تحديد موقعك…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setCoordinates({ latitude: coords.latitude, longitude: coords.longitude }); setGeoMessage('تم تحديد موقعك وإرفاقه بالبلاغ.'); },
      () => setGeoMessage('تعذر تحديد الموقع. يمكنك كتابة وصف المكان يدوياً.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!incidentType) { setFormError('اختر نوع الحالة أولاً.'); return; }
    if (description.trim().length < 10) { setFormError('اكتب وصفاً من ١٠ أحرف على الأقل لتوضيح الحالة.'); return; }
    if (locationText.trim().length < 3) { setFormError('اكتب موقع الحالة بوضوح ليسهل الوصول إليك.'); return; }
    const data: ReportInput = {
      incidentType,
      urgency,
      description: description.trim(),
      locationText: locationText.trim(),
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      contactName: contactName.trim() || null,
      contactPhone: contactPhone.trim() || null,
    };
    mutation.mutate({ data }, {
      onSuccess: (report) => {
        client.invalidateQueries({ queryKey: getGetReportSummaryQueryKey() });
        client.setQueryData(getGetReportQueryKey(report.trackingCode), report);
        setLocation(`/track/${encodeURIComponent(report.trackingCode)}`);
      },
      onError: () => setFormError('لم نتمكن من إرسال البلاغ الآن. تحقق من اتصالك وحاول مجدداً.'),
    });
  };
  return (
    <section className="panel rounded-2xl p-5 sm:p-7" id="new-report" data-testid="panel-new-report">
      <div className="mb-6 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Send size={20} /></span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">أرسل بلاغاً جديداً</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">شارك التفاصيل الأساسية. سيظهر لك رمز خاص بعد الحفظ لتتمكن من متابعة حالة البلاغ.</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-6" noValidate>
        <fieldset>
          <legend className="mb-3 text-sm font-bold">ما نوع الحالة؟ <span className="text-destructive">*</span></legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {incidentOptions.map(({ value, label, Icon }) => (
              <label key={value} className="choice cursor-pointer text-sm font-medium" data-testid={`choice-incident-${value}`}>
                <input type="radio" name="incidentType" value={value} checked={incidentType === value} onChange={() => setIncidentType(value)} data-testid={`input-incident-${value}`} />
                <Icon size={17} className={incidentType === value ? 'text-primary' : 'text-muted-foreground'} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="report-description" className="mb-2 block text-sm font-bold">صف ما حدث <span className="text-destructive">*</span></label>
          <textarea id="report-description" className="field min-h-28 resize-y leading-7" value={description} onChange={(e) => setDescription(e.target.value)} minLength={10} maxLength={2000} placeholder="اذكر ما حدث، وعدد الأشخاص المتأثرين، وأي تفاصيل تساعد فريق الاستجابة…" data-testid="input-report-description" />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>لا تشارك معلومات غير ضرورية.</span><span className="mono">{description.length}/2000</span></div>
        </div>

        <fieldset>
          <legend className="mb-3 text-sm font-bold">درجة الاستعجال</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {urgencyOptions.map(({ value, label, note }) => (
              <label key={value} className="choice cursor-pointer items-start" data-testid={`choice-urgency-${value}`}>
                <input className="mt-1" type="radio" name="urgency" value={value} checked={urgency === value} onChange={() => setUrgency(value)} data-testid={`input-urgency-${value}`} />
                <span><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{note}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="report-location" className="mb-2 block text-sm font-bold">أين تقع الحالة؟ <span className="text-destructive">*</span></label>
          <div className="relative">
            <MapPin className="absolute right-3 top-3.5 text-muted-foreground" size={18} />
            <input id="report-location" className="field pr-10" value={locationText} onChange={(e) => setLocationText(e.target.value)} maxLength={300} placeholder="المدينة، الحي، الشارع أو أقرب معلم" data-testid="input-report-location" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={locate} data-testid="button-use-location"><Crosshair size={14} /> تحديد موقعي</button>
            {geoMessage && <span className="text-xs text-muted-foreground" role="status" data-testid="status-location">{geoMessage}</span>}
          </div>
        </div>

        <details className="group rounded-xl border border-border/80 bg-secondary/35 p-4">
          <summary className="cursor-pointer list-none text-sm font-bold marker:hidden" data-testid="toggle-contact-details">
            <span className="flex items-center justify-between">بيانات للتواصل <span className="text-xs font-normal text-muted-foreground">اختياري</span></span>
            <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">يساعدنا رقمك على الوصول إليك عند الحاجة، ويظل سرياً.</span>
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="contact-name" className="mb-1.5 block text-xs font-semibold">الاسم</label><input id="contact-name" className="field min-h-11 bg-card" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={100} placeholder="اسمك" data-testid="input-contact-name" /></div>
            <div><label htmlFor="contact-phone" className="mb-1.5 block text-xs font-semibold">رقم الهاتف</label><input id="contact-phone" className="field min-h-11 bg-card" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={30} type="tel" inputMode="tel" dir="auto" placeholder="رقم يمكن التواصل معك عليه" data-testid="input-contact-phone" /></div>
          </div>
        </details>

        {formError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm leading-6 text-destructive" data-testid="status-report-error"><AlertCircle className="mt-1 shrink-0" size={17} />{formError}</div>}
        <button type="submit" disabled={mutation.isPending} className="btn-primary w-full text-base" data-testid="button-submit-report">
          {mutation.isPending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-l-transparent" /> جارٍ إرسال البلاغ…</> : <>إرسال البلاغ <ArrowLeft size={18} /></>}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-muted-foreground"><ShieldCheck size={14} className="shrink-0 text-primary" /> سيظهر لك رمز خاص لتتبع البلاغ بعد الإرسال. احتفظ به للرجوع إليه.</p>
      </form>
    </section>
  );
}

function Home() {
  return (
    <div className="app-shell" dir="rtl">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-6 sm:pt-11">
        <div className="page-enter grid gap-7 lg:grid-cols-[minmax(0,1.42fr)_minmax(19rem,.78fr)] lg:items-start lg:gap-8">
          <div>
            <div className="mb-6 max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary" data-testid="text-service-status"><span className="status-dot" /> خدمة استقبال البلاغات</div>
              <h1 className="text-[2rem] font-bold leading-[1.45] tracking-tight sm:text-[2.8rem] sm:leading-[1.4]">حين تحتاج إلى المساعدة،<br /><span className="text-primary">سجّل الحالة بخطوات واضحة.</span></h1>
              <p className="mt-3 max-w-xl text-[.98rem] leading-8 text-muted-foreground sm:text-base">أرسل تفاصيل الحالة وموقعها. يُحفظ البلاغ ويظهر لك رمز خاص لمتابعة حالته.</p>
            </div>
            <ReportForm />
          </div>
          <aside className="space-y-4 lg:sticky lg:top-24">
            <SummaryStrip />
            <LookupPanel />
            <div className="rounded-2xl border border-amber-800/10 bg-[hsl(39,65%,91%)] p-5" data-testid="notice-emergency">
              <div className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-900/10 text-amber-900"><AlertCircle size={18} /></span>
                <div><h2 className="text-sm font-bold text-amber-950">في خطر يهدد الحياة الآن؟</h2><p className="mt-1 text-sm leading-6 text-amber-950/75">هذا التطبيق لا يرسل فرق إنقاذ ولا يراقب البلاغات فورياً. اتصل مباشرة برقم الطوارئ الرسمي في منطقتك.</p></div>
              </div>
            </div>
            <div className="flex items-start gap-3 px-1 pt-1 text-xs leading-6 text-muted-foreground" data-testid="text-privacy-note"><ShieldCheck size={16} className="mt-1 shrink-0 text-primary" /><p>لا تظهر بيانات التواصل في الملخص العام. رمز التتبع يتيح عرض تفاصيل البلاغ؛ احتفظ به ولا تشاركه.</p></div>
          </aside>
        </div>
        <footer className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-border/80 pt-5 text-xs text-muted-foreground sm:flex-row" data-testid="footer-service">
          <span>بلاغات الطوارئ — تسجيل البلاغات ومتابعتها</span>
          <span>إذا كان الخطر فورياً، اتصل بخدمات الطوارئ المحلية.</span>
        </footer>
      </main>
    </div>
  );
}

function TrackPage() {
  const params = useParams<{ trackingCode: string }>();
  const trackingCode = params.trackingCode ?? '';
  const { data: report, isLoading, isError, refetch } = useGetReport(trackingCode, {
    query: { enabled: Boolean(trackingCode), queryKey: getGetReportQueryKey(trackingCode) },
  });
  const activeStep = report ? statusSteps.findIndex((step) => step.value === report.status) : -1;
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="app-shell" dir="rtl">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-7 sm:px-6 sm:pt-12">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-primary no-underline hover:underline" data-testid="link-back-home"><ChevronLeft size={17} /> العودة إلى البلاغات</Link>
        <div className="page-enter">
          <div className="mb-6">
            <p className="text-xs font-bold tracking-wide text-primary">متابعة البلاغ</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">حالة استجابتنا</h1>
          </div>
          {isLoading && <div className="panel space-y-5 rounded-2xl p-6 sm:p-8" aria-label="جارٍ تحميل البلاغ" data-testid="loading-report"><div className="skeleton h-7 w-40" /><div className="skeleton h-4 w-full" /><div className="skeleton h-28 w-full" /><div className="skeleton h-20 w-full" /></div>}
          {isError && <section className="panel rounded-2xl p-6 text-center sm:p-10" data-testid="status-report-not-found">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-800"><AlertCircle size={25} /></span>
            <h2 className="mt-4 text-xl font-bold">لم نعثر على هذا البلاغ</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">تحقق من رمز التتبع وحاول مرة أخرى. الرمز خاص بحالتك ويظهر كما أُرسل إليك.</p>
            <Link href="/" className="btn-primary mt-5 no-underline" data-testid="link-retry-tracking">العودة وإدخال الرمز <ArrowLeft size={17} /></Link>
          </section>}
          {report && <ReportStatus report={report} trackingCode={trackingCode} activeStep={activeStep} copied={copied} copyCode={copyCode} />}
          {!isLoading && !isError && !report && <section className="panel rounded-2xl p-8 text-center" data-testid="status-report-empty"><p className="font-semibold">لا يوجد رمز تتبع لعرضه.</p><Link href="/" className="mt-4 inline-flex text-sm font-semibold text-primary" data-testid="link-submit-first-report">إرسال بلاغ جديد</Link></section>}
          {isError && <button className="btn-secondary mt-4 w-full" onClick={() => refetch()} data-testid="button-retry-report">إعادة المحاولة</button>}
        </div>
      </main>
    </div>
  );
}

function ReportStatus({ report, trackingCode, activeStep, copied, copyCode }: {
  report: Report;
  trackingCode: string;
  activeStep: number;
  copied: boolean;
  copyCode: () => void;
}) {
  const statusLabel = statusSteps.find((item) => item.value === report.status)?.label ?? 'حالة غير محددة';
  const incidentLabel = incidentOptions.find((item) => item.value === report.incidentType)?.label ?? 'حالة أخرى';
  const urgencyLabel = urgencyOptions.find((item) => item.value === report.urgency)?.label ?? 'غير محدد';
  const created = new Intl.DateTimeFormat('ar', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(report.createdAt));
  return (
    <div className="space-y-4">
      <section className="panel overflow-hidden rounded-2xl" data-testid="panel-report-status">
        <div className="border-b border-border/80 bg-primary/[.045] px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><span className="text-xs font-semibold text-muted-foreground">رمز التتبع الخاص</span><div className="mono mt-1 text-xl font-semibold tracking-wide text-primary sm:text-2xl" data-testid="text-tracking-code">{trackingCode}</div></div>
            <button onClick={copyCode} className="btn-secondary min-h-10 px-3 text-xs" data-testid="button-copy-code">{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? 'تم النسخ' : 'نسخ الرمز'}</button>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card px-3 py-2 text-sm font-bold text-primary" data-testid="status-current-report"><span className="status-dot" />{statusLabel}</div>
        </div>
        <div className="px-5 py-6 sm:px-7">
          <h2 className="mb-5 text-base font-bold">مراحل الاستجابة</h2>
          <ol className="space-y-0" data-testid="list-report-progress">
            {statusSteps.map((step, index) => {
              const done = index <= activeStep;
              const current = index === activeStep;
              return (
                <li key={step.value} className="relative flex gap-4 pb-6 last:pb-0" data-testid={`step-report-${step.value}`}>
                  {index < statusSteps.length - 1 && <span className={`absolute right-[.92rem] top-8 h-[calc(100%-1rem)] w-px ${index < activeStep ? 'bg-primary/65' : 'bg-border'}`} />}
                  <span className={`z-[1] grid h-[1.9rem] w-[1.9rem] shrink-0 place-items-center rounded-full border ${done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}>{done ? <Check size={15} /> : <span className="text-xs">{index + 1}</span>}</span>
                  <div className="pt-0.5"><p className={`text-sm font-bold ${current ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}{current && <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">الحالة الحالية</span>}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p></div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
      <section className="panel rounded-2xl p-5 sm:p-7" data-testid="panel-report-details">
        <h2 className="mb-4 text-base font-bold">تفاصيل البلاغ</h2>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">نوع الحالة</dt><dd className="mt-1 text-sm font-semibold" data-testid="text-incident-type">{incidentLabel}</dd></div>
          <div><dt className="text-xs text-muted-foreground">درجة الاستعجال</dt><dd className="mt-1 text-sm font-semibold" data-testid="text-report-urgency">{urgencyLabel}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">الموقع</dt><dd className="mt-1 flex items-start gap-2 text-sm font-semibold leading-6" data-testid="text-report-location"><MapPin className="mt-1 shrink-0 text-primary" size={16} />{report.locationText}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">وصف الحالة</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-7" data-testid="text-report-description">{report.description}</dd></div>
          <div><dt className="text-xs text-muted-foreground">تاريخ الإرسال</dt><dd className="mt-1 flex items-center gap-2 text-sm" data-testid="text-report-created"><Clock3 size={15} className="text-muted-foreground" />{created}</dd></div>
        </dl>
      </section>
      <div className="rounded-2xl border border-amber-800/10 bg-[hsl(39,65%,91%)] p-4 text-sm leading-6 text-amber-950/80" data-testid="notice-track-emergency"><strong className="text-amber-950">تحتاج مساعدة فورية؟</strong> هذا التطبيق لا يرسل فرق إنقاذ ولا يراقب البلاغات فورياً. اتصل برقم الطوارئ الرسمي في منطقتك عند وجود خطر.</div>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/track/:trackingCode" component={TrackPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
