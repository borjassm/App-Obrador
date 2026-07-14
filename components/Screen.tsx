import { type PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Colors, Spacing, TABLET_BREAKPOINT } from '@/constants/theme';

interface Props extends PropsWithChildren {
  scrollable?: boolean;
  noPadding?: boolean;
}

export const Screen = ({ children, scrollable, noPadding }: Props) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;
  const padding = noPadding ? styles.noPad : isTablet ? styles.padTablet : styles.padMobile;

  return (
    <SafeAreaView style={styles.safe}>
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, padding]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.container, padding]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgBase },
  scroll: { flex: 1 },
  content: { gap: Spacing.md, paddingBottom: Spacing.xxxl },
  container: { flex: 1, gap: Spacing.md, paddingBottom: Spacing.lg },
  // 1b: contenido tablet 40/44 · 1g: contenido móvil 18/20
  padTablet: { paddingHorizontal: 44, paddingTop: 40 },
  padMobile: { paddingHorizontal: 20, paddingTop: 18 },
  noPad: { padding: 0 },
});
