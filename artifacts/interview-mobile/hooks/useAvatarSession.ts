import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { startInterviewAvatar, stopInterviewAvatar, type InterviewAvatarConnection } from '@workspace/api-client-react';
import type { AvatarCommand, AvatarEvent, AvatarTransportHandle } from '@/lib/avatarTypes';
import { errMsg } from '@/components/ui';

export type AvatarPhase = 'idle' | 'starting' | 'connecting' | 'live' | 'ended' | 'error';
const STARTUP_DEADLINE_MS = 35_000;
const INACTIVITY_MS = 5 * 60_000;

/** Owns the provider API session lifecycle; the embed only renders the room. */
export function useAvatarSession(interviewId: string, onReady: () => void) {
  const transportRef = useRef<AvatarTransportHandle>(null);
  const [phase, setPhaseState] = useState<AvatarPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isSandbox, setIsSandbox] = useState(true);
  const [maxSeconds, setMaxSeconds] = useState<number | null>(null);
  const phaseRef = useRef<AvatarPhase>('idle');
  const liveRef = useRef(false);
  const gen = useRef(0);
  const embedReady = useRef(false);
  const connectSent = useRef(false);
  const conn = useRef<InterviewAvatarConnection | null>(null);
  const sessionId = useRef<string | null>(null);
  const timers = useRef<{ startup?: ReturnType<typeof setTimeout>; max?: ReturnType<typeof setTimeout>; idle?: ReturnType<typeof setTimeout> }>({});
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const idRef = useRef(interviewId);
  idRef.current = interviewId;

  const setPhase = (p: AvatarPhase) => { phaseRef.current = p; liveRef.current = p === 'live'; setPhaseState(p); };
  const clearTimers = () => { const t = timers.current; if (t.startup) clearTimeout(t.startup); if (t.max) clearTimeout(t.max); if (t.idle) clearTimeout(t.idle); timers.current = {}; };
  const stopApi = (sid: string) => { stopInterviewAvatar(idRef.current, { sessionId: sid }).catch(() => undefined); };

  const stop = useCallback((reason?: string, asError = false) => {
    gen.current += 1;
    clearTimers();
    if (phaseRef.current !== 'idle') { try { transportRef.current?.send({ type: 'stop' }); } catch { /* embed gone */ } }
    if (sessionId.current) stopApi(sessionId.current);
    sessionId.current = null; conn.current = null; embedReady.current = false; connectSent.current = false;
    setSpeaking(false); setAudioBlocked(false);
    setMessage(reason ?? null);
    setPhase(reason ? (asError ? 'error' : 'ended') : 'idle');
  }, []);

  const lastKeepAlive = useRef(0);
  const touch = useCallback(() => {
    if (!liveRef.current) return;
    const now = Date.now();
    if (now - lastKeepAlive.current > 30_000) { lastKeepAlive.current = now; transportRef.current?.send({ type: 'keep_alive' }); }
    if (timers.current.idle) clearTimeout(timers.current.idle);
    timers.current.idle = setTimeout(() => stop('أُغلق البث بعد 5 دقائق دون نشاط.'), INACTIVITY_MS);
  }, [stop]);

  const tryConnect = () => {
    if (embedReady.current && conn.current && !connectSent.current) {
      connectSent.current = true;
      transportRef.current?.send({ type: 'connect', connection: conn.current });
    }
  };

  const start = useCallback((opts: { avatarId: string; isSandbox: boolean; acceptCharges: boolean }) => {
    if (phaseRef.current === 'starting' || phaseRef.current === 'connecting' || phaseRef.current === 'live') return;
    gen.current += 1;
    const g = gen.current;
    embedReady.current = false; connectSent.current = false;
    setMessage(null); setIsSandbox(opts.isSandbox); setMaxSeconds(null);
    setPhase('starting');
    timers.current.startup = setTimeout(() => { if (g === gen.current) stop('لم يكتمل الاتصال خلال 35 ثانية. أُوقفت الجلسة.', true); }, STARTUP_DEADLINE_MS);
    startInterviewAvatar(idRef.current, opts)
      .then((c) => {
        if (g !== gen.current) { stopApi(c.sessionId); return; }
        sessionId.current = c.sessionId; conn.current = c;
        setMaxSeconds(c.maxDurationSeconds);
        setPhase('connecting');
        tryConnect();
      })
      .catch((e) => { if (g === gen.current) stop(errMsg(e, 'تعذّر بدء المحاور المرئي.'), true); });
  }, [stop]);

  const onEvent = useCallback((ev: AvatarEvent) => {
    switch (ev.type) {
      case 'embed_ready': embedReady.current = true; tryConnect(); break;
      case 'connected':
        if (phaseRef.current !== 'connecting') break;
        if (timers.current.startup) clearTimeout(timers.current.startup);
        setPhase('live');
        if (conn.current) {
          const g = gen.current;
          timers.current.max = setTimeout(() => { if (g === gen.current) stop('انتهت المدة القصوى للبث.'); }, conn.current.maxDurationSeconds * 1000);
        }
        touch();
        onReadyRef.current();
        break;
      case 'speaking': setSpeaking(!!ev.value); break;
      case 'audio_blocked': setAudioBlocked(!!ev.value); break;
      case 'ended': if (phaseRef.current !== 'idle') stop(ev.message || 'انتهى بث المحاور.'); break;
      case 'error': if (phaseRef.current !== 'idle') stop(ev.message || 'حدث خطأ في البث.', true); break;
    }
  }, [stop, touch]);

  const send = useCallback((cmd: AvatarCommand) => {
    if (!liveRef.current) return false;
    transportRef.current?.send(cmd);
    touch();
    return true;
  }, [touch]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active' && phaseRef.current !== 'idle' && phaseRef.current !== 'ended' && phaseRef.current !== 'error') stop('أُوقف البث عند مغادرة التطبيق.'); });
    return () => { sub.remove(); stop(); };
  }, [stop]);

  const reset = useCallback(() => { if (phaseRef.current === 'ended' || phaseRef.current === 'error') { setMessage(null); setPhase('idle'); } }, []);
  const enableAudio = useCallback(() => { transportRef.current?.send({ type: 'enable_audio' }); }, []);

  const mounted = phase === 'starting' || phase === 'connecting' || phase === 'live';
  return { transportRef, phase, message, speaking, audioBlocked, isSandbox, maxSeconds, liveRef, mounted, start, stop, send, onEvent, reset, enableAudio, touch };
}
