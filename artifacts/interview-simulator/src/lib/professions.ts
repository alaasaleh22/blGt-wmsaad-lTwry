import type { InterviewInput } from '@workspace/api-client-react';

export type TrackKey = InterviewInput['track'];

export interface ProfessionCategory {
  key: TrackKey;
  label: string;
  jobs: string[];
}

export const professionCatalog: ProfessionCategory[] = [
  { key: 'software', label: 'البرمجيات والتقنية', jobs: ['مهندس برمجيات', 'مطوّر واجهات أمامية', 'مهندس DevOps', 'محلل أمن سيبراني', 'عالم بيانات'] },
  { key: 'industrial', label: 'الهندسة الصناعية', jobs: ['مهندس صناعي', 'مهندس جودة', 'أخصائي تحسين العمليات', 'مخطط إنتاج'] },
  { key: 'mechanical', label: 'الهندسة الميكانيكية', jobs: ['مهندس ميكانيكي', 'مهندس صيانة', 'مهندس تكييف وتبريد', 'مصمم ميكانيكي'] },
  { key: 'electrical', label: 'الهندسة الكهربائية', jobs: ['مهندس كهربائي', 'مهندس طاقة متجددة', 'مهندس أنظمة تحكم', 'مهندس اتصالات'] },
  { key: 'electrical_technology', label: 'التقنيات الكهربائية — تقني كهربائي', jobs: ['تقني كهربائي', 'تقني قوى كهربائية', 'تقني شبكات كهربائية', 'تقني محطات كهربائية', 'تقني اختبارات كهربائية'] },
  { key: 'electrical_trades', label: 'الفنيون الكهربائيون — فني كهربائي', jobs: ['فني كهربائي', 'فني تمديدات كهربائية', 'فني صيانة كهربائية', 'فني لوحات كهربائية', 'فني محركات كهربائية'] },
  { key: 'electronics', label: 'الإلكترونيات والاتصالات', jobs: ['فني إلكترونيات', 'تقني إلكترونيات', 'فني اتصالات', 'فني ألياف ضوئية', 'فني أجهزة طبية'] },
  { key: 'automation', label: 'الأتمتة والتحكم والأجهزة الدقيقة', jobs: ['تقني أتمتة صناعية', 'فني تحكم صناعي', 'فني أجهزة دقيقة', 'مبرمج PLC', 'فني روبوتات صناعية'] },
  { key: 'hvac', label: 'التكييف والتبريد', jobs: ['تقني تكييف وتبريد', 'فني تبريد صناعي', 'فني أنظمة تكييف مركزي', 'مشرف صيانة التكييف'] },
  { key: 'automotive', label: 'السيارات والمعدات الثقيلة', jobs: ['تقني سيارات', 'فني كهرباء سيارات', 'فني مركبات كهربائية', 'فني معدات ثقيلة', 'فني تشخيص أعطال المركبات'] },
  { key: 'energy', label: 'الطاقة المتجددة والمرافق', jobs: ['تقني طاقة متجددة', 'فني أنظمة شمسية', 'فني توربينات رياح', 'مشغل محطات طاقة', 'تقني معالجة مياه'] },
  { key: 'occupational_safety', label: 'السلامة والصحة المهنية', jobs: ['فني سلامة مهنية', 'أخصائي سلامة وصحة مهنية', 'مفتش سلامة', 'مشرف إطفاء صناعي'] },
  { key: 'oil_gas', label: 'النفط والغاز والبتروكيماويات', jobs: ['مشغل عمليات نفط وغاز', 'فني تشغيل مصفاة', 'تقني عمليات كيميائية', 'فني خطوط أنابيب'] },
  { key: 'agriculture', label: 'الزراعة والصناعات الغذائية', jobs: ['تقني زراعي', 'فني ري', 'فني إنتاج غذائي', 'مراقب جودة أغذية', 'أخصائي إنتاج حيواني'] },
  { key: 'civil', label: 'الهندسة المدنية', jobs: ['مهندس مدني', 'مهندس إنشائي', 'مدير مشروع إنشاءات', 'مهندس موقع', 'مساح أراضي'] },
  { key: 'healthcare', label: 'الرعاية الصحية', jobs: ['ممرض/ممرضة', 'طبيب عام', 'صيدلي', 'أخصائي علاج طبيعي', 'فني مختبر طبي'] },
  { key: 'education', label: 'التعليم والتدريب', jobs: ['معلم رياضيات', 'معلم لغة عربية', 'مرشد طلابي', 'مدرب مهني', 'مصمم تعليمي'] },
  { key: 'business', label: 'الإدارة والأعمال', jobs: ['مدير مشروع', 'أخصائي موارد بشرية', 'محلل أعمال', 'مدير عمليات', 'مساعد إداري'] },
  { key: 'finance', label: 'المالية والمحاسبة', jobs: ['محاسب', 'محلل مالي', 'مدقق داخلي', 'أخصائي ائتمان', 'مسؤول خزينة'] },
  { key: 'sales', label: 'المبيعات والتسويق', jobs: ['مندوب مبيعات', 'مدير حسابات', 'أخصائي تسويق رقمي', 'ممثل خدمة عملاء', 'مدير علامة تجارية'] },
  { key: 'hospitality', label: 'الضيافة والسياحة', jobs: ['موظف استقبال فندقي', 'مشرف مطعم', 'طاهٍ', 'منسق فعاليات', 'مرشد سياحي'] },
  { key: 'logistics', label: 'اللوجستيات وسلاسل الإمداد', jobs: ['أخصائي سلاسل إمداد', 'مشرف مستودع', 'منسق شحن', 'أخصائي مشتريات'] },
  { key: 'skilled_trades', label: 'الحِرف والمهن الفنية', jobs: ['كهربائي', 'سبّاك', 'فني لحام', 'فني سيارات', 'فني تكييف'] },
  { key: 'legal', label: 'القانون', jobs: ['محامٍ', 'مستشار قانوني', 'باحث قانوني', 'مسؤول امتثال'] },
  { key: 'media', label: 'الإعلام والتصميم', jobs: ['صحفي', 'مصمم جرافيك', 'صانع محتوى', 'مونتير فيديو', 'أخصائي علاقات عامة'] },
  { key: 'science', label: 'العلوم والبحث', jobs: ['باحث مختبر', 'كيميائي', 'أخصائي بيئة', 'عالم أحياء'] },
  { key: 'other', label: 'مجال آخر', jobs: ['موظف حكومي', 'أخصائي اجتماعي', 'مترجم', 'رجل أمن', 'متدرب حديث التخرج'] },
];

export const trackLabels = Object.fromEntries(professionCatalog.map((c) => [c.key, c.label])) as Record<TrackKey, string>;

export const allJobs = professionCatalog.flatMap((c) => c.jobs.map((job) => ({ job, key: c.key })));

export function findTrackForJob(title: string): TrackKey | undefined {
  const t = title.trim();
  return allJobs.find((j) => j.job === t)?.key;
}

export type StageKey = 'intro' | 'experience' | 'scenarios' | 'behavior' | 'closing';

export function stageFor(questionNumber: number, total: number): StageKey {
  if (questionNumber <= 1) return 'intro';
  if (questionNumber >= total) return 'closing';
  const f = questionNumber / Math.max(1, total);
  if (f <= 0.2) return 'experience';
  if (f <= 0.65) return 'scenarios';
  if (f <= 0.9) return 'behavior';
  return 'closing';
}

export const stageLabels: Record<StageKey, { ar: string; en: string }> = {
  intro: { ar: 'تعارف وافتتاح', en: 'Introduction' },
  experience: { ar: 'الخبرة والخلفية', en: 'Experience' },
  scenarios: { ar: 'مواقف الدور العملية', en: 'Role scenarios' },
  behavior: { ar: 'السلوك والأخلاقيات', en: 'Behaviour & ethics' },
  closing: { ar: 'الختام', en: 'Closing' },
};
