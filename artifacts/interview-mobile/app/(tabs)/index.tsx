import React, { useMemo, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { getGetInterviewQueryKey, useCreateInterview, type InterviewInput } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { Btn, Chip, Label, ROW, Segmented, T, errMsg, useInsets } from '@/components/ui';
import { professionCatalog, type TrackKey } from '@/lib/catalog';
import { useBookmarks } from '@/lib/bookmarks';
import { F } from '@/lib/fonts';

type Count = InterviewInput['questionCount'];
const COUNTS: Count[] = Array.from({ length: 20 }, (_, i) => i + 1);

export default function SetupScreen() {
  const c = useColors();
  const ins = useInsets();
  const qc = useQueryClient();
  const { upsert } = useBookmarks();
  const create = useCreateInterview();
  const [track, setTrack] = useState<TrackKey>('software');
  const [search, setSearch] = useState('');
  const q = search.trim();
  const shownCats = q ? professionCatalog.filter((p) => p.label.includes(q) || p.en.toLowerCase().includes(q.toLowerCase()) || p.jobs.some((j) => j.includes(q))) : professionCatalog;
  const [role, setRole] = useState('مهندس برمجيات');
  const [level, setLevel] = useState<InterviewInput['experienceLevel']>('mid');
  const [lang, setLang] = useState<InterviewInput['language']>('ar');
  const [mode, setMode] = useState<InterviewInput['mode']>('voice');
  const [count, setCount] = useState<Count>(20);
  const [error, setError] = useState<string | null>(null);
  const category = useMemo(() => professionCatalog.find((p) => p.key === track)!, [track]);
  const roleOk = role.trim().length >= 2 && role.trim().length <= 120;

  const start = () => {
    if (!roleOk) { setError('اكتب مسمى وظيفي من حرفين على الأقل.'); return; }
    setError(null);
    create.mutate({ data: { roleTitle: role.trim(), track, experienceLevel: level, language: lang, mode, questionCount: count } }, {
      onSuccess: (detail) => {
        qc.setQueryData(getGetInterviewQueryKey(detail.session.id), detail);
        upsert({ id: detail.session.id, roleTitle: detail.session.roleTitle, status: detail.session.status, language: detail.session.language });
        router.push({ pathname: '/session/[id]', params: { id: detail.session.id } });
      },
      onError: (e) => setError(errMsg(e, 'تعذّر بدء المقابلة. حاول مجددًا.')),
    });
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingTop: ins.top + 14, paddingBottom: ins.bottom + 110, paddingHorizontal: 18 }}
      keyboardShouldPersistTaps="handled" bottomOffset={24}
    >
      <View style={[st.brandRow, { flexDirection: ROW }]}>
        <View style={[st.brand, { flexDirection: ROW }]}>
          <Image source={require('@/assets/images/miraa-icon.png')} style={st.logo} />
          <T w="bold" size={18}>مرآة</T>
        </View>
        <View style={[st.pill, { borderColor: c.border }]}><T size={11} color={c.mutedForeground}>تدريب خاص · بدون حساب</T></View>
      </View>

      <View style={[st.hero, { backgroundColor: c.forest }]}>
        <T size={11} w="bold" color={c.sage} style={{ letterSpacing: 1.2 }}>غرفة مقابلة في جيبك</T>
        <T w="bold" size={28} color={c.onForest} style={{ lineHeight: 42, marginTop: 6 }}>استعد لمقابلتك المقبلة، بصوتك أو كتابتك.</T>
        <T size={13} color={c.onForestMuted} style={{ lineHeight: 22, marginTop: 8 }}>اختر الدور ومستوى الخبرة، ثم ادخل الغرفة. تحصل على تقرير أداء وملاحظات محددة عند إنهاء المقابلة.</T>
        <View style={[st.heroStats, { flexDirection: ROW, borderTopColor: c.forestLine }]}>
          <HeroStat k={String(count)} v="سؤال" />
          <HeroStat k={lang === 'ar' ? 'AR' : 'EN'} v="لغة المقابلة" />
          <HeroStat k={mode === 'voice' ? 'صوت' : 'نص'} v="طريقة الإجابة" />
        </View>
      </View>

      <Section n="01" title="المجال">
        <View style={[st.inputWrap, { marginTop: 0, marginBottom: 10, borderColor: c.border, backgroundColor: c.card, flexDirection: ROW }]}>
          <Feather name="search" size={16} color={c.mutedForeground} />
          <TextInput testID="profession-search" value={search} onChangeText={setSearch} placeholder="ابحث عن مجال أو وظيفة" placeholderTextColor={c.mutedForeground}
            style={[st.input, { color: c.foreground, fontFamily: F.medium }]} />
        </View>
        {q && shownCats.length === 0 ? <T size={12} color={c.mutedForeground} style={{ marginBottom: 6 }}>لا نتائج — اكتب المسمى في الحقل المخصص أدناه.</T> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, flexDirection: ROW }}>
          {shownCats.map((p) => (
            <Chip key={p.key} testID={'track-' + p.key} label={p.label} icon={p.icon as React.ComponentProps<typeof Feather>['name']} on={track === p.key}
              onPress={() => { setTrack(p.key); setRole(p.jobs[0]); }} />
          ))}
        </ScrollView>
      </Section>

      <Section n="02" title="الدور الوظيفي">
        <View style={[st.wrap, { flexDirection: ROW }]}>
          {category.jobs.map((j) => <Chip key={j} testID={'job-' + j} label={j} on={role.trim() === j} onPress={() => setRole(j)} />)}
        </View>
        <View style={[st.inputWrap, { borderColor: roleOk ? c.border : c.danger, backgroundColor: c.card, flexDirection: ROW }]}>
          <Feather name="edit-3" size={16} color={c.mutedForeground} />
          <TextInput testID="custom-role-input" value={role} onChangeText={setRole} maxLength={120}
            placeholder="أو اكتب مسمى وظيفيًا مخصصًا" placeholderTextColor={c.mutedForeground}
            style={[st.input, { color: c.foreground, fontFamily: F.medium }]} />
        </View>
      </Section>

      <Section n="03" title="الإعدادات">
        <Label>مستوى الخبرة</Label>
        <Segmented testPrefix="level" value={level} onChange={setLevel} options={[{ value: 'junior', label: 'مبتدئ' }, { value: 'mid', label: 'متوسط' }, { value: 'senior', label: 'خبير' }]} />
        <View style={{ height: 16 }} />
        <Label>لغة المقابلة</Label>
        <Segmented testPrefix="lang" value={lang} onChange={setLang} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
        <View style={{ height: 16 }} />
        <Label>طريقة الإجابة</Label>
        <Segmented testPrefix="mode" value={mode} onChange={setMode} options={[{ value: 'voice', label: 'بالصوت' }, { value: 'text', label: 'بالكتابة' }]} />
        <View style={{ height: 16 }} />
        <Label>عدد الأسئلة</Label>
        <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 8 }}>
          {COUNTS.map((n) => (
            <View key={n} style={{ width: '18%', flexGrow: 1 }}>
              <Chip testID={'count-' + n} label={String(n)} on={count === n} onPress={() => setCount(n)} />
            </View>
          ))}
        </View>
      </Section>

      {error ? (
        <View style={[st.err, { backgroundColor: c.dangerSoft, flexDirection: ROW }]}>
          <Feather name="alert-circle" size={16} color={c.danger} />
          <T size={13} color={c.danger} style={{ flex: 1 }}>{error}</T>
        </View>
      ) : null}
      <Btn testID="start-interview" label={create.isPending ? 'نجهّز الغرفة…' : 'ادخل غرفة المقابلة'} icon="arrow-left" loading={create.isPending} onPress={start} style={{ marginTop: 18 }} />
      <T size={11} align="center" color={c.mutedForeground} style={{ marginTop: 10, lineHeight: 18 }}>
        {Platform.OS === 'web' ? 'يُحفظ رابط الجلسة في هذا المتصفح فقط.' : 'يُحفظ معرّف الجلسة على هذا الجهاز فقط.'} الكاميرا محلية ولا تُرسل.
      </T>
    </KeyboardAwareScrollViewCompat>
  );
}

function HeroStat({ k, v }: { k: string; v: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <T w="bold" size={18} color={c.sage}>{k}</T>
      <T size={11} color={c.onForestMuted}>{v}</T>
    </View>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ flexDirection: ROW, alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <T w="bold" size={12} color={c.primary}>{n}</T>
        <T w="bold" size={18}>{title}</T>
      </View>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  brandRow: { justifyContent: 'space-between', alignItems: 'center' },
  brand: { alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 10 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  hero: { marginTop: 18, padding: 22, borderTopLeftRadius: 28, borderTopRightRadius: 5, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  heroStats: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, gap: 10 },
  wrap: { flexWrap: 'wrap', gap: 8 },
  inputWrap: { marginTop: 12, borderWidth: 1, alignItems: 'center', gap: 10, paddingHorizontal: 14, borderTopLeftRadius: 12, borderTopRightRadius: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, textAlign: 'right' },
  err: { marginTop: 16, padding: 12, borderRadius: 10, gap: 8, alignItems: 'center' },
});
