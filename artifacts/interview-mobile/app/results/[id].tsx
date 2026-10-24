import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getGetInterviewQueryKey, useGetInterview } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, ErrorState, ROW, Skeleton, T, errMsg, useInsets } from '@/components/ui';
import { useBookmarks } from '@/lib/bookmarks';
import { levelLabels, trackLabels } from '@/lib/catalog';

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const ins = useInsets();
  const { upsert } = useBookmarks();
  const q = useGetInterview(id ?? '', { query: { enabled: !!id, queryKey: getGetInterviewQueryKey(id ?? '') } });
  const s = q.data?.session;
  useEffect(() => {
    if (s) upsert({ id: s.id, roleTitle: s.roleTitle, status: s.status, language: s.language, score: s.evaluation?.overallScore ?? null });
  }, [s, upsert]);

  const answered = (q.data?.turns ?? []).filter((t) => t.answer);
  const ev = s?.evaluation;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ paddingTop: ins.top + 10, paddingBottom: ins.bottom + 30, paddingHorizontal: 18 }}>
      <View style={{ flexDirection: ROW, justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Pressable testID="results-back" hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Feather name="arrow-right" size={22} color={c.foreground} />
        </Pressable>
        <T w="bold" size={13} color={c.mutedForeground}>تقرير المقابلة</T>
        <Pressable testID="results-new" hitSlop={10} onPress={() => router.replace('/')}><Feather name="plus" size={22} color={c.primary} /></Pressable>
      </View>

      {q.isLoading ? <View style={{ gap: 12 }}><Skeleton h={200} /><Skeleton h={120} /><Skeleton h={120} /></View>
        : q.isError || !s ? <ErrorState testID="results-retry" message={errMsg(q.error, 'تعذّر تحميل النتائج.')} onRetry={() => q.refetch()} />
        : !ev ? (
          <Card style={{ alignItems: 'center', gap: 12 }}>
            <Feather name="clock" size={26} color={c.amber} />
            <T align="center" w="semibold">لم يكتمل التقييم بعد</T>
            <T align="center" size={13} color={c.mutedForeground}>أكمل المقابلة أو أنهِها لتحصل على التقرير.</T>
            <Btn testID="results-resume" label="العودة للمقابلة" icon="play" onPress={() => router.replace({ pathname: '/session/[id]', params: { id: s.id } })} />
          </Card>
        ) : (
          <>
            <View style={[st.hero, { backgroundColor: c.forest }]}>
              <View style={{ flex: 1 }}>
                <T size={11} w="bold" color={c.sage}>{trackLabels[s.track]} · {levelLabels[s.experienceLevel]}</T>
                <T w="bold" size={22} color={c.onForest} style={{ marginTop: 6 }}>{s.roleTitle}</T>
                <T size={13} color={c.onForestMuted} style={{ marginTop: 8, lineHeight: 22 }}>{ev.summary}</T>
              </View>
              <View style={[st.ring, { borderColor: c.sage, backgroundColor: c.forestSoft }]}>
                <T w="bold" size={34} align="center" color={c.sage}>{ev.overallScore}</T>
                <T size={10} align="center" color={c.onForestMuted}>من 100</T>
              </View>
            </View>
            <ListCard title="نقاط القوة" icon="trending-up" tint={c.primary} items={ev.strengths} />
            <ListCard title="ما يحتاج تحسين" icon="target" tint={c.accent} items={ev.improvements} />
            <ListCard title="الخطوات التالية" icon="flag" tint={c.amber} items={ev.nextSteps} />

            <T w="bold" size={18} style={{ marginTop: 26, marginBottom: 10 }}>مراجعة الإجابات ({answered.length})</T>
            {answered.length === 0 ? <T color={c.mutedForeground} size={13}>لم تُسجَّل إجابات في هذه الجلسة.</T> : null}
            {answered.map((t) => (
              <Card key={t.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: ROW, justifyContent: 'space-between', alignItems: 'center' }}>
                  <T size={11} w="bold" color={c.mutedForeground}>سؤال {t.questionNumber}</T>
                  {typeof t.score === 'number' ? <View style={[st.score, { backgroundColor: c.sageSoft }]}><T size={12} w="bold" color={c.primary}>{t.score}/10</T></View> : null}
                </View>
                <T w="semibold" style={{ marginTop: 8, lineHeight: 24 }}>{t.question}</T>
                <T size={13} color={c.mutedForeground} style={{ marginTop: 8, lineHeight: 21 }}>{t.answer}</T>
                {t.feedback ? <View style={[st.fb, { borderColor: c.primary }]}><T size={13} style={{ lineHeight: 21 }}>{t.feedback}</T></View> : null}
              </Card>
            ))}
            <Btn testID="results-start-new" label="مقابلة جديدة" icon="refresh-cw" onPress={() => router.replace('/')} style={{ marginTop: 12 }} />
          </>
        )}
    </ScrollView>
  );
}

function ListCard({ title, icon, tint, items }: { title: string; icon: React.ComponentProps<typeof Feather>['name']; tint: string; items: string[] }) {
  const c = useColors();
  if (!items.length) return null;
  return (
    <Card style={{ marginTop: 14 }}>
      <View style={{ flexDirection: ROW, gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <Feather name={icon} size={16} color={tint} />
        <T w="bold" size={16}>{title}</T>
      </View>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: ROW, gap: 10, marginTop: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tint, marginTop: 9 }} />
          <T size={14} color={c.foreground} style={{ flex: 1, lineHeight: 23 }}>{it}</T>
        </View>
      ))}
    </Card>
  );
}

const st = StyleSheet.create({
  hero: { padding: 20, gap: 16, alignItems: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 5, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  ring: { width: 108, height: 108, borderRadius: 54, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  score: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  fb: { marginTop: 10, borderRightWidth: 3, paddingRight: 10 },
});
