import { useEffect, useState } from 'react';
import { CreditCard, Hand, Play, Power, ShieldCheck, Volume2 } from 'lucide-react';
import { getGetInterviewAvatarOptionsQueryKey, useGetInterviewAvatarOptions } from '@workspace/api-client-react';
import type { LiveAvatar } from '@/hooks/use-live-avatar';

export function AvatarStage({ interviewId, avatar, english, onStart, onReadQuestion, readDisabled }: {
  interviewId: string; avatar: LiveAvatar; english: boolean;
  onStart: (input: { avatarId: string; isSandbox: boolean; acceptCharges: boolean }) => void;
  onReadQuestion: () => void; readDisabled: boolean;
}) {
  const options = useGetInterviewAvatarOptions(interviewId, { query: { queryKey: getGetInterviewAvatarOptionsQueryKey(interviewId), retry: false, staleTime: 60_000 } });
  const opts = options.data;
  const [avatarId, setAvatarId] = useState('');
  const [accept, setAccept] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!avatarId && opts?.avatars[0]) setAvatarId(opts.avatars[0].id); }, [opts, avatarId]);
  useEffect(() => { if (!avatar.endsAt) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [avatar.endsAt]);

  const live = avatar.status === 'ready';
  const busy = avatar.status === 'starting' || avatar.status === 'connecting';
  const active = live || busy;
  const selected = opts?.avatars.find((a) => a.id === avatarId);
  const remaining = avatar.endsAt ? Math.max(0, Math.round((avatar.endsAt - now) / 1000)) : null;

  const statusText = live
    ? (avatar.agentState === 'talking' || avatar.speaking ? (english ? 'Interviewer is speaking' : 'المحاور يتحدث') : avatar.agentState === 'listening' ? (english ? 'Interviewer is listening' : 'المحاور يستمع') : (english ? 'Live · idle' : 'مباشر · بانتظارك'))
    : avatar.status === 'starting' ? (english ? 'Opening session…' : 'جارٍ فتح الجلسة…')
    : avatar.status === 'connecting' ? (english ? 'Connecting video…' : 'جارٍ وصل الفيديو…')
    : (english ? 'Not connected · voice & text work' : 'غير متصل · الصوت والكتابة يعملان');

  const startPaid = () => { if (!accept) return; setAccept(false); onStart({ avatarId, isSandbox: false, acceptCharges: true }); };

  return <div className={`avatar-tile${live ? ' is-live' : ''}`} data-testid="panel-avatar">
    <div className="tile-label avatar-label"><span>{english ? 'Video interviewer' : 'المحاور المرئي'}</span>
      <span className={`avatar-status ${live ? 'live' : ''}`} role="status" aria-live="polite" data-testid="status-avatar"><i />{statusText}{remaining !== null && live ? ` · ${remaining}s` : ''}</span></div>
    <div className="avatar-frame">
      <video ref={avatar.videoRef} autoPlay playsInline muted className={`avatar-video${live ? ' on' : ''}`} data-testid="video-interviewer" />
      <audio ref={avatar.audioRef} autoPlay />
      {!live && <div className="avatar-placeholder">
        {busy ? <div className="avatar-connecting"><span /><span /><span /><p>{statusText}</p></div>
          : selected?.previewUrl ? <figure className="avatar-preview"><img src={selected.previewUrl} alt="" /><figcaption>{english ? 'Provider preview image — not a live video' : 'صورة معاينة من المزوّد — ليست بثاً مباشراً'}</figcaption></figure>
          : <p className="avatar-empty">{english ? 'Start a session to see the live interviewer here.' : 'ابدأ جلسة لترى المحاور المباشر هنا.'}</p>}
      </div>}
      {live && avatar.audioBlocked && <button type="button" className="avatar-audio-btn" onClick={() => void avatar.enableAudio()} data-testid="button-enable-avatar-audio"><Volume2 size={16} />{english ? 'Enable audio' : 'تفعيل الصوت'}</button>}
    </div>

    {avatar.error && <p className="avatar-error" role="alert" data-testid="error-avatar">{avatar.error}</p>}

    {active ? <div className="avatar-actions">
      <button type="button" className="record-btn" onClick={onReadQuestion} disabled={!live || readDisabled} data-testid="button-read-question"><Play size={15} />{english ? 'Listen to the question' : 'استمع للسؤال'}</button>
      <button type="button" className="record-btn" onClick={avatar.interrupt} disabled={!live} data-testid="button-interrupt-avatar"><Hand size={15} />{english ? 'Interrupt' : 'قاطع'}</button>
      <button type="button" className="quiet-btn dark" onClick={avatar.stop} data-testid="button-stop-avatar"><Power size={15} />{english ? 'End video' : 'إنهاء الفيديو'}</button>
    </div> : options.isLoading ? <div className="skeleton loading-line" style={{ height: 38 }} />
    : !opts?.configured ? <p className="avatar-note" data-testid="text-avatar-unavailable">{english ? 'Video interviewer is not available right now. Voice and text practice continue normally.' : 'المحاور المرئي غير متاح حالياً. يستمر التدريب بالصوت والكتابة كالمعتاد.'}</p>
    : <div className="avatar-setup">
      <button type="button" className="record-btn primary" onClick={() => onStart({ avatarId: opts.sandboxAvatarId, isSandbox: true, acceptCharges: false })} data-testid="button-start-avatar-sandbox"><Play size={15} />{english ? `Start with interviewer · free trial (~${opts.sandboxMaxSeconds}s)` : `ابدأ مع المحاور / استمع للسؤال · تجربة مجانية (~${opts.sandboxMaxSeconds} ث)`}</button>
      <div className="avatar-paid">
        <select value={avatarId} onChange={(e) => setAvatarId(e.target.value)} disabled={!opts.paidEnabled || opts.avatars.length === 0} data-testid="select-avatar">
          {opts.avatars.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <label className="avatar-consent"><input type="checkbox" checked={accept} disabled={!opts.paidEnabled} onChange={(e) => setAccept(e.target.checked)} data-testid="checkbox-avatar-charges" />
          <span>{english ? 'I understand this starts a billed session with the external provider LiveAvatar.' : 'أفهم أن هذا يبدأ جلسة مدفوعة تُحتسب لدى المزوّد الخارجي LiveAvatar.'}</span></label>
        <button type="button" className="record-btn" onClick={startPaid} disabled={!opts.paidEnabled || !accept || !avatarId} data-testid="button-start-avatar-paid"><CreditCard size={15} />{opts.paidEnabled ? (english ? 'Start paid session' : 'ابدأ جلسة مدفوعة') : (english ? 'Paid sessions disabled' : 'الجلسات المدفوعة غير مفعّلة')}</button>
      </div>
    </div>}
    <p className="cam-privacy" data-testid="text-avatar-privacy"><ShieldCheck size={13} aria-hidden="true" /> {english ? 'Only generated interviewer audio is sent to LiveAvatar. Your mic and camera are never published.' : 'يُرسل إلى LiveAvatar صوت المحاور المولَّد فقط. لا يُبث ميكروفونك ولا كاميرتك.'}</p>
  </div>;
}
