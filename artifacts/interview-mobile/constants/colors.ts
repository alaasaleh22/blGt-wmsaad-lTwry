const light = {
  text: '#20343D', tint: '#3D8A73',
  background: '#F5F2EA', foreground: '#20343D',
  card: '#FBF9F3', cardForeground: '#20343D',
  primary: '#3D8A73', primaryForeground: '#F9F6EF',
  secondary: '#E8E2D5', secondaryForeground: '#20343D',
  muted: '#EDE9E0', mutedForeground: '#617079',
  accent: '#DB7A4F', accentForeground: '#20343D',
  destructive: '#C4302B', destructiveForeground: '#F9F6EF',
  border: '#D9D3C6', input: '#D9D3C6',
  forest: '#20343D', forestSoft: '#2A434C', forestLine: '#3D5A62',
  onForest: '#F2ECD9', onForestMuted: '#A8B8B2',
  sage: '#86BCA3', sageSoft: '#E4EEE8', amber: '#D9A441', amberSoft: '#F4E6C8',
  danger: '#C86B52', dangerSoft: '#F2E0D9', overlay: 'rgba(24,42,49,0.78)',
};
const dark: typeof light = {
  text: '#F2EEE3', tint: '#5CB89A',
  background: '#18272E', foreground: '#F2EEE3',
  card: '#22343C', cardForeground: '#F2EEE3',
  primary: '#5CB89A', primaryForeground: '#18272E',
  secondary: '#2F444C', secondaryForeground: '#F2EEE3',
  muted: '#2A3D45', mutedForeground: '#A6B3B6',
  accent: '#E08A62', accentForeground: '#18272E',
  destructive: '#D9534D', destructiveForeground: '#F2EEE3',
  border: '#3C525A', input: '#3C525A',
  forest: '#101D23', forestSoft: '#1D2F37', forestLine: '#35505A',
  onForest: '#F2ECD9', onForestMuted: '#A8B8B2',
  sage: '#86BCA3', sageSoft: '#26413A', amber: '#E3B45A', amberSoft: '#43391F',
  danger: '#E08A70', dangerSoft: '#4A2E28', overlay: 'rgba(10,18,22,0.8)',
};
const colors = { light, dark, radius: 8 };
export default colors;
