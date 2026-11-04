/**
 * designTokens.ts
 * Single source of truth for the Compass CRM design language.
 * Light institutional wealth planning workspace.
 */
export const designTokens = {
  colors: {
    background:       '#F5F7FA',
    surface:          '#FFFFFF',
    surfaceSecondary: '#F8FAFC',
    surfaceTertiary:  '#F1F5F9',

    textPrimary:   '#0F172A',
    textSecondary: '#64748B',
    textMuted:     '#94A3B8',

    border:        '#E2E8F0',
    borderLight:   '#F1F5F9',

    primary:   '#7C3AED',
    primaryBg: '#F5F3FF',
    success:   '#059669',
    successBg: '#ECFDF5',
    warning:   '#D97706',
    warningBg: '#FFFBEB',
    danger:    '#DC2626',
    dangerBg:  '#FEF2F2',
  },

  radius: {
    panel:   '1rem',      /* 16px */
    control: '0.75rem',   /* 12px */
    pill:    '9999px',
  },

  shadows: {
    panel:  '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
    subtle: '0 1px 2px rgba(15,23,42,0.04)',
    float:  '0 4px 16px rgba(15,23,42,0.08)',
  },
} as const;
