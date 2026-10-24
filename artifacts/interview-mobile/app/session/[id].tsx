import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import {
  getGetInterviewAvatarOptionsQueryKey,
  getGetInterviewQueryKey,
  useFinishInterview,
  useGetInterview,
  useGetInterviewAvatarOptions,
  useSubmitInterviewAnswer,
  type InterviewDetail,
} from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import AvatarTransport from '@/components/AvatarTransport';
import { SelfView, type SelfViewHandle } from '@/components/SelfView';
import { Btn, Card, ErrorState, Pulse, ROW, Skeleton, T, errMsg, useInsets } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useAvatarSession } from '@/hooks/useAvatarSession';
import { PcmCollector, playWav, readRecordingBase64, stopPlayback } from '@/lib/audio';
import { HttpError, streamSse, type SseEvent } from '@/lib/sse';
import { draftKey, useBookmarks } from '@/lib/bookmarks';
import { stageFor, stageLabels } from '@/lib/catalog';
import { F } from '@/lib/fonts';

type RecState = 'idle' | 'recording' | 'processing';
type PermState = 'unknown' | 'requesting' | 'granted' | 'denied';

export default function SessionScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = rawId ?? '';
  const c = useColors();
  const ins = useInsets();
  const qc = useQueryClient();
  const { upsert } = useBookmarks();
  const key = getGetInterviewQueryKey(id);
  const q = useGetInterview(id, { query: { enabled: !!id, queryKey: key } });
  const session = q.data?.session;
  const opts = useGetInterviewAvatarOptions(id, { query: { enabled: !!id, queryKey: getGetInterviewAvatarOptionsQueryKey(id) } });
  const submit = useSubmitInterviewAnswer({
    mutation: {
      onSettled: (_data, _error, variables) => {
        // MutationCache retains variables even after unmount; discard the processed image.
        delete variables.data.candidateImage;
      },
    },
  });
  const finish = useFinishInterview();

  const [inputMode, setInputMode] = useState<'voice' | 'text' | null>(null);
  const mode = inputMode ?? session?.mode ?? 'text';
  const [draft, setDraft] = useState('');
  const [textErr, setTextErr] = useState<string | null>(null);
  const [recState, setRecState] = useState<RecState>('idle');
  const [perm, setPerm] = useState<PermState>('unknown');
  const [recSecs, setRecSecs] = useState(0);
  const [voiceErr, setVoiceErr] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState('');
  const [interviewerText, setInterviewerText] = useState('');
  const [pending, setPending] = useState<{ uri: string; qn: number } | null>(null);
  const [failedTranscript, setFailedTranscript] = useState('');
  const [playing, setPlaying] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [readErr, setReadErr] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishErr, setFinishErr] = useState<string | null>(null);
  const [acceptCharges, setAcceptCharges] = useState(false);
  const [paidAvatarId, setPaidAvatarId] = useState<string | null>(null);
  const selfRef = useRef<SelfViewHandle>(null);
  const [camReady, setCamReady] = useState(false);
  const [visionOn, setVisionOn] = useState(false);
  const [visionStatus, setVisionStatus] = useState<'idle' | 'capturing' | 'sent' | 'error'>('idle');
  const [observation, setObservation] = useState('');
  const visionOnRef = useRef(false);
  visionOnRef.current = visionOn;
  const onCamReady = useCallback((r: boolean) => {
    setCamReady(r);
    if (!r) { setVisionOn(false); setObservation(''); setVisionStatus('idle'); }
  }, []);
  /** Returns one still snapshot when (and only when) the user enabled sharing. Throws on failure so nothing is sent silently. */
  const captureIfEnabled = async (): Promise<string | undefined> => {
    setObservation('');
    if (!visionOnRef.current) { setVisionStatus('idle'); return undefined; }
    setVisionStatus('capturing');
    try {
      const img = await selfRef.current?.snapshot();
      if (!img) throw new Error('no image');
      if (img.length > 1_000_000) throw new Error('too large');
      setVisionStatus('sent');
      return img;
    } catch {
      setVisionStatus('error');
      throw new Error('تعذّر التقاط صورة الكاميرا، فلم تُرسل الإجابة. أعد المحاولة أو أوقف مشاركة الصورة.');
    }
  };

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recStateRef = useRef<RecState>('idle');
  recStateRef.current = recState;
  const readAbortRef = useRef<AbortController | null>(null);
  const answerAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const activeRef = useRef(AppState.currentState === 'active');
  const recQnRef = useRef(0);
  const draftRef = useRef('');
  const draftDirty = useRef(false);
  const readOnceRef = useRef(false);

  // ---------- avatar ----------
  const readQuestionRef = useRef<() => void>(() => undefined);
  const avatar = useAvatarSession(id, () => {
    if (!readOnceRef.current) { readOnceRef.current = true; readQuestionRef.current(); }
  });

  // ---------- bookmarks ----------
  useEffect(() => {
    if (session) upsert({ id: session.id, roleTitle: session.roleTitle, status: session.status, language: session.language, score: session.evaluation?.overallScore ?? null });
  }, [session, upsert]);

  // ---------- drafts ----------
  const draftLoaded = useRef<string | null>(null);
  useEffect(() => {
    if (!id || draftLoaded.current === id) return;
    AsyncStorage.getItem(draftKey(id)).then((v) => { draftLoaded.current = id; if (v) setDraft((cur) => { const next = cur || v; draftRef.current = next; return next; }); }).catch(() => { draftLoaded.current = id; });
  }, [id]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushDraft = () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (draftDirty.current && id) { draftDirty.current = false; AsyncStorage.setItem(draftKey(id), draftRef.current).catch(() => undefined); }
  };
  const onDraft = (t: string) => {
    setDraft(t); setTextErr(null);
    draftRef.current = t; draftDirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushDraft, 400);
  };
  const clearDraft = () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    draftDirty.current = false; draftRef.current = ''; setDraft('');
    AsyncStorage.removeItem(draftKey(id)).catch(() => undefined);
  };

  // ---------- audio stream routing ----------
  const runAudioStream = useCallback(async (kind: 'read' | 'answer', path: string, body: unknown | undefined, onEv: (e: SseEvent) => void) => {
    readAbortRef.current?.abort();
    const ac = new AbortController();
    if (kind === 'read') readAbortRef.current = ac; else answerAbortRef.current = ac;
    const pcm = new PcmCollector();
    let forwarded = false;
    try {
      await streamSse(path, body, (ev) => {
        if (ev.type === 'audio' && ev.data) {
          pcm.push(ev.data);
          if (avatar.liveRef.current && avatar.send({ type: 'audio', data: ev.data })) forwarded = true;
        } else onEv(ev);
      }, ac.signal);
    } finally {
      if (forwarded && avatar.liveRef.current) avatar.send({ type: 'audio_end' });
      if (readAbortRef.current === ac) readAbortRef.current = null;
      if (answerAbortRef.current === ac) answerAbortRef.current = null;
    }
    if (!mountedRef.current || !activeRef.current || ac.signal.aborted) return;
    if (forwarded && avatar.liveRef.current) return; // the live interviewer spoke it
    if (pcm.size > 0) {
      setPlaying('playing');
      await playWav(pcm.toWav(), () => { if (mountedRef.current) setPlaying('idle'); });
    }
  }, [avatar.liveRef, avatar.send]);

  const readQuestion = useCallback(async () => {
    if (!id || recStateRef.current !== 'idle') return;
    stopPlayback();
    setReadErr(null); setPlaying('loading');
    try {
      await runAudioStream('read', '/api/interviews/' + encodeURIComponent(id) + '/question-audio', undefined, () => undefined);
      if (mountedRef.current) setPlaying((p) => (p === 'loading' ? 'idle' : p));
    } catch (e) {
      if (mountedRef.current) { setPlaying('idle'); if (!(e instanceof Error && e.name === 'AbortError')) setReadErr(errMsg(e, 'تعذّر تشغيل صوت السؤال.')); }
    }
  }, [id, runAudioStream]);
  readQuestionRef.current = () => { void readQuestion(); };

  /** Cancels question read-out only (never an answer upload). */
  const stopQuestionAudio = () => {
    readAbortRef.current?.abort(); readAbortRef.current = null;
    stopPlayback(); setPlaying('idle');
    avatar.send({ type: 'interrupt' });
  };

  // ---------- voice ----------
  useEffect(() => {
    if (recState !== 'recording') return;
    setRecSecs(0);
    const t = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recState]);

  const sendVoice = useCallback(async (uri: string, qn: number) => {
    if (session && session.turnNumber !== qn) { setPending(null); setVoiceErr('هذا التسجيل يخص سؤالًا سابقًا ولن يُرسل.'); return; }
    setRecState('processing'); setVoiceErr(null); setInterviewerText(''); setFailedTranscript('');
    let heard = '';
    try {
      const candidateImage = await captureIfEnabled();
      const audio = await readRecordingBase64(uri);
      if (!audio) throw new Error('التسجيل فارغ. سجّل مرة أخرى.');
      await runAudioStream('answer', '/api/interviews/' + encodeURIComponent(id) + '/voice-turn', { audio, expectedQuestionNumber: qn, ...(candidateImage ? { candidateImage } : {}) }, (ev) => {
        if (ev.type === 'visual_context' && ev.data) setObservation(ev.data);
        if (ev.type === 'user_transcript' && ev.data) { heard = ev.data; setUserTranscript(ev.data); }
        if (ev.type === 'transcript' && ev.data) setInterviewerText((p) => p + ev.data);
      });
      clearDraft();
      const r = await q.refetch();
      if (!mountedRef.current) return;
      setPending(null); setUserTranscript('');
      setRecState('idle');
      if (r.data?.session.status === 'completed') { avatar.stop(); router.replace({ pathname: '/results/[id]', params: { id } }); }
    } catch (e) {
      if (!mountedRef.current) return;
      if (e instanceof HttpError && e.status === 409) {
        setPending(null);
        setVoiceErr('تغيّر السؤال الحالي قبل إرسال هذا التسجيل، فلم يُحتسب. حدّثنا السؤال — سجّل إجابتك له من جديد.');
        void q.refetch();
      } else {
        setPending({ uri, qn }); // keep audio + transcript for retry on the same question
        setVoiceErr(errMsg(e, 'تعذّر إرسال الإجابة الصوتية.'));
      }
      if (heard) setFailedTranscript(heard);
      setRecState('idle');
    }
  }, [id, runAudioStream, q, avatar, session]);

  const startRecording = async () => {
    if (!session) return;
    stopQuestionAudio();
    setVoiceErr(null);
    setPerm('requesting');
    const qn = session.turnNumber;
    try {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) { setPerm('denied'); return; }
      setPerm('granted');
      if (!mountedRef.current || !activeRef.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!mountedRef.current || !activeRef.current) { await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined); return; }
      recQnRef.current = qn;
      recorder.record();
      avatar.send({ type: 'interrupt' });
      avatar.send({ type: 'listening', value: true });
      setPending(null); setUserTranscript(''); setFailedTranscript('');
      setRecState('recording');
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    } catch (e) {
      setPerm((x) => (x === 'requesting' ? 'unknown' : x));
      setVoiceErr(errMsg(e, 'تعذّر تشغيل الميكروفون.'));
    }
  };

  const finalizeRecording = async (): Promise<string | null> => {
    avatar.send({ type: 'listening', value: false });
    try { await recorder.stop(); } catch { /* already stopped */ }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
    return recorder.uri ?? null;
  };

  const stopAndSend = async () => {
    setRecState('processing');
    const uri = await finalizeRecording();
    if (!uri) { setRecState('idle'); setVoiceErr('لم يُحفظ التسجيل. حاول مرة أخرى.'); return; }
    await sendVoice(uri, recQnRef.current);
  };

  const cancelRecording = async () => {
    await finalizeRecording();
    setRecState('idle');
  };

  // background / unmount safety
  useEffect(() => {
    mountedRef.current = true;
    const sub = AppState.addEventListener('change', (s) => {
      activeRef.current = s === 'active';
      if (s === 'active') return;
      readAbortRef.current?.abort(); readAbortRef.current = null;
      stopPlayback(); setPlaying('idle');
      flushDraft();
      if (recStateRef.current === 'recording') {
        const qn = recQnRef.current;
        void finalizeRecording().then((uri) => { setRecState('idle'); if (uri) { setPending({ uri, qn }); setVoiceErr('توقف التسجيل عند مغادرة التطبيق. يمكنك إرساله أو إعادة التسجيل.'); } });
      }
    });
    return () => {
      mountedRef.current = false;
      sub.remove();
      readAbortRef.current?.abort();
      stopPlayback();
      flushDraft();
      if (recStateRef.current === 'recording') { recorder.stop().catch(() => undefined); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- text ----------
  const [capturingText, setCapturingText] = useState(false);
  const submitText = async () => {
    const answer = draft.trim();
    if (!answer) { setTextErr('اكتب إجابتك أولًا.'); return; }
    if (capturingText || submit.isPending) return;
    setTextErr(null);
    stopQuestionAudio();
    let candidateImage: string | undefined;
    setCapturingText(true);
    try { candidateImage = await captureIfEnabled(); }
    catch (e) { setTextErr(errMsg(e)); return; }
    finally { setCapturingText(false); }
    if (!mountedRef.current) return;
    submit.mutate({ id, data: { answer, ...(candidateImage ? { candidateImage } : {}) } }, {
      onSuccess: (res) => {
        const vo = (res as { visualObservation?: string | null }).visualObservation;
        if (vo) setObservation(vo);
        qc.setQueryData<InterviewDetail>(key, (old) => {
          if (!old) return old;
          const others = old.turns.filter((t) => t.id !== res.turn.id);
          return { session: res.session, turns: [...others, res.turn].sort((a, b) => a.questionNumber - b.questionNumber) };
        });
        void qc.invalidateQueries({ queryKey: key });
        clearDraft();
        if (res.session.status === 'completed') { avatar.stop(); router.replace({ pathname: '/results/[id]', params: { id } }); return; }
        if (res.nextQuestion && avatar.liveRef.current) void readQuestion();
      },
      onError: (e) => setTextErr(errMsg(e, 'تعذّر إرسال الإجابة. مسودتك محفوظة.')),
    });
  };

  const finishBlocked = recState !== 'idle' || perm === 'requesting' || submit.isPending || capturingText;
  const doFinish = () => {
    if (finishBlocked) return;
    if (!confirmFinish) { setConfirmFinish(true); return; }
    setFinishErr(null);
    finish.mutate({ id }, {
      onSuccess: (d) => { qc.setQueryData(key, d); avatar.stop(); router.replace({ pathname: '/results/[id]', params: { id } }); },
      onError: (e) => { setFinishErr(errMsg(e, 'تعذّر إنهاء المقابلة.')); setConfirmFinish(false); },
    });
  };

  // ---------- render ----------
  if (q.isLoading || (!q.data && !q.isError)) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: ins.top + 16, paddingHorizontal: 18, gap: 14 }}>
        <Skeleton h={22} w="50%" />
        <Skeleton h={340} />
        <Skeleton h={28} />
        <Skeleton h={28} w="70%" />
        <Skeleton h={90} />
      </View>
    );
  }
  if (q.isError || !session) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: ins.top + 40, paddingHorizontal: 18, gap: 14 }}>
        <ErrorState testID="session-retry" message={errMsg(q.error, 'تعذّر تحميل الجلسة.')} onRetry={() => q.refetch()} />
        <Btn testID="session-error-home" label="العودة" icon="arrow-right" variant="ghost" onPress={() => router.replace('/')} />
      </View>
    );
  }
  if (session.status === 'completed') {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: ins.top + 40, paddingHorizontal: 18 }}>
        <Card style={{ alignItems: 'center', gap: 12 }}>
          <Feather name="check-circle" size={30} color={c.primary} />
          <T w="bold" size={18} align="center">اكتملت هذه المقابلة</T>
          <Btn testID="go-results" label="عرض التقرير" icon="bar-chart-2" onPress={() => router.replace({ pathname: '/results/[id]', params: { id } })} />
        </Card>
      </View>
    );
  }

  const total = session.questionCount;
  const n = Math.min(session.turnNumber, total);
  const stage = stageFor(n, total);
  const isEn = session.language === 'en';
  const busyVoice = recState !== 'idle';
  const o = opts.data;
  const sandboxAvatar = o?.avatars.find((a) => a.id === o.sandboxAvatarId) ?? o?.avatars[0];
  const paidId = paidAvatarId ?? o?.avatars[0]?.id ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* header */}
      <View style={[st.header, { paddingTop: ins.top + 6, flexDirection: ROW, borderBottomColor: c.border }]}>
        <Pressable testID="session-back" hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Feather name="arrow-right" size={22} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T w="bold" size={15} numberOfLines={1}>{session.roleTitle}</T>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: 8, marginTop: 4 }}>
            <T size={11} color={c.mutedForeground}>{n}/{total}</T>
            <View style={[st.track, { backgroundColor: c.secondary }]}>
              <View style={[st.fill, { backgroundColor: c.primary, width: `${Math.round((n / total) * 100)}%` }]} />
            </View>
          </View>
        </View>
        <Pressable testID="finish-interview" onPress={doFinish} disabled={finish.isPending || finishBlocked}
          style={[st.finish, { opacity: finishBlocked ? 0.45 : 1, borderColor: confirmFinish ? c.danger : c.border, backgroundColor: confirmFinish ? c.dangerSoft : 'transparent' }]}>
          {finish.isPending ? <ActivityIndicator size="small" color={c.danger} /> : <T size={12} w="bold" color={confirmFinish ? c.danger : c.mutedForeground}>{confirmFinish ? 'تأكيد الإنهاء' : 'إنهاء'}</T>}
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat style={{ flex: 1 }} keyboardShouldPersistTaps="handled" bottomOffset={20}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: ins.bottom + 30 }}>
        {finishErr ? <T size={12} color={c.danger} style={{ marginBottom: 8 }}>{finishErr}</T> : null}

        {/* stage: live interviewer hero */}
        <View style={[st.hero, { backgroundColor: c.forest, borderColor: c.forestLine }]}>
          {avatar.mounted ? (
            <AvatarTransport ref={avatar.transportRef} onEvent={avatar.onEvent} style={StyleSheet.absoluteFill} />
          ) : null}

          {avatar.phase === 'live' ? (
            <View style={[st.statusPill, { backgroundColor: c.overlay, flexDirection: ROW }]}>
              <Pulse color={avatar.speaking ? c.amber : c.sage} />
              <T size={11} w="semibold" color={c.onForest}>{avatar.speaking ? 'يتحدث الآن' : 'مباشر'}{avatar.isSandbox ? ' · تجربة مجانية' : ''}{avatar.maxSeconds ? ` · حد ${avatar.maxSeconds} ث` : ''}</T>
            </View>
          ) : null}

          {avatar.phase === 'starting' || avatar.phase === 'connecting' ? (
            <View style={[StyleSheet.absoluteFill, st.center, { backgroundColor: c.forest }]}>
              <ActivityIndicator color={c.sage} />
              <T size={13} align="center" color={c.onForest}>{avatar.phase === 'starting' ? 'نطلب جلسة من مزوّد الفيديو…' : 'نوصل بث المحاور…'}</T>
              <T size={11} align="center" color={c.onForestMuted}>مهلة الاتصال 35 ثانية</T>
              <Btn testID="avatar-cancel" label="إلغاء" icon="x" variant="forest" compact onPress={() => avatar.stop()} />
            </View>
          ) : null}

          {!avatar.mounted ? (
            <View style={st.setup}>
              {opts.isLoading ? <View style={{ gap: 10 }}><Skeleton h={120} /><Skeleton h={40} /></View>
                : opts.isError ? (
                  <View style={st.center}>
                    <T size={13} align="center" color={c.onForest}>تعذّر جلب خيارات المحاور المرئي.</T>
                    <Btn testID="avatar-options-retry" label="إعادة المحاولة" icon="refresh-cw" variant="forest" compact onPress={() => opts.refetch()} />
                  </View>
                ) : !o?.configured ? (
                  <View style={st.center}>
                    <Feather name="video-off" size={26} color={c.onForestMuted} />
                    <T size={14} w="semibold" align="center" color={c.onForest}>المحاور المرئي غير مُفعّل على الخادم</T>
                    <T size={12} align="center" color={c.onForestMuted}>المقابلة تعمل بالكامل بالصوت والنص.</T>
                  </View>
                ) : (
                  <>
                    {(avatar.phase === 'ended' || avatar.phase === 'error') && avatar.message ? (
                      <View style={[st.notice, { backgroundColor: avatar.phase === 'error' ? c.dangerSoft : c.forestSoft, flexDirection: ROW }]}>
                        <Feather name={avatar.phase === 'error' ? 'alert-triangle' : 'info'} size={14} color={avatar.phase === 'error' ? c.danger : c.sage} />
                        <T size={12} color={avatar.phase === 'error' ? c.danger : c.onForest} style={{ flex: 1 }}>{avatar.message}</T>
                        <Pressable testID="avatar-dismiss" hitSlop={8} onPress={avatar.reset}><Feather name="x" size={14} color={c.onForestMuted} /></Pressable>
                      </View>
                    ) : null}
                    {sandboxAvatar?.previewUrl ? (
                      <View style={st.preview}>
                        <Image source={{ uri: sandboxAvatar.previewUrl }} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} resizeMode="cover" />
                        <View style={[st.previewTag, { borderColor: c.sage, backgroundColor: c.overlay }]}>
                          <T size={11} color={c.onForest}>صورة معاينة فقط — ليست بثًا مباشرًا</T>
                        </View>
                      </View>
                    ) : null}
                    <T size={15} w="bold" color={c.onForest}>محاور فيديو تجريبي</T>
                    <T size={11} color={c.onForestMuted} style={{ lineHeight: 18 }}>عرض الفيديو لا يزال قيد التحقق. إذا لم تظهر الصورة، يمكنك متابعة المقابلة بالصوت أو النص.</T>
                    <T size={11} color={c.onForestMuted} style={{ lineHeight: 18 }}>
                      لا يبدأ إلا بضغطك. لا تُرسل كاميرتك ولا ميكروفونك إلى البث — يُرسل فقط صوت المحاور المُولَّد. يتوقف تلقائيًا عند الخروج أو بعد 5 دقائق دون نشاط.
                    </T>
                    <Btn testID="avatar-start-free" label={`تجربة مجانية (~${o.sandboxMaxSeconds} ث)`} icon="video" variant="sage"
                      onPress={() => avatar.start({ avatarId: o.sandboxAvatarId, isSandbox: true, acceptCharges: false })} />
                    <View style={[st.paid, { borderColor: c.forestLine, opacity: o.paidEnabled ? 1 : 0.55 }]}>
                      {o.paidEnabled && o.avatars.length > 1 ? (
                        <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: 6 }}>
                          {o.avatars.map((a) => (
                            <Pressable key={a.id} testID={'paid-avatar-' + a.id} onPress={() => setPaidAvatarId(a.id)}
                              style={[st.avChip, { borderColor: paidId === a.id ? c.sage : c.forestLine }]}>
                              <T size={11} color={paidId === a.id ? c.sage : c.onForestMuted}>{a.name}</T>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                      <Pressable testID="avatar-accept-charges" disabled={!o.paidEnabled} onPress={() => setAcceptCharges((v) => !v)} style={{ flexDirection: ROW, gap: 8, alignItems: 'center' }}>
                        <Feather name={acceptCharges ? 'check-square' : 'square'} size={16} color={c.onForest} />
                        <T size={11} color={c.onForestMuted} style={{ flex: 1 }}>{o.paidEnabled ? 'أوافق على أن الجلسة الكاملة تستهلك رصيدًا مدفوعًا' : 'الجلسة المدفوعة غير مفعّلة من المالك حاليًا'}</T>
                      </Pressable>
                      <Btn testID="avatar-start-paid" label="بدء الجلسة الكاملة" icon="play-circle" variant="forest" compact
                        disabled={!o.paidEnabled || !acceptCharges || !paidId}
                        onPress={() => { if (paidId) avatar.start({ avatarId: paidId, isSandbox: false, acceptCharges: true }); }} />
                    </View>
                  </>
                )}
            </View>
          ) : null}

          {avatar.phase === 'live' && avatar.audioBlocked ? (
            <Pressable testID="avatar-enable-audio" onPress={avatar.enableAudio} style={[st.audioBtn, { backgroundColor: c.onForest, flexDirection: ROW }]}>
              <Feather name="volume-2" size={14} color={c.forest} />
              <T size={12} w="bold" color={c.forest}>تفعيل صوت المحاور</T>
            </Pressable>
          ) : null}
          {avatar.phase === 'live' ? (
            <Pressable testID="avatar-stop" onPress={() => avatar.stop()} style={[st.stopBtn, { backgroundColor: c.overlay }]} accessibilityLabel="إيقاف البث">
              <Feather name="power" size={16} color={c.onForest} />
            </Pressable>
          ) : null}

          <View style={st.pip}><SelfView ref={selfRef} onReadyChange={onCamReady} /></View>
        </View>

        {/* question */}
        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: 8 }}>
            <View style={[st.stage, { backgroundColor: c.sageSoft }]}><T size={11} w="bold" color={c.primary}>{stageLabels[stage].ar}</T></View>
            <T size={11} color={c.mutedForeground}>سؤال {n} من {total}</T>
          </View>
          {session.currentQuestion ? (
            <T w="semibold" size={20} align={isEn ? 'left' : 'right'} style={{ marginTop: 12, lineHeight: 34 }}>{session.currentQuestion}</T>
          ) : <T color={c.mutedForeground} style={{ marginTop: 12 }}>لا يوجد سؤال حالي.</T>}
          <View style={{ flexDirection: ROW, gap: 8, marginTop: 12, alignItems: 'center' }}>
            {playing !== 'idle' ? (
              <Btn testID="stop-question-audio" label="إيقاف" icon="square" variant="secondary" compact onPress={stopQuestionAudio} />
            ) : (
              <Btn testID="read-question" label={avatar.phase === 'live' ? 'اطلب إعادة السؤال' : 'استمع للسؤال'} icon="volume-2" variant="secondary" compact
 disabled={busyVoice || !session.currentQuestion} onPress={() => void readQuestion()} />
            )}
            <Btn testID="toggle-input-mode" label={mode === 'voice' ? 'اكتب بدلًا من ذلك' : 'أجب بصوتك'} icon={mode === 'voice' ? 'type' : 'mic'} variant="ghost" compact
              disabled={busyVoice || submit.isPending} onPress={() => setInputMode(mode === 'voice' ? 'text' : 'voice')} />
          </View>
          {readErr ? <T size={12} color={c.danger} style={{ marginTop: 6 }}>{readErr}</T> : null}
        </View>

        {/* opt-in still snapshot per answer */}
        <View style={[st.vision, { backgroundColor: c.card, borderColor: visionOn ? c.amber : c.border }]}>
          <Pressable testID="vision-toggle" disabled={!camReady || busyVoice || submit.isPending || capturingText}
            onPress={() => { setVisionOn((v) => !v); setObservation(''); setVisionStatus('idle'); }}
            style={{ flexDirection: ROW, alignItems: 'center', gap: 10, opacity: camReady ? 1 : 0.5 }}
            accessibilityRole="switch" accessibilityState={{ checked: visionOn, disabled: !camReady }}>
            <Feather name={visionOn ? 'toggle-right' : 'toggle-left'} size={26} color={visionOn ? c.amber : c.mutedForeground} />
            <View style={{ flex: 1 }}>
              <T w="semibold" size={13}>أرسل صورة ثابتة واحدة مع كل إجابة</T>
              <T size={11} color={c.mutedForeground} style={{ lineHeight: 17 }}>
                {camReady ? 'عند التفعيل تُلتقط لقطة واحدة لحظة الإرسال وتُرسل مع إجابتك إلى خدمة الذكاء الاصطناعي لملاحظة ما يظهر من مواد متعلقة بالعمل فقط. لا فيديو مستمر، ولا تقييم للوجه أو المظهر، ولا تُرسل للمحاور المرئي، ولا يحتفظ التطبيق بالصور. الدرجات لا تعتمد على الكاميرا.' : 'شغّل الكاميرا أولًا لتفعيل هذا الخيار. الكاميرا محلية فقط ما دام الخيار مطفأ.'}
              </T>
            </View>
          </Pressable>
          {visionOn || visionStatus === 'error' ? (
            <T testID="vision-status" size={11} w="semibold" color={visionStatus === 'error' ? c.danger : c.amber} style={{ marginTop: 6 }}>
              {visionStatus === 'capturing' ? 'نلتقط الصورة…' : visionStatus === 'sent' ? 'أُرسلت لقطة واحدة مع آخر إجابة.' : visionStatus === 'error' ? 'فشل التقاط الصورة — لم تُرسل الإجابة.' : 'مفعّل: ستُرسل لقطة واحدة مع الإجابة التالية.'}
            </T>
          ) : null}
          {observation ? (
            <View testID="vision-observation" style={[st.transcript, { backgroundColor: c.amberSoft, marginTop: 8 }]}>
              <T size={11} w="bold" color={c.foreground}>ملاحظة من اللقطة (مؤقتة، لا تؤثر على الدرجة)</T>
              <T size={12} align={isEn ? 'left' : 'right'} style={{ lineHeight: 19 }}>{observation}</T>
            </View>
          ) : null}
        </View>

        {/* answer */}
        {mode === 'voice' ? (
          <Card style={{ marginTop: 18, alignItems: 'center', gap: 12 }}>
            {perm === 'denied' ? (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <T size={13} align="center" color={c.danger}>إذن الميكروفون مرفوض. فعّله من الإعدادات أو أجب كتابيًا.</T>
                {Platform.OS !== 'web' ? <Btn testID="open-settings-mic" label="فتح الإعدادات" icon="settings" variant="secondary" compact onPress={() => { Linking.openSettings().catch(() => undefined); }} /> : null}
              </View>
            ) : null}
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: 18 }}>
              {recState === 'recording' ? (
                <Pressable testID="cancel-recording" onPress={() => void cancelRecording()} hitSlop={10} accessibilityLabel="إلغاء التسجيل">
                  <Feather name="x" size={22} color={c.mutedForeground} />
                </Pressable>
              ) : null}
              <Pressable
                testID={recState === 'recording' ? 'stop-recording' : 'start-recording'}
                disabled={recState === 'processing' || perm === 'requesting'}
                onPress={() => (recState === 'recording' ? void stopAndSend() : void startRecording())}
                style={({ pressed }) => [st.mic, { backgroundColor: recState === 'recording' ? c.danger : c.primary, opacity: recState === 'processing' ? 0.6 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
                accessibilityLabel={recState === 'recording' ? 'إيقاف وإرسال' : 'ابدأ التسجيل'}
              >
                {recState === 'processing' || perm === 'requesting' ? <ActivityIndicator color={c.primaryForeground} />
                  : <Feather name={recState === 'recording' ? 'square' : 'mic'} size={30} color={c.primaryForeground} />}
              </Pressable>
              {recState === 'recording' ? <View style={{ flexDirection: ROW, alignItems: 'center', gap: 6 }}><Pulse color={c.danger} /><T size={13} w="bold" color={c.danger}>{`${Math.floor(recSecs / 60)}:${String(recSecs % 60).padStart(2, '0')}`}</T></View> : null}
            </View>
            <T size={12} align="center" color={c.mutedForeground}>
              {recState === 'recording' ? 'نستمع… اضغط المربع للإرسال' : recState === 'processing' ? 'نحلل إجابتك ونجهّز السؤال التالي…' : 'اضغط للتسجيل، ثم اضغط مجددًا للإرسال'}
            </T>
            {userTranscript ? (
              <View style={[st.transcript, { backgroundColor: c.muted }]}>
                <T size={11} w="bold" color={c.mutedForeground}>إجابتك</T>
                <T size={13} align={isEn ? 'left' : 'right'} style={{ lineHeight: 21 }}>{userTranscript}</T>
              </View>
            ) : null}
            {interviewerText && recState === 'processing' ? (
              <View style={[st.transcript, { backgroundColor: c.sageSoft }]}>
                <T size={11} w="bold" color={c.primary}>المحاور</T>
                <T size={13} align={isEn ? 'left' : 'right'} style={{ lineHeight: 21 }}>{interviewerText}</T>
              </View>
            ) : null}
            {voiceErr ? <T size={12} align="center" color={c.danger}>{voiceErr}</T> : null}
            {pending && recState === 'idle' ? (
              <View style={{ flexDirection: ROW, gap: 8 }}>
                <Btn testID="retry-voice" label="أعد الإرسال" icon="upload" compact disabled={pending.qn !== session.turnNumber} onPress={() => void sendVoice(pending.uri, pending.qn)} />
                <Btn testID="discard-voice" label="تجاهل" icon="trash-2" variant="ghost" compact onPress={() => { setPending(null); setUserTranscript(''); setVoiceErr(null); }} />
              </View>
            ) : null}
            {failedTranscript && recState === 'idle' && pending?.qn === session.turnNumber ? (
              <Btn testID="use-transcript-as-text" label={draft.trim() ? 'إلحاق النص بالمسودة' : 'حرّر النص وأرسله كتابيًا'} icon="edit-3" variant="secondary" compact
                onPress={() => { const base = draftRef.current.trim(); onDraft(base ? base + '\n' + failedTranscript : failedTranscript); setInputMode('text'); }} />
            ) : null}
          </Card>
        ) : (
          <View style={{ marginTop: 18 }}>
            <View style={[st.textBox, { backgroundColor: c.card, borderColor: textErr ? c.danger : c.border }]}>
              <TextInput testID="answer-input" value={draft} onChangeText={onDraft} multiline maxLength={5000}
                placeholder={isEn ? 'Type your answer…' : 'اكتب إجابتك هنا…'} placeholderTextColor={c.mutedForeground}
                style={{ minHeight: 140, color: c.foreground, fontFamily: F.regular, fontSize: 15, lineHeight: 24, textAlign: isEn ? 'left' : 'right', textAlignVertical: 'top' }} />
            </View>
            <View style={{ flexDirection: ROW, justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <T size={11} color={c.mutedForeground}>{draft.length}/5000 · المسودة محفوظة</T>
              <Btn testID="submit-answer" label="إرسال" icon="send" loading={submit.isPending || capturingText} disabled={!draft.trim()} onPress={() => void submitText()} />
            </View>
            {textErr ? <T size={12} color={c.danger} style={{ marginTop: 8 }}>{textErr}</T> : null}
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const st = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center', gap: 14, borderBottomWidth: 1 },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  finish: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, minWidth: 60, alignItems: 'center' },
  hero: { minHeight: 420, borderWidth: 1, overflow: 'hidden', borderTopLeftRadius: 26, borderTopRightRadius: 6, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18 },
  setup: { padding: 16, paddingBottom: 150, gap: 10 },
  notice: { padding: 10, borderRadius: 10, gap: 8, alignItems: 'center' },
  preview: { height: 120, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end', padding: 8 },
  previewTag: { alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  paid: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  avChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusPill: { position: 'absolute', top: 12, right: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', gap: 6 },
  audioBtn: { position: 'absolute', top: 52, right: 12, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 6 },
  stopBtn: { position: 'absolute', top: 12, left: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pip: { position: 'absolute', bottom: 12, left: 12 },
  stage: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  mic: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  vision: { marginTop: 16, borderWidth: 1, borderRadius: 14, padding: 12 },
  transcript: { alignSelf: 'stretch', borderRadius: 12, padding: 12, gap: 4 },
  textBox: { borderWidth: 1, padding: 14, borderTopLeftRadius: 16, borderTopRightRadius: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
});
