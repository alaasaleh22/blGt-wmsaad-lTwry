import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { Camera, CameraOff, ShieldCheck } from 'lucide-react';

type RoomPhase = 'idle' | 'listening' | 'processing' | 'speaking';

export interface CameraSnapshotHandle {
  /** One still JPEG (max 640px wide) from the live preview, as a data URL. Throws if the camera is not live. */
  getSnapshot: () => Promise<string>;
}

export function CameraPreview({ english, active, ref, onReadyChange, sharing }: { english: boolean; active: boolean; ref?: Ref<CameraSnapshotHandle>; onReadyChange?: (ready: boolean) => void; sharing?: boolean }) {
  const [on, setOn] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reqId = useRef(0);

  const stop = useCallback(() => {
    reqId.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setOn(false);
    setPending(false);
  }, []);

  useEffect(() => () => {
    reqId.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => { if (!active) stop(); }, [active, stop]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden') stop(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [stop]);
  const onReadyRef = useRef(onReadyChange);
  onReadyRef.current = onReadyChange;
  useEffect(() => { onReadyRef.current?.(on); }, [on]);
  useEffect(() => () => { onReadyRef.current?.(false); }, []);
  useImperativeHandle(ref, () => ({
    getSnapshot: async () => {
      const v = videoRef.current;
      if (!v || !streamRef.current || document.visibilityState !== 'visible' || v.readyState < 2 || !v.videoWidth) {
        throw new Error('camera not ready');
      }
      const w = Math.min(640, v.videoWidth);
      const h = Math.round((v.videoHeight / v.videoWidth) * w);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');
      ctx.drawImage(v, 0, 0, w, h);
      const url = canvas.toDataURL('image/jpeg', 0.5);
      canvas.width = 0; canvas.height = 0;
      if (!url.startsWith('data:image/jpeg;base64,')) throw new Error('encode failed');
      return url;
    },
  }), []);
  useEffect(() => {
    if (on && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [on]);

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(english ? 'Camera is not available in this browser. Voice and typed answers still work.' : 'الكاميرا غير متاحة في هذا المتصفح. يمكنك متابعة الإجابة بالصوت أو الكتابة.');
      return;
    }
    const my = ++reqId.current;
    setPending(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (my !== reqId.current) { s.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = s;
      s.getVideoTracks().forEach((t) => t.addEventListener('ended', () => { if (streamRef.current === s) stop(); }));
      setOn(true);
    } catch (e) {
      if (my !== reqId.current) return;
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      setError(denied
        ? (english ? 'Camera permission was denied. Continue with voice or text.' : 'تم رفض إذن الكاميرا. تابع بالصوت أو الكتابة.')
        : (english ? 'No camera found or it is in use. Continue with voice or text.' : 'لم يتم العثور على كاميرا أو أنها مستخدمة. تابع بالصوت أو الكتابة.'));
    } finally {
      if (my === reqId.current) setPending(false);
    }
  };

  return <div className="cam-tile" data-testid="panel-camera">
    <div className="tile-label">{english ? 'Your camera preview' : 'معاينة كاميرتك'}</div>
    <div className="cam-frame">
      {on ? <video ref={videoRef} autoPlay playsInline muted className="cam-video" data-testid="video-self-preview" />
        : <div className="cam-off"><CameraOff size={26} aria-hidden="true" /><span>{english ? 'Camera off' : 'الكاميرا مطفأة'}</span></div>}
    </div>
    <div className="cam-actions">
      {on ? <button type="button" className="record-btn" onClick={stop} data-testid="button-disable-camera"><CameraOff size={15} />{english ? 'Turn camera off' : 'إيقاف الكاميرا'}</button>
        : <button type="button" className="record-btn" onClick={() => void start()} disabled={pending} data-testid="button-enable-camera"><Camera size={15} />{pending ? (english ? 'Requesting…' : 'جارٍ طلب الإذن…') : (english ? 'Enable camera' : 'تشغيل الكاميرا')}</button>}
    </div>
    {error && <p className="cam-error" role="alert" data-testid="error-camera">{error}</p>}
    <p className="cam-privacy" data-testid="text-camera-privacy"><ShieldCheck size={13} aria-hidden="true" /> {sharing
      ? (english ? 'Snapshot sharing ON: one still photo is taken when you submit each answer and sent with it to the AI service. No continuous video; nothing is stored by the app.' : 'مشاركة اللقطة مفعّلة: تُلتقط صورة ثابتة واحدة عند إرسال كل إجابة وتُرسل معها إلى خدمة الذكاء الاصطناعي. لا فيديو مستمر، ولا يحتفظ التطبيق بالصور.')
      : (english ? 'Local preview only — nothing leaves your device unless you enable snapshot sharing.' : 'معاينة محلية فقط — لا يغادر شيء جهازك ما لم تفعّل مشاركة اللقطة.')}</p>
  </div>;
}

export function InterviewRoom({ english, phase, stageLabel, active, interviewer, children, cameraRef, onCameraReadyChange, sharing }: {
  english: boolean; phase: RoomPhase; stageLabel: string; active: boolean; interviewer?: ReactNode; children?: ReactNode;
  cameraRef?: Ref<CameraSnapshotHandle>; onCameraReadyChange?: (ready: boolean) => void; sharing?: boolean;
}) {
  const phaseText: Record<RoomPhase, string> = english
    ? { idle: 'Waiting for your answer', listening: 'Listening to you…', processing: 'Thinking about your answer…', speaking: 'Interviewer is speaking' }
    : { idle: 'بانتظار إجابتك', listening: 'يستمع إليك…', processing: 'يراجع إجابتك…', speaking: 'المحاور يتحدث الآن' };
  return <section className={`room phase-${phase}`} data-testid="panel-interview-room" aria-label={english ? 'Interview room' : 'غرفة المقابلة'}>
    <div className="room-stage-label" data-testid="text-interview-stage">{english ? 'Stage' : 'المرحلة'}: {stageLabel}</div>
    <div className={`room-grid${interviewer ? ' with-avatar' : ''}`}>
      {interviewer ?? <div className="ai-tile">
        <div className="tile-label">{english ? 'Virtual voice interviewer' : 'المحاور الصوتي الافتراضي'}</div>
        <div className="ai-core" aria-hidden="true">
          <div className="ai-mark">م</div>
          <div className="wave">{Array.from({ length: 9 }, (_, i) => <span key={i} style={{ animationDelay: `${(i % 5) * 0.12}s` }} />)}</div>
        </div>
        <p className="ai-status" role="status" aria-live="polite" data-testid="status-interview-room">{phaseText[phase]}</p>
        <p className="ai-note">{english ? 'Voice-only AI — no human video.' : 'ذكاء اصطناعي صوتي فقط — لا يوجد فيديو بشري.'}</p>
      </div>}
      <CameraPreview english={english} active={active} ref={cameraRef} onReadyChange={onCameraReadyChange} sharing={sharing} />
    </div>
    {children}
  </section>;
}
