import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { startInterviewAvatar } from '@workspace/api-client-react';

export type AvatarStatus = 'idle' | 'starting' | 'connecting' | 'ready' | 'ended' | 'error';
export type AgentState = 'talking' | 'listening' | 'idle';
export type AvatarStartInput = { avatarId: string; isSandbox: boolean; acceptCharges: boolean };

const START_DEADLINE_MS = 35_000;
const INACTIVITY_MS = 5 * 60_000;
const HEARTBEAT_MS = 60_000;
const CHUNK_B64_CHARS = 64_000; // 48,000 raw PCM bytes (~1s @ 24kHz mono PCM16), well under 1MB
const MAX_BUFFERED = 2 * 1024 * 1024;

const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function useLiveAvatar(interviewId: string) {
  const [status, setStatus] = useState<AvatarStatus>('idle');
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const genRef = useRef(0);
  const wsConnectedRef = useRef(false);
  const videoReadyRef = useRef(false);
  const readyRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const lastInteractionRef = useRef(Date.now());
  const onReadyRef = useRef<(() => void) | null>(null);
  const idRef = useRef(interviewId);
  idRef.current = interviewId;

  const serverStop = useCallback((sessionId: string, beacon = false) => {
    const url = `/api/interviews/${encodeURIComponent(idRef.current)}/avatar/stop`;
    const body = JSON.stringify({ sessionId });
    if (beacon && navigator.sendBeacon) {
      if (navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return;
    }
    void fetch(url, { method: 'POST', keepalive: true, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body }).catch(() => undefined);
  }, []);

  const teardown = useCallback((reason: 'stop' | 'error' | 'ended', message = '', beacon = false) => {
    genRef.current += 1;
    timersRef.current.forEach((t) => { window.clearTimeout(t); window.clearInterval(t); });
    timersRef.current = [];
    const ws = wsRef.current; wsRef.current = null;
    if (ws) { ws.onclose = null; ws.onmessage = null; ws.onerror = null; try { ws.close(); } catch { /* noop */ } }
    const room = roomRef.current; roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      room.remoteParticipants.forEach((p) => p.trackPublications.forEach((pub) => pub.track?.detach()));
      void room.disconnect();
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    const sid = sessionIdRef.current; sessionIdRef.current = null;
    if (sid) serverStop(sid, beacon);
    wsConnectedRef.current = false; videoReadyRef.current = false; readyRef.current = false;
    onReadyRef.current = null;
    setSpeaking(false); setAgentState('idle'); setAudioBlocked(false); setEndsAt(null);
    setStatus(reason === 'error' ? 'error' : reason === 'ended' ? 'ended' : 'idle');
    setError(message);
  }, [serverStop]);

  const send = (payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!readyRef.current || !ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  };

  const checkReady = useCallback((gen: number, maxSeconds: number) => {
    if (gen !== genRef.current || readyRef.current || !wsConnectedRef.current || !videoReadyRef.current) return;
    readyRef.current = true;
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    lastInteractionRef.current = Date.now();
    setStatus('ready');
    setEndsAt(Date.now() + maxSeconds * 1000);
    timersRef.current.push(window.setTimeout(() => teardown('ended', 'انتهت مدة جلسة المحاور المتاحة. يمكنك المتابعة بالصوت أو الكتابة.'), maxSeconds * 1000));
    timersRef.current.push(window.setInterval(() => {
      if (Date.now() - lastInteractionRef.current > INACTIVITY_MS) {
        teardown('ended', 'أُغلق المحاور بعد ٥ دقائق دون تفاعل لتجنّب الاستهلاك.');
      }
    }, 15_000));
    timersRef.current.push(window.setInterval(() => {
      if (Date.now() - lastInteractionRef.current < HEARTBEAT_MS * 2) send({ type: 'session.keep_alive', event_id: uuid() });
    }, HEARTBEAT_MS));
    const cb = onReadyRef.current; onReadyRef.current = null;
    cb?.();
  }, [teardown]);

  const start = useCallback(async (input: AvatarStartInput, onReady?: () => void) => {
    if (roomRef.current || wsRef.current || sessionIdRef.current) return;
    if (!input.isSandbox && !input.acceptCharges) { setError('يجب الموافقة على الاستخدام المدفوع قبل البدء.'); return; }
    const gen = ++genRef.current;
    lastInteractionRef.current = Date.now();
    onReadyRef.current = onReady ?? null;
    setError(''); setStatus('starting'); setIsSandbox(input.isSandbox);
    const fail = (msg: string) => { if (gen === genRef.current) teardown('error', msg); };
    timersRef.current.push(window.setTimeout(() => fail('تأخر اتصال المحاور أكثر من ٣٥ ثانية. تابع بالصوت أو الكتابة، أو حاول لاحقاً.'), START_DEADLINE_MS));
    let conn;
    try {
      conn = await startInterviewAvatar(idRef.current, input);
    } catch {
      fail('تعذّر بدء جلسة المحاور. تابع بالصوت أو الكتابة.');
      return;
    }
    if (gen !== genRef.current) { serverStop(conn.sessionId); return; }
    sessionIdRef.current = conn.sessionId;
    setStatus('connecting');
    const maxSeconds = conn.maxDurationSeconds;

    const room = new Room({ adaptiveStream: false, dynacast: false });
    roomRef.current = room;
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (gen !== genRef.current) return;
      if (track.kind === Track.Kind.Video && videoRef.current) {
        track.attach(videoRef.current);
        videoReadyRef.current = true;
        checkReady(gen, maxSeconds);
      } else if (track.kind === Track.Kind.Audio && audioRef.current) {
        track.attach(audioRef.current);
        setAudioBlocked(!room.canPlaybackAudio);
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => { track.detach(); });
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio));
    room.on(RoomEvent.Disconnected, () => { if (gen === genRef.current) teardown('error', 'انقطع بث المحاور. إجابتك المكتوبة محفوظة، ويمكنك المتابعة.'); });
    try {
      await room.connect(conn.livekitUrl, conn.livekitToken, { autoSubscribe: true });
    } catch {
      fail('تعذّر الاتصال ببث الفيديو. تابع بالصوت أو الكتابة.');
      return;
    }
    if (gen !== genRef.current) return;
    setAudioBlocked(!room.canPlaybackAudio);

    const ws = new WebSocket(conn.websocketUrl);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      if (gen !== genRef.current) return;
      let msg: { type?: string; state?: string; new_state?: string };
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
      switch (msg.type) {
        case 'session.state_updated':
          if (msg.state === 'connected') { wsConnectedRef.current = true; checkReady(gen, maxSeconds); }
          else if (msg.state === 'disconnected' || msg.state === 'closed') teardown('ended', 'أنهى المزوّد جلسة المحاور.');
          break;
        case 'agent.speak_started': setSpeaking(true); break;
        case 'agent.speak_ended':
        case 'agent.interrupted': setSpeaking(false); break;
        case 'agent.state_updated':
          if (msg.new_state === 'talking' || msg.new_state === 'listening' || msg.new_state === 'idle') setAgentState(msg.new_state);
          break;
      }
    };
    ws.onerror = () => undefined;
    ws.onclose = () => { if (gen === genRef.current) teardown('error', 'انقطع اتصال التحكم بالمحاور. إجابتك محفوظة، ويمكنك المتابعة.'); };
  }, [checkReady, serverStop, teardown]);

  const stop = useCallback(() => teardown('stop'), [teardown]);

  const sendAudio = useCallback((base64: string): boolean => {
    const ws = wsRef.current;
    if (!readyRef.current || !ws || ws.readyState !== WebSocket.OPEN || !base64) return false;
    if (ws.bufferedAmount + base64.length > MAX_BUFFERED) return false;
    for (let i = 0; i < base64.length; i += CHUNK_B64_CHARS) {
      ws.send(JSON.stringify({ type: 'agent.speak', event_id: uuid(), audio: base64.slice(i, i + CHUNK_B64_CHARS) }));
    }
    return true;
  }, []);
  const finishSpeech = useCallback(() => { send({ type: 'agent.speak_end', event_id: uuid() }); }, []);
  const interrupt = useCallback(() => { send({ type: 'agent.interrupt', event_id: uuid() }); }, []);
  const setListening = useCallback((on: boolean) => { lastInteractionRef.current = Date.now(); send({ type: on ? 'agent.start_listening' : 'agent.stop_listening', event_id: uuid() }); }, []);
  const enableAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try { await room.startAudio(); await audioRef.current?.play(); } catch { /* still blocked */ }
    setAudioBlocked(!room.canPlaybackAudio);
  }, []);

  useEffect(() => {
    const touch = () => { lastInteractionRef.current = Date.now(); };
    const onHide = () => { if (sessionIdRef.current || roomRef.current) teardown('stop', '', true); };
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      window.removeEventListener('pagehide', onHide);
      if (sessionIdRef.current || roomRef.current) teardown('stop', '', true);
    };
  }, [teardown]);

  return {
    status, ready: status === 'ready', speaking, agentState, error, audioBlocked, isSandbox, endsAt,
    start, stop, sendAudio, finishSpeech, interrupt, setListening, enableAudio, videoRef, audioRef,
  };
}

export type LiveAvatar = ReturnType<typeof useLiveAvatar>;
