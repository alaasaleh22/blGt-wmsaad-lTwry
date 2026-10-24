import type { InterviewAvatarConnection } from '@workspace/api-client-react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Ref } from 'react';

export type AvatarCommand =
  | { type: 'ping' }
  | { type: 'connect'; connection: InterviewAvatarConnection }
  | { type: 'audio'; data: string }
  | { type: 'audio_end' }
  | { type: 'interrupt' }
  | { type: 'listening'; value: boolean }
  | { type: 'stop' }
  | { type: 'enable_audio' }
  | { type: 'keep_alive' };

export type AvatarEvent =
  | { type: 'embed_ready' }
  | { type: 'connected' }
  | { type: 'speaking'; value: boolean }
  | { type: 'audio_blocked'; value: boolean }
  | { type: 'ended'; message?: string }
  | { type: 'error'; message: string };

export interface AvatarTransportHandle { send: (cmd: AvatarCommand) => void }
export interface AvatarTransportProps {
  ref?: Ref<AvatarTransportHandle>;
  onEvent: (e: AvatarEvent) => void;
  style?: StyleProp<ViewStyle>;
}
export const EMBED_ORIGIN = 'https://' + (process.env.EXPO_PUBLIC_DOMAIN ?? '');
export const EMBED_URL = EMBED_ORIGIN + '/interview-simulator/avatar-embed';

export function parseAvatarEvent(raw: unknown): AvatarEvent | null {
  try {
    const v = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { type?: unknown };
    if (!v || typeof v.type !== 'string') return null;
    const ok = ['embed_ready', 'connected', 'speaking', 'audio_blocked', 'ended', 'error'];
    return ok.includes(v.type) ? (v as AvatarEvent) : null;
  } catch { return null; }
}
