/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  dark: {
    text: '#F5F5F5',
    background: '#0B0B0B',
    tint: '#F28C18',
    icon: '#A0A0A0',
    tabIconDefault: '#707070',
    tabIconSelected: '#F28C18',
    card: '#151515',
    input: '#101010',
    border: '#292929',
    muted: '#707070',
    secondaryText: '#A0A0A0',
    success: '#22A559',
    danger: '#E5484D',
  },
  light: {
    text: '#F5F5F5',
    background: '#0B0B0B',
    tint: '#F28C18',
    icon: '#A0A0A0',
    tabIconDefault: '#707070',
    tabIconSelected: '#F28C18',
    card: '#151515',
    input: '#101010',
    border: '#292929',
    muted: '#707070',
    secondaryText: '#A0A0A0',
    success: '#22A559',
    danger: '#E5484D',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
