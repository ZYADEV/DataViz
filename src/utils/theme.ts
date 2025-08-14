import chroma from 'chroma-js';
import { Theme } from '../types';

// Domain-specific color mappings
const domainColorMaps: Record<string, { primary: string; secondary: string }> = {
  agriculture: { primary: '#4CAF50', secondary: '#8BC34A' },
  finance: { primary: '#2196F3', secondary: '#00BCD4' },
  health: { primary: '#E91E63', secondary: '#9C27B0' },
  transport: { primary: '#00BCD4', secondary: '#03A9F4' },
  environment: { primary: '#4CAF50', secondary: '#795548' },
  education: { primary: '#FF9800', secondary: '#FFC107' },
  technology: { primary: '#9C27B0', secondary: '#673AB7' },
  retail: { primary: '#FF5722', secondary: '#FF9800' },
  energy: { primary: '#FFEB3B', secondary: '#FFC107' },
};

// Generate a color palette from a seed color
export const generatePalette = (seedColor: string, steps: number = 7): string[] => {
  const base = chroma(seedColor);
  const scale = chroma.scale([
    base.brighten(1.5),
    base,
    base.darken(1.5)
  ]).mode('lab').colors(steps);

  return scale;
};

// Generate complementary colors
export const getComplementaryColor = (color: string): string => {
  return chroma(color).set('hsl.h', chroma(color).get('hsl.h') + 180).hex();
};

// Check color contrast for accessibility
export const checkContrast = (color1: string, color2: string): number => {
  return chroma.contrast(color1, color2);
};

// Adjust color for accessibility
export const adjustForAccessibility = (color: string, backgroundColor: string = '#0D0D14'): string => {
  let adjustedColor = chroma(color);
  const minContrast = 4.5; // WCAG AA standard

  let contrast = chroma.contrast(adjustedColor, backgroundColor);
  let iterations = 0;
  const maxIterations = 20;

  while (contrast < minContrast && iterations < maxIterations) {
    if (adjustedColor.luminance() < 0.5) {
      adjustedColor = adjustedColor.brighten(0.1);
    } else {
      adjustedColor = adjustedColor.darken(0.1);
    }
    contrast = chroma.contrast(adjustedColor, backgroundColor);
    iterations++;
  }

  return adjustedColor.hex();
};

// Generate theme from dataset metadata
export const generateThemeFromDataset = (
  datasetName: string,
  domain?: string
): Theme => {
  let primary: string;
  let secondary: string;

  if (domain && domainColorMaps[domain.toLowerCase()]) {
    const domainColors = domainColorMaps[domain.toLowerCase()];
    primary = domainColors.primary;
    secondary = domainColors.secondary;
  } else {
    // Generate from dataset name hash
    const hash = Array.from(datasetName).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    primary = chroma.hsl(hue, 0.7, 0.5).hex();
    secondary = chroma.hsl((hue + 120) % 360, 0.7, 0.5).hex();
  }

  // Ensure accessibility
  primary = adjustForAccessibility(primary);
  secondary = adjustForAccessibility(secondary);

  // Generate chart palette
  const chartPalette = generatePalette(primary, 8);

  return {
    name: `${datasetName} Theme`,
    domain: domain || 'generic',
    colors: {
      primary,
      secondary,
      background: '#0D0D14',
      surface: 'rgba(255, 255, 255, 0.05)',
      text: 'rgba(255, 255, 255, 0.95)',
      chart_palette: chartPalette,
    },
  };
};

// Apply theme to CSS variables
export const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;
  root.style.setProperty('--primary-accent', theme.colors.primary);
  root.style.setProperty('--secondary-accent', theme.colors.secondary);
  root.style.setProperty('--bg', theme.colors.background);
  root.style.setProperty('--surface', theme.colors.surface);
  root.style.setProperty('--text-primary', theme.colors.text);
};

// Predefined themes for quick selection
export const predefinedThemes: Theme[] = [
  {
    name: 'Ocean Blue',
    domain: 'finance',
    colors: {
      primary: '#00BFA6',
      secondary: '#FF6B6B',
      background: '#0D0D14',
      surface: 'rgba(255, 255, 255, 0.05)',
      text: 'rgba(255, 255, 255, 0.95)',
      chart_palette: ['#00BFA6', '#26C6DA', '#42A5F5', '#66BB6A', '#FFCA28', '#FF7043', '#EF5350'],
    },
  },
  {
    name: 'Forest Green',
    domain: 'environment',
    colors: {
      primary: '#4CAF50',
      secondary: '#795548',
      background: '#0D0D14',
      surface: 'rgba(255, 255, 255, 0.05)',
      text: 'rgba(255, 255, 255, 0.95)',
      chart_palette: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'],
    },
  },
  {
    name: 'Sunset Orange',
    domain: 'retail',
    colors: {
      primary: '#FF9800',
      secondary: '#E91E63',
      background: '#0D0D14',
      surface: 'rgba(255, 255, 255, 0.05)',
      text: 'rgba(255, 255, 255, 0.95)',
      chart_palette: ['#FF9800', '#FF5722', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3'],
    },
  },
];

// Get theme by domain
export const getThemeByDomain = (domain: string): Theme => {
  return predefinedThemes.find(theme => theme.domain === domain) || predefinedThemes[0];
};
