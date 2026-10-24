import React, { useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { T } from '@/components/ui';

/** Local-only front camera self view. Never uploaded or published. */
export function SelfView() {
  const c = useColors();
  const [perm, request] = useCameraPermissions();
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setActive(st === 'active'));
    return () => sub.remove();
  }, []);
  const on = enabled && active && !!perm?.granted;

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
      {on ? <CameraView style={StyleSheet.absoluteFill} facing="front" mirror /> : (
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
