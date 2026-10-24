import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { getGetInterviewQueryOptions } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, ROW, Skeleton, T, errMsg, useInsets } from '@/components/ui';
import { useBookmarks, type Bookmark } from '@/lib/bookmarks';
import { UUID_RE } from '@/lib/catalog';
import { F } from '@/lib/fonts';

export default function HistoryScreen() {
  const c = useColors();
  const ins = useInsets();
  const qc = useQueryClient();
  const { bookmarks, loaded, upsert, remove } = useBookmarks();
  const [uuid, setUuid] = useState('');
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const open = (b: Bookmark) => router.push({ pathname: b.status === 'completed' ? '/results/[id]' : '/session/[id]', params: { id: b.id } });

  const doImport = async () => {
    const id = uuid.trim().toLowerCase();
    if (!UUID_RE.test(id)) { setErr('المعرّف غير صالح. الصق UUID كاملًا من رابط الجلسة.'); return; }
    setErr(null); setImporting(true);
    try {
      const d = await qc.fetchQuery(getGetInterviewQueryOptions(id));
      upsert({ id, roleTitle: d.session.roleTitle, status: d.session.status, language: d.session.language, score: d.session.evaluation?.overallScore ?? null });
      setUuid('');
      router.push({ pathname: d.session.status === 'completed' ? '/results/[id]' : '/session/[id]', params: { id } });
    } catch (e) {
      setErr(errMsg(e, 'لم نجد جلسة بهذا المعرّف.'));
    } finally { setImporting(false); }
  };

  const header = (
    <View style={{ paddingTop: ins.top + 14 }}>
      <T w="bold" size={26}>جلساتي</T>
      <T size={13} color={c.mutedForeground} style={{ marginTop: 4, lineHeight: 21 }}>إشارات خاصة محفوظة على هذا الجهاز فقط. لا يوجد حساب ولا قائمة عامة.</T>
      <Card style={{ marginTop: 18, marginBottom: 22 }}>
        <T w="bold" size={15}>استئناف جلسة من الويب</T>
        <T size={12} color={c.mutedForeground} style={{ marginTop: 4, marginBottom: 12 }}>الصق معرّف الجلسة (UUID) من آخر رابط المقابلة.</T>
        <View style={[st.input, { borderColor: err ? c.danger : c.border, backgroundColor: c.background, flexDirection: ROW }]}>
          <Feather name="link" size={15} color={c.mutedForeground} />
          <TextInput testID="import-uuid-input" value={uuid} onChangeText={(t) => { setUuid(t); setErr(null); }} autoCapitalize="none" autoCorrect={false}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" placeholderTextColor={c.mutedForeground}
            style={{ flex: 1, paddingVertical: 12, color: c.foreground, fontFamily: F.regular, fontSize: 13, textAlign: 'left' }} />
        </View>
        {err ? <T size={12} color={c.danger} style={{ marginTop: 8 }}>{err}</T> : null}
        <Btn testID="import-uuid-submit" label="استئناف" icon="corner-down-left" onPress={doImport} loading={importing} disabled={!uuid.trim()} variant="primary" style={{ marginTop: 12 }} />
      </Card>
      {bookmarks.length ? <T w="bold" size={13} color={c.mutedForeground} style={{ marginBottom: 10 }}>الأحدث</T> : null}
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: ins.bottom + 110 }}
      data={bookmarks}
      keyExtractor={(b) => b.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={!loaded ? <View style={{ gap: 10 }}><Skeleton h={74} /><Skeleton h={74} /></View> : (
        <View style={st.empty}>
          <Feather name="bookmark" size={28} color={c.mutedForeground} />
          <T w="semibold" align="center">لا توجد جلسات محفوظة بعد</T>
          <T size={13} align="center" color={c.mutedForeground}>ابدأ مقابلة من التبويب الأول وستظهر هنا تلقائيًا.</T>
          <Btn testID="empty-start" label="مقابلة جديدة" icon="plus" variant="secondary" onPress={() => router.navigate('/')} />
        </View>
      )}
      renderItem={({ item }) => (
        <Pressable testID={'open-session-' + item.id} onPress={() => open(item)} style={({ pressed }) => [st.row, { backgroundColor: c.card, borderColor: c.border, flexDirection: ROW, opacity: pressed ? 0.85 : 1 }]}>
          <View style={[st.badge, { backgroundColor: item.status === 'completed' ? c.sageSoft : c.amberSoft }]}>
            {item.status === 'completed' && typeof item.score === 'number'
              ? <T w="bold" size={15} align="center" color={c.primary}>{item.score}</T>
              : <Feather name={item.status === 'completed' ? 'check' : 'play'} size={16} color={item.status === 'completed' ? c.primary : c.accent} />}
          </View>
          <View style={{ flex: 1 }}>
            <T w="semibold" numberOfLines={1}>{item.roleTitle}</T>
            <T size={11} color={c.mutedForeground}>{item.status === 'completed' ? 'مكتملة' : 'قيد التقدم'} · {new Date(item.savedAt).toLocaleDateString('ar')} · {item.language === 'ar' ? 'عربي' : 'English'}</T>
          </View>
          <Pressable testID={'remove-session-' + item.id} hitSlop={10} onPress={() => remove(item.id)} accessibilityLabel="إزالة من الجهاز">
            <Feather name="x" size={18} color={c.mutedForeground} />
          </Pressable>
        </Pressable>
      )}
    />
  );
}

const st = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', gap: 8 },
  row: { borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 12, marginBottom: 10 },
  badge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 30 },
});
