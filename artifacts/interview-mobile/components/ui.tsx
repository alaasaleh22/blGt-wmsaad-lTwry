import React, { useEffect } from 'react';
import { ActivityIndicator, I18nManager, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { F } from '@/lib/fonts';

/** Row direction that reads right-to-left regardless of device locale. */
export const ROW = I18nManager.isRTL ? 'row' : 'row-reverse';

export function useInsets() {
  const i = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  return { top: web ? 67 : i.top, bottom: web ? 34 : i.bottom };
}

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
export function T({ w = 'regular', size = 15, color, style, align = 'right', ...rest }: TextProps & { w?: Weight; size?: number; color?: string; align?: 'right' | 'left' | 'center' }) {
  const c = useColors();
  return <Text {...rest} style={[{ fontFamily: F[w], fontSize: size, color: color ?? c.foreground, textAlign: align, writingDirection: align === 'left' ? 'ltr' : 'rtl' } as TextStyle, style]} />;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'forest' | 'danger' | 'sage';
export function Btn({ label, icon, onPress, variant = 'primary', loading, disabled, testID, style, compact }: {
  label?: string; icon?: React.ComponentProps<typeof Feather>['name']; onPress: () => void; variant?: Variant;
  loading?: boolean; disabled?: boolean; testID: string; style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const c = useColors();
  const bg: Record<Variant, string> = { primary: c.primary, secondary: c.secondary, ghost: 'transparent', forest: c.forestSoft, danger: c.danger, sage: c.sage };
  const fg: Record<Variant, string> = { primary: c.primaryForeground, secondary: c.secondaryForeground, ghost: c.mutedForeground, forest: c.onForest, danger: c.primaryForeground, sage: c.forest };
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      disabled={off}
      onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined); onPress(); }}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg[variant], flexDirection: ROW, paddingVertical: compact ? 9 : 14, paddingHorizontal: compact ? 12 : 18, opacity: off ? 0.5 : pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg[variant]} /> : icon ? <Feather name={icon} size={compact ? 15 : 18} color={fg[variant]} /> : null}
      {label ? <T w="bold" size={compact ? 13 : 15} color={fg[variant]} align="center">{label}</T> : null}
    </Pressable>
  );
}

export function Chip({ label, on, onPress, testID, icon }: { label: string; on: boolean; onPress: () => void; testID: string; icon?: React.ComponentProps<typeof Feather>['name'] }) {
  const c = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={({ pressed }) => [s.chip, { flexDirection: ROW, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.sageSoft : c.card, opacity: pressed ? 0.8 : 1 }]}>
      {icon ? <Feather name={icon} size={14} color={on ? c.primary : c.mutedForeground} /> : null}
      <T size={13} w={on ? 'semibold' : 'regular'} color={on ? c.primary : c.foreground}>{label}</T>
    </Pressable>
  );
}

export function Segmented<V extends string | number>({ options, value, onChange, testPrefix }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; testPrefix: string }) {
  const c = useColors();
  return (
    <View style={[s.seg, { flexDirection: ROW, backgroundColor: c.muted, borderColor: c.border }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} testID={testPrefix + '-' + o.value} onPress={() => onChange(o.value)}
            style={[s.segItem, on && { backgroundColor: c.card, borderColor: c.primary, borderWidth: 1 }]}>
            <T size={13} w={on ? 'bold' : 'medium'} align="center" color={on ? c.primary : c.mutedForeground}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Skeleton({ h = 18, w = '100%', style }: { h?: number; w?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const o = useSharedValue(0.5);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height: h, width: w, borderRadius: 6, backgroundColor: c.secondary }, a, style]} />;
}

export function Pulse({ color, size = 8 }: { color: string; size?: number }) {
  const o = useSharedValue(1);
  useEffect(() => { o.value = withRepeat(withTiming(0.3, { duration: 700 }), -1, true); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, a]} />;
}

export function ErrorState({ message, onRetry, testID }: { message: string; onRetry: () => void; testID: string }) {
  const c = useColors();
  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center', gap: 12 }]}>
      <Feather name="wifi-off" size={26} color={c.danger} />
      <T align="center" color={c.mutedForeground}>{message}</T>
      <Btn testID={testID} label="إعادة المحاولة" icon="refresh-cw" onPress={onRetry} variant="secondary" />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }, style]}>{children}</View>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <T w="bold" size={13} color={c.mutedForeground} style={{ marginBottom: 8 }}>{children}</T>;
}

export function errMsg(e: unknown, fallback = 'حدث خطأ غير متوقع'): string {
  if (e && typeof e === 'object') {
    const anyE = e as { data?: { error?: string }; message?: string };
    if (anyE.data?.error) return anyE.data.error;
    if (anyE.message) return anyE.message;
  }
  return fallback;
}

const s = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', gap: 8, borderTopLeftRadius: 14, borderTopRightRadius: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, minHeight: 44 },
  chip: { alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
  seg: { borderRadius: 12, padding: 4, gap: 4, borderWidth: 1 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  card: { borderWidth: 1, padding: 18, borderTopLeftRadius: 22, borderTopRightRadius: 5, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
});
