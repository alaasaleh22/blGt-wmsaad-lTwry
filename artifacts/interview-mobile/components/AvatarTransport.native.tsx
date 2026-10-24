import React, { useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { EMBED_ORIGIN, EMBED_URL, parseAvatarEvent, type AvatarCommand, type AvatarTransportProps } from '@/lib/avatarTypes';

export default function AvatarTransport({ ref, onEvent, style }: AvatarTransportProps) {
  const wv = useRef<WebView>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const send = (cmd: AvatarCommand) => {
    const payload = JSON.stringify(JSON.stringify(cmd));
    wv.current?.injectJavaScript('window.dispatchEvent(new MessageEvent("message",{data:' + payload + '}));true;');
  };
  useImperativeHandle(ref, () => ({ send }), []);
  return (
    <WebView
      ref={wv}
      testID="avatar-webview"
      source={{ uri: EMBED_URL }}
      originWhitelist={[EMBED_ORIGIN]}
      style={[{ backgroundColor: 'transparent' }, style]}
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      scrollEnabled={false}
      bounces={false}
      onLoadEnd={() => send({ type: 'ping' })}
      onMessage={(e) => { const ev = parseAvatarEvent(e.nativeEvent.data); if (ev) onEventRef.current(ev); }}
      onError={(e) => onEventRef.current({ type: 'error', message: e.nativeEvent.description || 'Embed failed to load' })}
      onHttpError={(e) => onEventRef.current({ type: 'error', message: 'Embed HTTP ' + e.nativeEvent.statusCode })}
    />
  );
}
