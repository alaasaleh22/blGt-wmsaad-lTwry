import React, { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { T } from '@/components/ui';

export interface SelfViewHandle {
  /** Captures ONE still JPEG (max 640px wide) as a data URL. Throws if the camera is not live. */
  snapshot: () => Promise<string>;
}

function deleteQuietly(uri: string | undefined) {
  if (!uri || Platform.OS === 'web' || !uri.startsWith('file:')) return;
  try { const f = new File(uri); if (f.exists) f.delete(); } catch { /* best effort */ }
}

/** Front camera self view. Stays on-device unless the user opts in to per-answer snapshots. */
export function SelfView({ ref, onReadyChange }: { ref?: Ref<SelfViewHandle>; onReadyChange?: (ready: boolean) => void }) {
  const c = useColors();
  const [perm, request] = useCameraPermissions();
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [camReady, setCamReady] = useState(false);
  const camRef = useRef<CameraView>(null);
  const onReadyRef = useRef(onReadyChange);
  onReadyRef.current = onReadyChange;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setActive(st === 'active'));
    return () => sub.remove();
  }, []);
  const on = enabled && active && !!perm?.granted;
  useEffect(() => { if (!on) setCamReady(false); }, [on]);
  const ready = on && camReady;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  useEffect(() => { onReadyRef.current?.(ready); }, [ready]);
  useEffect(() => () => { onReadyRef.current?.(false); }, []);

  useImperativeHandle(ref, () => ({
    snapshot: async () => {
      if (!readyRef.current || !camRef.current || AppState.currentState !== 'active') throw new Error('الكاميرا غير جاهزة لالتقاط صورة.');
      let originalUri: string | undefined;
      let resizedUri: string | undefined;
      try {
        const photo = await camRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true, shutterSound: false });
        originalUri = photo?.uri;
        if (!photo?.uri) throw new Error('لم تُلتقط صورة.');
        if (!readyRef.current || AppState.currentState !== 'active') throw new Error('أُغلقت الكاميرا أثناء الالتقاط.');
        const ctx = ImageManipulator.manipulate(photo.uri);
        if (!photo.width || photo.width > 640) ctx.resize({ width: 640 });
        const img = await ctx.renderAsync();
        const out = await img.saveAsync({ compress: 0.4, format: SaveFormat.JPEG, base64: true });
        resizedUri = out.uri;
        if (!out.base64) throw new Error('تعذّر ترميز الصورة.');
        return 'data:image/jpeg;base64,' + out.base64.replace(/^data:image\/\w+;base64,/, '');
      } finally {
        deleteQuietly(originalUri);
        deleteQuietly(resizedUri);
      }
    },
  }), []);

  const toggle = async () => {
    if (enabled) { setEnabled(false); return; }
    if (!perm?.granted) {
      if (perm && !perm.canAskAgain && Platform.OS !== 'web') { try { await Linking.openSettings(); } catch { /* unavailable */ } return; }
      const r = await request();
      if (!r.granted) return;
    }
    setEnabled(true);
  };
  const denied = perm && !perm.granted && !perm.canAskAgain;

  return (
    <View style={[st.box, { backgroundColor: c.forest, borderColor: c.forestLine }]}>
      {on ? <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="front" mirror onCameraReady={() => setCamReady(true)} onMountError={() => setCamReady(false)} /> : (
        <View style={st.off}>
          <Feather name={denied ? 'camera-off' : 'user'} size={20} color={c.onForestMuted} />
          <T size={10} align="center" color={c.onForestMuted}>{denied ? 'الإذن مرفوض' : 'أنت'}</T>
        </View>
      )}
      <Pressable testID="toggle-self-camera" onPress={toggle} hitSlop={8} accessibilityLabel={enabled ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
        style={[st.toggle, { backgroundColor: c.overlay }]}>
        <Feather name={enabled ? 'video-off' : denied ? 'settings' : 'video'} size={14} color={c.onForest} />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  box: { width: 96, height: 128, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5 },
  off: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  toggle: { position: 'absolute', bottom: 6, left: 6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
