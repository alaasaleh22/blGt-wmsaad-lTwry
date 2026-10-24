import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteVideoTrack, type RemoteAudioTrack } from 'livekit-client';
import type { InterviewAvatarConnection } from '@workspace/api-client-react';

type BridgeWindow = Window & { ReactNativeWebView?: { postMessage: (data: string) => void } };

/** Receive-only WebRTC renderer for Expo Go. No camera or microphone is published. */
export function AvatarEmbed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoTrackRef = useRef<RemoteVideoTrack | null>(null);
  const audioTrackRef = useRef<RemoteAudioTrack | null>(null);
  const frameReadyRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState('المحاور غير متصل');
  const [audioBlocked, setAudioBlocked] = useState(false);
  const enableAudioRef = useRef<() => void>(() => {});
  const bindVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && videoTrackRef.current) {
      videoTrackRef.current.attach(element);
      void element.play().catch(() => {});
    }
  }, []);
  const bindAudio = useCallback((element: HTMLAudioElement | null) => {
    audioRef.current = element;
    if (element && audioTrackRef.current) audioTrackRef.current.attach(element);
  }, []);

  useEffect(() => {
    let room: Room | null = null;
    let socket: WebSocket | null = null;
    let generation = 0;
    let websocketReady = false;
    let videoReady = false;
    let announced = false;
    let utterance: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let videoRecoveryTimer: ReturnType<typeof setTimeout> | undefined;
    const parentOrigin = document.referrer ? new URL(document.referrer).origin : window.location.origin;
    const bridge = (window as BridgeWindow).ReactNativeWebView;
    const emit = (event: Record<string, unknown>) => {
      if (bridge) bridge.postMessage(JSON.stringify(event));
      else if (window.parent !== window) window.parent.postMessage(JSON.stringify(event), parentOrigin);
    };
    const cleanup = () => {
      generation += 1;
      if (timer) clearTimeout(timer);
      if (videoRecoveryTimer) clearTimeout(videoRecoveryTimer);
      socket?.close();
      socket = null;
      videoTrackRef.current?.detach();
      audioTrackRef.current?.detach();
      videoTrackRef.current = null;
      audioTrackRef.current = null;
      void room?.disconnect();
      room = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.srcObject = null; }
      websocketReady = false;
      videoReady = false;
      announced = false;
      utterance = null;
    };
    const fail = (message: string) => {
      cleanup();
      setStatus(message);
      emit({ type: 'error', message });
    };
    const command = (type: string, fields: Record<string, unknown> = {}) => {
      if (!websocketReady || socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({ type, event_id: crypto.randomUUID(), ...fields }));
      return true;
    };
    const ready = () => {
      if (!announced && videoReady && websocketReady) {
        announced = true;
        if (timer) clearTimeout(timer);
        setStatus('');
        emit({ type: 'connected' });
      }
    };
    frameReadyRef.current = () => {
      const video = videoRef.current;
      if (video?.srcObject && video.videoWidth > 0 && video.videoHeight > 0) {
        videoReady = true;
        if (videoRecoveryTimer) clearTimeout(videoRecoveryTimer);
        if (websocketReady) setStatus('');
        ready();
      }
    };
    const connect = async (connection: InterviewAvatarConnection) => {
      cleanup();
      const current = generation;
      setStatus('جارٍ توصيل المحاور…');
      setAudioBlocked(false);
      // The native loading overlay/iframe visibility must not pause the first video frame.
      const localRoom = new Room({ adaptiveStream: false });
      room = localRoom;
      timer = setTimeout(() => {
        if (current === generation) fail('تعذّر توصيل فيديو المحاور. حاول مرة أخرى.');
      }, 30000);
      localRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (current !== generation) return;
        if (track.kind === Track.Kind.Video && videoRef.current) {
          if (videoRecoveryTimer) clearTimeout(videoRecoveryTimer);
          videoTrackRef.current = track as RemoteVideoTrack;
          track.attach(videoRef.current);
          void videoRef.current.play().catch(() => {});
          frameReadyRef.current();
        } else if (track.kind === Track.Kind.Audio && audioRef.current) {
          audioTrackRef.current = track as RemoteAudioTrack;
          track.attach(audioRef.current);
          void audioRef.current.play().catch(() => {
            setAudioBlocked(true);
            emit({ type: 'audio_blocked', value: true });
          });
        }
      });
      localRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (current !== generation || track !== videoTrackRef.current) return;
        videoReady = false;
        videoTrackRef.current = null;
        setStatus('جارٍ انتظار صورة المحاور…');
        // Providers may replace a track during initial negotiation. Do not kill that replacement.
        videoRecoveryTimer = setTimeout(() => {
          if (current === generation && !videoReady) fail('انقطع بث فيديو المحاور. يمكنك متابعة المقابلة بالصوت أو النص.');
        }, 8000);
      });
      localRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (current !== generation) return;
        const blocked = !localRoom.canPlaybackAudio;
        setAudioBlocked(blocked);
        emit({ type: 'audio_blocked', value: blocked });
      });
      localRoom.on(RoomEvent.Disconnected, () => {
        if (current === generation) {
          cleanup();
          setStatus('انتهى اتصال المحاور');
          emit({ type: 'ended', message: 'انتهى اتصال فيديو المحاور.' });
        }
      });
      const localSocket = new WebSocket(connection.websocketUrl);
      socket = localSocket;
      localSocket.onmessage = (event) => {
        if (current !== generation) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'session.state_updated' && data.state === 'connected') {
            websocketReady = true;
            ready();
          } else if (data.type === 'agent.speak_started' || (data.type === 'agent.state_updated' && data.new_state === 'talking')) {
            emit({ type: 'speaking', value: true });
          } else if (['agent.speak_ended', 'agent.speak_interrupted'].includes(data.type) || (data.type === 'agent.state_updated' && data.new_state !== 'talking')) {
            emit({ type: 'speaking', value: false });
          } else if (data.type === 'error') {
            fail('تعذّر تحريك المحاور مع الصوت. يمكنك متابعة المقابلة صوتيًا.');
          }
        } catch {
          fail('تعذّر قراءة استجابة محاور الفيديو.');
        }
      };
      localSocket.onerror = () => { if (current === generation) fail('تعذّر الاتصال بمحاور الفيديو.'); };
      localSocket.onclose = () => {
        if (current === generation) {
          cleanup();
          setStatus('انتهى اتصال المحاور');
          emit({ type: 'ended', message: 'انتهى اتصال المحاور أو مدة التجربة.' });
        }
      };
      enableAudioRef.current = () => {
        void localRoom.startAudio().then(() => audioRef.current?.play()).then(() => {
          setAudioBlocked(false);
          emit({ type: 'audio_blocked', value: false });
        }).catch(() => {
          setAudioBlocked(true);
          emit({ type: 'audio_blocked', value: true });
        });
      };
      try {
        await localRoom.connect(connection.livekitUrl, connection.livekitToken, { autoSubscribe: true });
        if (current !== generation) await localRoom.disconnect();
      } catch {
        if (current === generation) fail('تعذّر استقبال فيديو المحاور.');
      }
    };
    const receive = (event: MessageEvent) => {
      const isNative = Boolean(bridge) && !event.origin;
      if (!isNative && (event.source !== window.parent || event.origin !== parentOrigin)) return;
      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!message || typeof message.type !== 'string') return;
        switch (message.type) {
          case 'ping': emit({ type: 'embed_ready' }); break;
          case 'connect': {
            const connection = message.connection as InterviewAvatarConnection;
            if (!connection || !/^wss:\/\//.test(connection.websocketUrl) || !/^(wss|https):\/\//.test(connection.livekitUrl) || typeof connection.livekitToken !== 'string') {
              fail('بيانات اتصال المحاور غير صالحة.');
              return;
            }
            void connect(connection);
            break;
          }
          case 'audio': {
            if (!announced || !websocketReady || socket?.readyState !== WebSocket.OPEN) return;
            if (typeof message.data !== 'string' || message.data.length > 1400000 || socket.bufferedAmount > 2000000) {
              fail('تعذّر مزامنة صوت المحاور. تابع بالصوت فقط.');
              return;
            }
            const raw = atob(message.data);
            utterance ??= crypto.randomUUID();
            for (let offset = 0; offset < raw.length; offset += 48000) {
              command('agent.speak', { audio: btoa(raw.slice(offset, offset + 48000)), event_id: utterance });
            }
            break;
          }
          case 'audio_end':
            if (utterance) command('agent.speak_end');
            utterance = null;
            break;
          case 'interrupt':
            command('agent.interrupt');
            utterance = null;
            emit({ type: 'speaking', value: false });
            break;
          case 'listening': command(message.value ? 'agent.start_listening' : 'agent.stop_listening'); break;
          case 'keep_alive': command('session.keep_alive'); break;
          case 'enable_audio': enableAudioRef.current(); break;
          case 'stop': cleanup(); setStatus('المحاور غير متصل'); break;
        }
      } catch {
        fail('تعذّر معالجة صوت المحاور.');
      }
    };
    window.addEventListener('message', receive);
    emit({ type: 'embed_ready' });
    return () => {
      cleanup();
      window.removeEventListener('message', receive);
      enableAudioRef.current = () => {};
      frameReadyRef.current = () => {};
    };
  }, []);

  return <div style={{ position: 'fixed', inset: 0, background: '#183b3b', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
    <video ref={bindVideo} autoPlay playsInline muted onLoadedData={() => frameReadyRef.current()} onPlaying={() => frameReadyRef.current()} style={{ width: '100%', height: '100%', objectFit: 'cover' }} data-testid="video-embedded-interviewer" />
    <audio ref={bindAudio} autoPlay />
    {status && <div role="status" style={{ position: 'absolute', color: '#f6f1e6', padding: 20, textAlign: 'center', fontFamily: 'sans-serif' }}>{status}</div>}
    {audioBlocked && <button onClick={() => enableAudioRef.current()} style={{ position: 'absolute', bottom: 12, padding: '10px 18px', background: '#e5bc70', border: 0, borderRadius: 8, color: '#183b3b' }}>تفعيل الصوت</button>}
  </div>;
}
