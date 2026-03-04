import { type PropsWithChildren } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

interface Props extends PropsWithChildren {
  scrollable?: boolean;
  noPadding?: boolean;
}

export const Screen = ({ children, scrollable, noPadding }: Props) => (
  <SafeAreaView style={styles.safe}>
    {scrollable ? (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, noPadding && styles.noPad]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    ) : (
      <View style={[styles.container, noPadding && styles.noPad]}>
        {children}
      </View>
    )}
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bgBase },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  noPad: { padding: 0 },
});
