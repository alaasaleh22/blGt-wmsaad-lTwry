import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ArrowLeft, ArrowUpLeft, ArrowUpRight, Check, CircleHelp, Clock3, Mic, MicOff, Send, Sparkles, Volume2 } from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { getGetInterviewQueryKey, useCreateInterview, useFinishInterview, useGetInterview, useSubmitInterviewAnswer } from '@workspace/api-client-react';
import type { InterviewDetail, InterviewEvaluation, InterviewInput, InterviewSession, InterviewTurn } from '@workspace/api-client-react';
import { InterviewRoom, type CameraSnapshotHandle } from '@/components/interview-room';
import { AvatarEmbed } from '@/components/avatar-embed';
import { AvatarStage } from '@/components/avatar-stage';
import { useLiveAvatar } from '@/hooks/use-live-avatar';
import { professionCatalog, trackLabels, findTrackForJob, stageFor, stageLabels } from '@/lib/professions';
import { useVoiceRecorder, useVoiceStream } from '@workspace/integrations-openai-ai-react/audio';

const LAST_SESSION_KEY = 'interview-simulator:last-session';
const queryClient = new QueryClient();

const experienceLabels: Record<InterviewInput['experienceLevel'], string> = {
  junior: 'مبتدئ', mid: 'متوسط الخبرة', senior: 'خبير',
};

function Header() {
  return <header className="topbar" dir="rtl">
    <Link href="/" className="brand" data-testid="link-home">
      <span className="brand-mark" aria-hidden="true">م</span>
      <span data-testid="text-app-name">مِرْآة <span style={{ fontWeight: 400, color: '#6b7b7d' }}>للمقابلات</span></span>
    </Link>
    <div className="top-meta"><span className="language-pill" data-testid="status-language">العربية أولاً</span><span data-testid="text-product-promise">تدرّب بتركيز. تقدّم بثقة.</span></div>
  </header>;
}

function RadioChoice({ name, value, selected, label, onChange, testId }: {
  name: string; value: string | number; selected: string | number; label: string; onChange: (value: string | number) => void; testId: string;
}) {
  return <label className="choice" data-testid={`option-${testId}`}>
    <input type="radio" name={name} value={value} checked={selected === value} onChange={() => onChange(value)} data-testid={`input-${testId}`} />
    <span>{label}</span>
  </label>;
}

function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [lastId] = useState(() => localStorage.getItem(LAST_SESSION_KEY) ?? '');
  const resumeQuery = useGetInterview(lastId, { query: { enabled: !!lastId, queryKey: getGetInterviewQueryKey(lastId), retry: false } });
  const createInterview = useCreateInterview();
  const [roleTitle, setRoleTitle] = useState('');
  const [track, setTrack] = useState<InterviewInput['track']>('software');
  const [experienceLevel, setExperienceLevel] = useState<InterviewInput['experienceLevel']>('mid');
  const [language, setLanguage] = useState<InterviewInput['language']>('ar');
  const [mode, setMode] = useState<InterviewInput['mode']>('voice');
  const [questionCount, setQuestionCount] = useState<InterviewInput['questionCount']>(20);

  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: InterviewInput = { roleTitle: roleTitle.trim(), track, experienceLevel, language, mode, questionCount };
    createInterview.mutate({ data: input }, {
      onSuccess: (detail) => {
        const id = detail.session.id;
        localStorage.setItem(LAST_SESSION_KEY, id);
        queryClient.setQueryData(getGetInterviewQueryKey(id), detail);
        setLocation(`/session/${encodeURIComponent(id)}`);
      },
    });
  };
  const lastSession = resumeQuery.data?.session;
  const resumeDescription = lastSession?.language === 'en'
    ? `${lastSession.roleTitle} · question ${lastSession.turnNumber} of ${lastSession.questionCount}`
    : `${lastSession?.roleTitle ?? ''} · السؤال ${lastSession?.turnNumber ?? 0} من ${lastSession?.questionCount ?? 0}`;

  return <div className="app-shell">
    <Header />
    <main className="home-wrap" dir="rtl">
      <section className="home-hero">
        <div>
          <div className="eyebrow" data-testid="text-home-eyebrow">مختبر المقابلات لكل المهن</div>
          <h1 data-testid="text-home-heading">المقابلة القادمة؟<br /><span style={{ color: '#367a68' }}>ابدأها هنا.</span></h1>
          <p data-testid="text-home-description">تدرّب على أسئلة واقعية تتكيّف مع إجاباتك. من التمريض والتعليم إلى الهندسة والمبيعات والحِرف — اختر مهنتك، وتدرّب في مقابلة افتراضية كاملة من ١٥ إلى ٢٠ سؤالاً، ثم احصل على ملاحظات واضحة تساعدك على التقدّم.</p>
        </div>
        <aside className="hero-note" data-testid="card-practice-note"><small>محاكاة واقعية · ملاحظات عملية</small><strong dir="ltr">PRACTICE / REFLECT</strong><small>رابط العودة إلى جلستك محفوظ على هذا الجهاز.</small></aside>
      </section>
      <div className="layout-grid">
        <form className="panel form-panel" onSubmit={onCreate} data-testid="form-create-session">
          <div className="panel-heading"><div><h2 data-testid="text-form-heading">جهّز جلستك</h2><p>خصص المقابلة لتناسب الدور الذي تستهدفه.</p></div><span className="step-tag">01 / 04</span></div>
          <div className="form-grid">
            <div className="field" style={{ gridColumn: '1 / -1' }}><label htmlFor="roleTitle">المسمّى الوظيفي</label><input id="roleTitle" required minLength={2} maxLength={120} value={roleTitle} list="job-suggestions" onChange={(e) => { const v = e.target.value; setRoleTitle(v); const t = findTrackForJob(v); if (t) setTrack(t); }} placeholder="اكتب مهنتك أو اختر من الاقتراحات" data-testid="input-role-title" /><datalist id="job-suggestions">{professionCatalog.flatMap((c) => c.jobs.map((j) => <option key={`${c.key}-${j}`} value={j}>{c.label}</option>))}</datalist>
              <div className="job-chips" data-testid="list-job-suggestions">{(professionCatalog.find((c) => c.key === track)?.jobs ?? []).map((j) => <button type="button" key={j} className={`job-chip${roleTitle === j ? ' on' : ''}`} onClick={() => setRoleTitle(j)} data-testid={`button-job-${j}`}>{j}</button>)}</div></div>
            <div className="field"><label htmlFor="track">المسار المهني</label><select id="track" value={track} onChange={(e) => setTrack(e.target.value as InterviewInput['track'])} data-testid="select-track">{Object.entries(trackLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            <div className="field"><label htmlFor="experience">مستوى الخبرة</label><select id="experience" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as InterviewInput['experienceLevel'])} data-testid="select-experience">{Object.entries(experienceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          </div>
          <div className="options-row">
            <fieldset className="choice-set"><legend className="group-label">لغة المقابلة</legend><div className="choice-options">
              <RadioChoice name="language" value="ar" selected={language} label="العربية" onChange={(value) => setLanguage(value as InterviewInput['language'])} testId="language-ar" />
              <RadioChoice name="language" value="en" selected={language} label="English" onChange={(value) => setLanguage(value as InterviewInput['language'])} testId="language-en" />
            </div></fieldset>
            <fieldset className="choice-set"><legend className="group-label">طريقة التدريب</legend><div className="choice-options">
              <RadioChoice name="mode" value="voice" selected={mode} label="صوت مع كاميرا اختيارية" onChange={(value) => setMode(value as InterviewInput['mode'])} testId="mode-voice" />
              <RadioChoice name="mode" value="text" selected={mode} label="كتابي" onChange={(value) => setMode(value as InterviewInput['mode'])} testId="mode-text" />
            </div></fieldset>
            <div className="field"><label htmlFor="questionCount">عدد الأسئلة (1–20)</label><select id="questionCount" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value) as InterviewInput['questionCount'])} data-testid="select-question-count">{Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} سؤالاً{n === 20 ? ' · مقابلة كاملة' : ''}</option>)}</select></div>
          </div>
          {createInterview.isError && <div role="alert" className="voice-transcript" data-testid="error-create-session">تعذّر بدء الجلسة. تحقق من الاتصال وحاول مرة أخرى.</div>}
          <div className="submit-row"><span className="subtle" data-testid="text-session-privacy">جلسة خاصة · يمكنك العودة إليها لاحقاً</span>
            <button className="primary-btn" type="submit" disabled={createInterview.isPending} data-testid="button-create-session">{createInterview.isPending ? 'جارٍ إعداد المقابلة…' : <>ابدأ المقابلة <ArrowUpLeft size={17} /></>}</button>
          </div>
        </form>
        <aside>
          {lastId && resumeQuery.isLoading && <div className="panel loading-card" data-testid="status-resume-loading"><div className="skeleton loading-line" /><div className="skeleton loading-line" /></div>}
          {lastId && resumeQuery.isError && <section className="panel resume-empty" data-testid="status-resume-error">لم نتمكن من استعادة آخر جلسة. يمكنك بدء جلسة جديدة، وسيتم حفظ رابطها على هذا الجهاز.</section>}
          {lastSession?.status === 'active' && <section className="panel resume-panel" data-testid="card-resume-session">
            <div className="resume-kicker">لديك جلسة مفتوحة</div><h3 data-testid="text-resume-title">{lastSession.language === 'en' ? 'Resume your practice' : 'أكمل تدريبك'}</h3>
            <p data-testid="text-resume-description">{resumeDescription}</p>
            <Link href={`/session/${encodeURIComponent(lastSession.id)}`} className="primary-btn" data-testid="link-resume-session">العودة إلى الجلسة <ArrowUpLeft size={16} /></Link>
          </section>}
          {lastSession?.status === 'completed' && <section className="panel resume-empty" data-testid="card-last-completed"><div className="resume-kicker">آخر جلسة مكتملة</div><p data-testid="text-completed-resume">{resumeDescription}</p><Link href={`/session/${encodeURIComponent(lastSession.id)}`} className="secondary-btn" data-testid="link-view-result">عرض النتيجة <ArrowUpLeft size={16} /></Link></section>}
          {!lastId && <div className="resume-empty" data-testid="empty-resume-session"><Clock3 size={18} style={{ marginBottom: 9 }} /><br />لا توجد جلسة سابقة بعد. ابدأ تدريبك الأول وستجد طريق العودة هنا.</div>}
          <div className="promise" data-testid="text-feedback-promise"><strong>ما الذي ستحصل عليه؟</strong><br />تقييم لكل إجابة، نقاط قوة محددة، وخطوات تالية قابلة للتطبيق.</div>
        </aside>
      </div>
    </main>
  </div>;
}

function SessionRoute() {
  const params = useParams<{ id: string }>();
  return <Session id={decodeURIComponent(params.id ?? '')} />;
}

function Session({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const interview = useGetInterview(id, { query: { enabled: !!id, queryKey: getGetInterviewQueryKey(id), retry: 1 } });
  const submitAnswer = useSubmitInterviewAnswer({
    mutation: {
      onSettled: (_data, _error, variables) => {
        delete variables.data.candidateImage;
      },
    },
  });
  const finishInterview = useFinishInterview();
  const [answer, setAnswer] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [recordingFailed, setRecordingFailed] = useState(false);
  const recorder = useVoiceRecorder();
  const avatar = useLiveAvatar(id);
  const avatarRef = useRef(avatar);
  avatarRef.current = avatar;
  const cameraRef = useRef<CameraSnapshotHandle>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [visionOn, setVisionOn] = useState(false);
  const [visionError, setVisionError] = useState('');
  const [visionSent, setVisionSent] = useState(false);
  const [observation, setObservation] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const visionOnRef = useRef(false);
  visionOnRef.current = visionOn;
  const recordingQuestionRef = useRef<number | null>(null);
  const [pendingVoice, setPendingVoice] = useState<{ blob: Blob; qn: number | null } | null>(null);
  const voiceCommittedRef = useRef(false);
  const onCameraReadyChange = useCallback((ready: boolean) => {
    setCameraReady(ready);
    if (!ready) { setVisionOn(false); setObservation(''); setVisionSent(false); }
  }, []);
  /** One still snapshot only when sharing is enabled; throws so a failed capture never silently uploads. */
  const captureIfEnabled = async (english: boolean): Promise<string | undefined> => {
    setObservation(''); setVisionError(''); setVisionSent(false);
    if (!visionOnRef.current) return undefined;
    setIsCapturing(true);
    try {
      const img = await cameraRef.current?.getSnapshot();
      if (!img || img.length > 1_000_000) throw new Error('bad image');
      setVisionSent(true);
      return img;
    } catch {
      const msg = english ? 'Could not capture the camera snapshot, so the answer was not sent. Try again or turn snapshot sharing off.' : 'تعذّر التقاط صورة الكاميرا، فلم تُرسل الإجابة. أعد المحاولة أو أوقف مشاركة اللقطة.';
      setVisionError(msg);
      throw new Error(msg);
    } finally {
      setIsCapturing(false);
    }
  };
  const readingQuestionRef = useRef(false);
  const forwardedRef = useRef(false);
  const [isReadingQuestion, setIsReadingQuestion] = useState(false);
  const streamOptions = {
    workletPath: `${import.meta.env.BASE_URL}audio-playback-worklet.js`,
    onUserTranscript: (text: string) => { if (readingQuestionRef.current) return; setVoiceTranscript(text); setAnswer(text); },
    onTranscript: (_: string, full: string) => setVoiceStatus(full),
    onVisualContext: (text: string) => setObservation(text),
    onAudioChunk: (base64: string): boolean => {
      const ok = avatarRef.current.sendAudio(base64);
      if (ok) forwardedRef.current = true;
      return ok;
    },
    onComplete: () => {
      if (forwardedRef.current) { forwardedRef.current = false; avatarRef.current.finishSpeech(); }
      if (readingQuestionRef.current) { readingQuestionRef.current = false; setVoiceStatus(''); return; }
      voiceCommittedRef.current = true;
      setVoiceStatus('');
      setVoiceError('');
      setAnswer('');
      setVoiceTranscript('');
      void queryClient.invalidateQueries({ queryKey: getGetInterviewQueryKey(id) });
    },
    onError: (error: Error) => { setVoiceError(error.message); setVoiceStatus(''); },
  };
  const stream = useVoiceStream(streamOptions as Parameters<typeof useVoiceStream>[0]);
  const streamVoice = stream.streamVoiceResponse as (url: string, audioBlob?: Blob) => Promise<void>;
  const readQuestion = async () => {
    if (readingQuestionRef.current || recorder.state === 'recording') return;
    avatarRef.current.interrupt();
    readingQuestionRef.current = true; forwardedRef.current = false;
    setIsReadingQuestion(true);
    try {
      await streamVoice(`/api/interviews/${encodeURIComponent(id)}/question-audio`);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'تعذّر تشغيل السؤال.');
    } finally {
      readingQuestionRef.current = false;
      setIsReadingQuestion(false);
    }
  };
  const readQuestionRef = useRef(readQuestion);
  readQuestionRef.current = readQuestion;
  const sessionStatus = interview.data?.session.status;
  useEffect(() => { if (sessionStatus === 'completed') avatarRef.current.stop(); }, [sessionStatus]);
  useEffect(() => { if (id) localStorage.setItem(LAST_SESSION_KEY, id); }, [id]);
  const session = interview.data?.session;
  const isEnglish = session?.language === 'en';
  const copy = useMemo(() => isEnglish ? {
    home: 'Back to setup', question: 'Question', of: 'of', answer: 'Your answer', placeholder: 'Think aloud. Structure your answer with context, approach, and outcome…',
    hint: 'Take a moment to organize your thoughts. Specific examples make stronger answers.',
    send: 'Submit answer', submitting: 'Reviewing your answer…', finish: 'Finish interview', turns: 'Interview path',
    voice: 'Voice practice', start: 'Start recording', stop: 'Stop & send', permission: 'Allow microphone access to practise by voice.',
    fallback: 'Microphone unavailable? You can still type your answer below.', retry: 'Try again',
  } : {
    home: 'العودة للإعداد', question: 'السؤال', of: 'من', answer: 'إجابتك', placeholder: 'فكّر بصوت مسموع. رتّب إجابتك: السياق، المنهج، ثم النتيجة…',
    hint: 'خذ لحظة لتنظيم أفكارك. الأمثلة المحددة تجعل إجابتك أقوى.',
    send: 'أرسل الإجابة', submitting: 'نراجع إجابتك…', finish: 'إنهاء المقابلة', turns: 'مسار المقابلة',
    voice: 'تدريب صوتي', start: 'ابدأ التسجيل', stop: 'أوقف وأرسل', permission: 'اسمح باستخدام الميكروفون للتدرب صوتياً.',
    fallback: 'الميكروفون غير متاح؟ يمكنك كتابة إجابتك أدناه.', retry: 'حاول مجدداً',
  }, [isEnglish]);

  const updateDetail = (next: InterviewDetail) => {
    queryClient.setQueryData(getGetInterviewQueryKey(id), next);
    void queryClient.invalidateQueries({ queryKey: getGetInterviewQueryKey(id) });
  };
  const sendTextAnswer = async () => {
    if (!answer.trim() || !session || isCapturing || isVoiceProcessing || isStartingRecording || recorder.state === 'recording' || submitAnswer.isPending || finishInterview.isPending) return;
    let candidateImage: string | undefined;
    try { candidateImage = await captureIfEnabled(isEnglish); } catch { return; }
    submitAnswer.mutate({ id, data: { answer: answer.trim(), ...(candidateImage ? { candidateImage } : {}) } }, {
      onSuccess: (result) => {
        const vo = (result as { visualObservation?: string | null }).visualObservation;
        if (vo) setObservation(vo);
        const current = queryClient.getQueryData<InterviewDetail>(getGetInterviewQueryKey(id));
        const turns = [...(current?.turns ?? [])];
        const at = turns.findIndex((turn) => turn.id === result.turn.id);
        if (at >= 0) turns[at] = result.turn; else turns.push(result.turn);
        updateDetail({ session: result.session, turns });
        setAnswer('');
      },
    });
  };
  const onFinish = () => finishInterview.mutate({ id }, { onSuccess: updateDetail });
  const beginRecording = async () => {
    if (isVoiceProcessing || isStartingRecording || submitAnswer.isPending || finishInterview.isPending) return;
    setIsStartingRecording(true);
    avatar.interrupt();
    setVoiceStatus('');
    setVoiceError(''); setRecordingFailed(false); setVoiceTranscript('');
    try {
      recordingQuestionRef.current = session?.turnNumber ?? null;
      await recorder.startRecording();
      avatar.setListening(true);
    } catch {
      setRecordingFailed(true);
      setVoiceError(isEnglish ? 'Microphone permission was denied or unavailable.' : 'تعذّر الوصول إلى الميكروفون. تحقق من الأذونات أو استخدم الكتابة.');
    } finally {
      setIsStartingRecording(false);
    }
  };
  const sendVoiceBlob = async (blob: Blob, qn: number | null) => {
    if (qn !== null && session && session.turnNumber !== qn) {
      setPendingVoice(null);
      setVoiceError(isEnglish ? 'This recording belongs to an earlier question and was not sent.' : 'هذا التسجيل يخص سؤالًا سابقًا ولم يُرسل.');
      return;
    }
    setPendingVoice({ blob, qn });
    setIsVoiceProcessing(true);
    setVoiceError('');
    voiceCommittedRef.current = false;
    try {
      const candidateImage = await captureIfEnabled(isEnglish);
      setVoiceStatus(isEnglish ? 'Transcribing and preparing feedback…' : 'جارٍ تحويل الصوت وتجهيز الملاحظات…');
      await stream.streamVoiceResponse(`/api/interviews/${encodeURIComponent(id)}/voice-turn`, blob, { ...(qn !== null ? { expectedQuestionNumber: qn } : {}), ...(candidateImage ? { candidateImage } : {}) });
      if (voiceCommittedRef.current) setPendingVoice(null);
      else setVoiceError(isEnglish ? 'The answer was not confirmed. Retry or discard the recording.' : 'لم يُؤكَّد حفظ الإجابة. أعد الإرسال أو تجاهل التسجيل.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (/\(409\b/.test(msg)) {
        setPendingVoice(null);
        setVoiceError(isEnglish ? 'The current question changed before this recording was sent, so it was not counted. Please record again for the new question.' : 'تغيّر السؤال الحالي قبل إرسال التسجيل فلم يُحتسب. سجّل إجابتك للسؤال الجديد.');
        void queryClient.invalidateQueries({ queryKey: getGetInterviewQueryKey(id) });
      } else {
        setVoiceError(msg || (isEnglish ? 'Voice request failed.' : 'تعذّر إرسال التسجيل.'));
      }
    } finally {
      setIsVoiceProcessing(false);
      setVoiceStatus('');
    }
  };
  const endRecording = async () => {
    if (isVoiceProcessing || recorder.state !== 'recording') return;
    setIsVoiceProcessing(true);
    let blob: Blob;
    try {
      blob = await recorder.stopRecording();
      avatar.setListening(false);
      if (!blob.size) throw new Error(isEnglish ? 'No audio was recorded.' : 'لم يتم تسجيل صوت.');
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : (isEnglish ? 'Voice request failed.' : 'تعذّر إرسال التسجيل.'));
      setIsVoiceProcessing(false);
      return;
    }
    await sendVoiceBlob(blob, recordingQuestionRef.current);
  };

  if (interview.isLoading) return <div className="app-shell"><Header /><main className="session-content"><div className="panel loading-card" data-testid="status-session-loading"><div className="skeleton loading-line" style={{ width: '40%' }} /><div className="skeleton loading-line" style={{ height: 42, width: '80%' }} /><div className="skeleton loading-line" style={{ height: 150 }} /></div><div className="panel loading-card"><div className="skeleton loading-line" /><div className="skeleton loading-line" /></div></main></div>;
  if (interview.isError || !interview.data || !session) return <div className="app-shell"><Header /><main className="panel error-panel" role="alert" data-testid="error-session-load" dir="rtl"><CircleHelp size={30} color="#367a68" /><h1>تعذّر فتح الجلسة</h1><p>قد يكون الرابط غير صالح أو أن الاتصال انقطع. حاول تحميل الجلسة مرة أخرى.</p><button className="primary-btn" onClick={() => void interview.refetch()} data-testid="button-retry-session">{copy.retry}</button><Link href="/" className="quiet-btn" data-testid="link-home-error">{copy.home}</Link></main></div>;
  const detail = interview.data;
  if (session.status === 'completed' && session.evaluation) return <Result session={session} turns={detail.turns} evaluation={session.evaluation} />;

  const currentTurn = detail.turns.find((turn) => turn.questionNumber === session.turnNumber) ?? detail.turns[detail.turns.length - 1];
  const latestAnsweredTurn = [...detail.turns].reverse().find((turn) => turn.answer !== null);
  const currentQuestion = session.currentQuestion ?? currentTurn?.question ?? '';
  const progress = Math.min(100, ((session.turnNumber - 1) / session.questionCount) * 100);
  const questionOrdinal = Math.min(session.turnNumber, session.questionCount);
  const stage = stageLabels[stageFor(questionOrdinal, session.questionCount)];
  const roomPhase = recorder.state === 'recording' ? 'listening' : (stream.playbackState === 'playing' || (avatar.ready && (avatar.speaking || avatar.agentState === 'talking'))) ? 'speaking' : (isVoiceProcessing || isStartingRecording) ? 'processing' : 'idle';
  const direction = isEnglish ? 'ltr' : 'rtl';
  const mutationPending = isCapturing || submitAnswer.isPending || finishInterview.isPending || isVoiceProcessing || isStartingRecording || recorder.state === 'recording' || isReadingQuestion;

  return <div className="app-shell session-page" dir={direction}>
    <Header />
    <div className="session-top"><Link href="/" className="back-link" data-testid="link-session-home">{isEnglish ? <ArrowLeft size={16} /> : <ArrowUpRight size={16} />}{copy.home}</Link><button className="quiet-btn" onClick={onFinish} disabled={mutationPending || !detail.turns.some((turn) => turn.answer !== null)} data-testid="button-finish-interview">{finishInterview.isPending ? '…' : copy.finish}</button></div>
    <div className="session-title"><div><div className="eyebrow" data-testid="text-session-track">{isEnglish ? session.track : (trackLabels[session.track] ?? session.track)}</div><h1 data-testid="text-session-role">{session.roleTitle}</h1></div><div className="session-tags"><span className="tag" data-testid="status-session-active">{isEnglish ? 'In progress' : 'قيد التدريب'}</span><span className="tag" data-testid="text-session-level">{isEnglish ? session.experienceLevel : experienceLabels[session.experienceLevel]}</span></div></div>
    <main className="session-content">
      <div>
        <section className="panel question-card" data-testid="card-current-question">
          <div className="question-number"><span data-testid="text-question-position">{copy.question} {questionOrdinal} {copy.of} {session.questionCount}</span><div className="progress-track" aria-label={`${progress}%`}><div className="progress-fill" style={{ transform: `scaleX(${progress / 100})` }} /></div></div>
          <span className="stage-pill" data-testid="text-question-stage">{isEnglish ? stage.en : stage.ar}</span>
          <h2 data-testid="text-current-question">{currentQuestion || (isEnglish ? 'Your next question is being prepared…' : 'يجري إعداد السؤال التالي…')}</h2>
          <p className="coach-hint" data-testid="text-answer-hint">{copy.hint}</p>
          <InterviewRoom english={isEnglish} phase={roomPhase} stageLabel={isEnglish ? stage.en : stage.ar} active={session.status === 'active'} interviewer={<AvatarStage interviewId={id} avatar={avatar} english={isEnglish} onStart={(input) => void avatar.start(input, () => void readQuestionRef.current())} onReadQuestion={() => void readQuestion()} readDisabled={isReadingQuestion || isVoiceProcessing || recorder.state === 'recording' || !currentQuestion} />} cameraRef={cameraRef} onCameraReadyChange={onCameraReadyChange} sharing={visionOn} />
          {<section className="voice-box" data-testid="panel-vision-consent">
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', opacity: cameraReady ? 1 : 0.55 }}>
              <input type="checkbox" role="switch" checked={visionOn} disabled={!cameraReady || mutationPending} onChange={(e) => { setVisionOn(e.target.checked); setObservation(''); setVisionError(''); setVisionSent(false); }} data-testid="vision-toggle" />
              <span><strong>{isEnglish ? 'Send one still photo with each answer' : 'أرسل صورة ثابتة واحدة مع كل إجابة'}</strong><br /><span className="subtle">{cameraReady
                ? (isEnglish ? 'When on, a single snapshot is taken at the moment you submit and sent with that answer to the AI service, which only notes job-relevant visible materials. No continuous video, no face/appearance/emotion grading, nothing sent to the video interviewer, nothing stored by the app. Scores do not use the camera.' : 'عند التفعيل تُلتقط لقطة واحدة لحظة الإرسال وتُرسل مع الإجابة إلى خدمة الذكاء الاصطناعي لملاحظة المواد المرئية المتعلقة بالعمل فقط. لا فيديو مستمر، ولا تقييم للوجه أو المظهر أو المشاعر، ولا تُرسل للمحاور المرئي، ولا يحتفظ التطبيق بالصور. الدرجات لا تعتمد على الكاميرا.')
                : (isEnglish ? 'Turn on your camera first to enable this. It stays off by default.' : 'شغّل الكاميرا أولًا لتفعيل هذا الخيار. الخيار مطفأ افتراضيًا.')}</span></span>
            </label>
            {(visionOn || visionError) && <p className="voice-transcript" role={visionError ? 'alert' : 'status'} data-testid="vision-status">{visionError || (isCapturing ? (isEnglish ? 'Capturing snapshot…' : 'نلتقط الصورة…') : visionSent ? (isEnglish ? 'One snapshot was sent with your last answer.' : 'أُرسلت لقطة واحدة مع آخر إجابة.') : (isEnglish ? 'On: one snapshot will be sent with your next answer.' : 'مفعّل: ستُرسل لقطة واحدة مع إجابتك التالية.'))}</p>}
            {observation && <p className="voice-transcript" data-testid="vision-observation"><strong>{isEnglish ? 'Snapshot note (temporary, not scored)' : 'ملاحظة من اللقطة (مؤقتة، لا تؤثر على الدرجة)'}:</strong> {observation}</p>}
          </section>}
          {session.mode === 'voice' && <section className="voice-box" data-testid="panel-voice-practice">
            <div className="voice-head"><strong>{copy.voice}</strong><span className="voice-status" aria-live="polite" data-testid="status-voice">{recorder.state === 'recording' ? <><i className="status-dot live" />{isEnglish ? 'Recording' : 'يسجّل الآن'}</> : isStartingRecording ? (isEnglish ? 'Requesting microphone access…' : 'جارٍ طلب إذن الميكروفون…') : voiceStatus ? <><i className="status-dot" />{voiceStatus}</> : <><i className="status-dot" />{copy.permission}</>}</span></div>
            <div className="voice-controls">{recorder.state === 'recording'
              ? <><button className="record-btn recording" onClick={() => void endRecording()} disabled={isVoiceProcessing} data-testid="button-stop-recording"><MicOff size={16} />{copy.stop}</button><button className="quiet-btn" onClick={() => { recorder.cancelRecording(); avatar.setListening(false); setVoiceStatus(''); }} disabled={isVoiceProcessing} data-testid="button-cancel-recording">{isEnglish ? 'Cancel recording' : 'إلغاء التسجيل'}</button></>
              : <button className="record-btn" onClick={() => void beginRecording()} disabled={mutationPending} data-testid="button-start-recording"><Mic size={16} />{copy.start}</button>}
              <span className="subtle"><Volume2 size={14} style={{ verticalAlign: 'middle' }} /> {copy.fallback}</span>
            </div>
            {voiceTranscript && <p className="voice-transcript" data-testid="text-voice-transcript">{voiceTranscript}</p>}
            {(voiceError || recordingFailed) && <p className="voice-transcript" role="alert" data-testid="error-voice">{voiceError || copy.fallback}</p>}
            {pendingVoice && !isVoiceProcessing && recorder.state !== 'recording' && <div className="voice-controls" data-testid="panel-voice-retry">
              <button className="record-btn" onClick={() => void sendVoiceBlob(pendingVoice.blob, pendingVoice.qn)} disabled={mutationPending || (pendingVoice.qn !== null && pendingVoice.qn !== session.turnNumber)} data-testid="button-retry-voice">{isEnglish ? 'Retry sending recording' : 'أعد إرسال التسجيل'}</button>
              <button className="quiet-btn" onClick={() => { setPendingVoice(null); setVoiceError(''); }} data-testid="button-discard-voice">{isEnglish ? 'Discard recording' : 'تجاهل التسجيل'}</button>
            </div>}
          </section>}
          <div className="field" style={{ marginTop: 22 }}><label htmlFor="answer">{copy.answer}</label><textarea id="answer" className="answer-box" maxLength={5000} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={copy.placeholder} data-testid="input-answer" /></div>
          {recorder.state === 'recording' && <p className="subtle" data-testid="text-recording-hint">{isEnglish ? 'Stop and send your recording, or cancel it to submit a written answer.' : 'أوقف التسجيل لإرساله، أو ألغِه لإرسال إجابة مكتوبة.'}</p>}
          {submitAnswer.isError && <p className="voice-transcript" role="alert" data-testid="error-submit-answer">{isEnglish ? 'Your answer was not submitted. Please try again.' : 'لم تُرسل إجابتك. حاول مرة أخرى.'}</p>}
          <div className="answer-toolbar"><span className="subtle" data-testid="text-answer-counter">{answer.length} / 5000</span><div className="answer-actions"><button className="primary-btn" onClick={() => void sendTextAnswer()} disabled={!answer.trim() || mutationPending} data-testid="button-submit-answer">{submitAnswer.isPending ? copy.submitting : <>{copy.send} <Send size={15} /></>}</button></div></div>
        </section>
         {latestAnsweredTurn && <section className="panel turn-review" data-testid={`card-feedback-${latestAnsweredTurn.id}`}><div className="review-score">{latestAnsweredTurn.score !== null ? `${latestAnsweredTurn.score} / 100` : ''}</div><h3>{isEnglish ? 'Feedback on your last answer' : 'ملاحظات على إجابتك السابقة'}</h3><p><strong>{isEnglish ? 'Your answer' : 'إجابتك'}:</strong> {latestAnsweredTurn.answer}</p>{latestAnsweredTurn.feedback && <p>{latestAnsweredTurn.feedback}</p>}{latestAnsweredTurn.voiceReply && <p><strong>{isEnglish ? 'Interviewer' : 'المحاور'}:</strong> {latestAnsweredTurn.voiceReply}</p>}{latestAnsweredTurn.strengths.length > 0 && <p><strong>{isEnglish ? 'Strengths' : 'نقاط القوة'}:</strong> {latestAnsweredTurn.strengths.join(' · ')}</p>}{latestAnsweredTurn.improvements.length > 0 && <p><strong>{isEnglish ? 'To improve' : 'للتطوير'}:</strong> {latestAnsweredTurn.improvements.join(' · ')}</p>}</section>}
      </div>
      <aside className="panel turn-sidebar" data-testid="panel-interview-path"><h3>{copy.turns}</h3><div className="turn-list">{Array.from({ length: session.questionCount }, (_, i) => {
        const turn = detail.turns.find((item) => item.questionNumber === i + 1);
        const current = i + 1 === questionOrdinal;
        return <div className={`turn-item${current ? ' current' : ''}`} key={i} data-testid={`item-turn-${i + 1}`}><div className="turn-item-top"><span>{isEnglish ? `QUESTION ${String(i + 1).padStart(2, '0')}` : `السؤال ${String(i + 1).padStart(2, '0')}`}</span>{turn?.score !== null && turn?.score !== undefined ? <span>{turn.score}</span> : current ? <Sparkles size={13} /> : null}</div><p>{turn?.question ?? (current ? currentQuestion : (isEnglish ? 'Coming up' : 'قادم'))}</p>{turn?.answer && <span className="subtle" data-testid={`status-turn-answered-${i + 1}`}><Check size={12} style={{ verticalAlign: 'middle' }} /> {isEnglish ? 'Answered' : 'تمت الإجابة'}</span>}</div>;
      })}</div>{finishInterview.isError && <p role="alert" className="voice-transcript" data-testid="error-finish-interview">{isEnglish ? 'Could not finish. Try again.' : 'تعذّر إنهاء المقابلة. حاول مجدداً.'}</p>}</aside>
    </main>
  </div>;
}

function Result({ session, turns, evaluation }: { session: InterviewSession; turns: InterviewTurn[]; evaluation: InterviewEvaluation }) {
  const english = session.language === 'en';
  return <div className="app-shell" dir={english ? 'ltr' : 'rtl'}>
    <Header />
    <main className="result-wrap"><Link href="/" className="back-link" data-testid="link-result-home">{english ? <ArrowLeft size={16} /> : <ArrowUpRight size={16} />}{english ? 'Back to setup' : 'العودة للرئيسية'}</Link>
      <section className="result-hero" style={{ marginTop: 22 }} data-testid="card-final-result"><div><div className="resume-kicker">{english ? 'PRACTICE REVIEW' : 'مراجعة التدريب'}</div><h1 data-testid="text-result-title">{english ? 'Interview complete' : 'اكتملت المقابلة'}</h1><p data-testid="text-evaluation-summary">{evaluation.summary}</p></div><div className="score-ring" data-testid="text-overall-score"><strong>{evaluation.overallScore}</strong><span>{english ? 'OVERALL' : 'التقييم العام'} / 100</span></div></section>
      <div className="result-grid">
        <section className="panel result-panel" data-testid="panel-strengths"><h2>{english ? 'What worked well' : 'نقاط قوتك'}</h2><ul className="insight-list">{evaluation.strengths.map((item, i) => <li key={`${i}-${item}`} data-testid={`text-strength-${i}`}>{item}</li>)}</ul></section>
        <section className="panel result-panel" data-testid="panel-improvements"><h2>{english ? 'Room to grow' : 'مساحات للتطوير'}</h2><ul className="insight-list">{evaluation.improvements.map((item, i) => <li key={`${i}-${item}`} data-testid={`text-improvement-${i}`}>{item}</li>)}</ul></section>
      </div>
      <section className="panel next-steps" data-testid="panel-next-steps"><h2>{english ? 'Your next steps' : 'خطواتك التالية'}</h2><ul className="insight-list">{evaluation.nextSteps.map((item, i) => <li key={`${i}-${item}`} data-testid={`text-next-step-${i}`}>{item}</li>)}</ul></section>
      <h2 style={{ marginTop: 30 }} data-testid="text-turn-review-heading">{english ? 'Answer-by-answer review' : 'مراجعة الإجابات'}</h2>
      {turns.map((turn) => <section className="panel turn-review" key={turn.id} data-testid={`card-result-turn-${turn.id}`}><div className="review-score">{english ? 'QUESTION' : 'السؤال'} {turn.questionNumber} · {turn.score ?? '—'} / 100</div><h3 data-testid={`text-result-question-${turn.id}`}>{turn.question}</h3><p><strong>{english ? 'Your answer' : 'إجابتك'}:</strong> {turn.answer || (english ? 'No answer recorded' : 'لا توجد إجابة مسجلة')}</p>{turn.feedback && <p>{turn.feedback}</p>}{turn.strengths.length > 0 && <p><strong>{english ? 'Strengths' : 'نقاط القوة'}:</strong> {turn.strengths.join(' · ')}</p>}{turn.improvements.length > 0 && <p><strong>{english ? 'Improve' : 'للتطوير'}:</strong> {turn.improvements.join(' · ')}</p>}</section>)}
      {turns.length === 0 && <div className="empty-copy" data-testid="empty-result-turns">{english ? 'No individual answer reviews are available.' : 'لا تتوفر مراجعات فردية للإجابات.'}</div>}
    </main>
  </div>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/avatar-embed" component={AvatarEmbed} /><Route path="/" component={Home} /><Route path="/session/:id" component={SessionRoute} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
