import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { EMBED_ORIGIN, EMBED_URL, parseAvatarEvent, type AvatarCommand, type AvatarTransportProps } from '@/lib/avatarTypes';

export default function AvatarTransport({ ref, onEvent, style }: AvatarTransportProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const send = (cmd: AvatarCommand) => { frame.current?.contentWindow?.postMessage(JSON.stringify(cmd), EMBED_ORIGIN); };
  useImperativeHandle(ref, () => ({ send }), []);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== EMBED_ORIGIN || e.source !== frame.current?.contentWindow) return;
      const ev = parseAvatarEvent(e.data);
      if (ev) onEventRef.current(ev);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <View style={style}>
      {React.createElement('iframe', {
        ref: frame,
        src: EMBED_URL,
        allow: 'autoplay',
        title: 'interviewer-video',
        onLoad: () => send({ type: 'ping' }),
        style: { border: 0, width: '100%', height: '100%', background: 'transparent' },
      })}
    </View>
  );
}
