import { createTheme, type Theme } from '@mui/material/styles'

export type BiThemeId = 'fiesta' | 'exponential'

export const THEME_STORAGE_KEY = 'fiesta-bi-theme-id'

export const THEME_OPTIONS: Array<{ id: BiThemeId; label: string }> = [
  { id: 'fiesta', label: 'Fiesta' },
  { id: 'exponential', label: 'Exponential' },
]

/** Cores de gráfico por tema (Recharts não lê MUI automaticamente). */
export type ChartTokens = {
  line: string
  fill: string
  pie: string[]
  logoGradient: string
}

declare module '@mui/material/styles' {
  interface Theme {
    chart: ChartTokens
  }
  interface ThemeOptions {
    chart?: ChartTokens
  }
}

const sharedTypography = {
  fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  h4: {
    fontFamily: '"Outfit", "IBM Plex Sans", sans-serif',
    fontWeight: 700,
    letterSpacing: '-0.03em',
  },
  h6: {
    fontFamily: '"Outfit", "IBM Plex Sans", sans-serif',
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  subtitle2: {
    fontFamily: '"Outfit", "IBM Plex Sans", sans-serif',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    fontSize: '0.68rem',
  },
  button: {
    fontFamily: '"Outfit", "IBM Plex Sans", sans-serif',
    fontWeight: 600,
  },
}

/** Tema Fiesta BI — command center (teal). Padrão. */
export const fiestaTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0f766e',
      light: '#14b8a6',
      dark: '#115e59',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0e7490',
      light: '#22d3ee',
      dark: '#155e75',
    },
    background: {
      default: '#eef3f2',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
    success: { main: '#15803d' },
    warning: { main: '#c2410c' },
    error: { main: '#b91c1c' },
    divider: 'rgba(15, 23, 42, 0.08)',
  },
  typography: sharedTypography,
  shape: { borderRadius: 8 },
  chart: {
    line: '#0f766e',
    fill: '#14b8a6',
    pie: ['#0f766e', '#0e7490', '#0369a1', '#c2410c', '#64748b', '#7c3aed'],
    logoGradient: 'linear-gradient(145deg, #14b8a6 0%, #0f766e 55%, #0e7490 100%)',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(15, 118, 110, 0.4) transparent',
        },
        body: {
          fontFeatureSettings: '"ss01" on, "cv11" on',
          background:
            'radial-gradient(1100px 480px at 8% -8%, rgba(20, 184, 166, 0.2), transparent 58%),' +
            'radial-gradient(900px 420px at 96% 4%, rgba(14, 116, 144, 0.14), transparent 52%),' +
            'linear-gradient(180deg, #f4f8f7 0%, #eef3f2 40%, #e8efed 100%)',
          backgroundAttachment: 'fixed',
        },
        '::-webkit-scrollbar': { width: 10, height: 10 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(15, 118, 110, 0.35)',
          borderRadius: 8,
          border: '2px solid transparent',
          backgroundClip: 'padding-box',
        },
        '::-webkit-scrollbar-thumb:hover': {
          backgroundColor: 'rgba(15, 118, 110, 0.55)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.94)',
          color: '#0f172a',
          borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.04)',
          border: '1px solid rgba(15, 118, 110, 0.1)',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundImage: 'none',
        },
        rounded: {
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 14px rgba(15, 118, 110, 0.28)' },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 6 },
        sizeSmall: { height: 24 },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontFamily: '"Outfit", "IBM Plex Sans", sans-serif',
          fontWeight: 700,
          borderRadius: 12,
        },
      },
    },
  },
})

/**
 * Tema Exponential — eco visual do Exponential Club
 * (https://ricamello.com.br/exponentialclub/).
 *
 * Dark de marca (#120E18), primária #8E5ACE, CTA amarelo #F1E333.
 * Fundo, AppBar e scrollbar seguem o tema (não o Fiesta claro).
 */
export const exponentialTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#8E5ACE',
      light: '#A878DB',
      dark: '#6B3FA0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#F1E333',
      light: '#F7EB6A',
      dark: '#C4B100',
      contrastText: '#120E18',
    },
    background: {
      default: '#120E18',
      paper: '#1A1424',
    },
    text: {
      primary: '#F5F0FA',
      secondary: '#B8A9C9',
    },
    success: { main: '#4ade80' },
    warning: { main: '#F1E333' },
    error: { main: '#f87171' },
    divider: 'rgba(168, 120, 219, 0.18)',
    action: {
      hover: 'rgba(142, 90, 206, 0.12)',
      selected: 'rgba(142, 90, 206, 0.22)',
    },
  },
  typography: sharedTypography,
  shape: { borderRadius: 8 },
  chart: {
    line: '#A878DB',
    fill: '#8E5ACE',
    pie: ['#8E5ACE', '#A878DB', '#F1E333', '#f87171', '#94a3b8', '#22d3ee'],
    logoGradient: 'linear-gradient(145deg, #A878DB 0%, #8E5ACE 55%, #6B3FA0 100%)',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(142, 90, 206, 0.55) #120E18',
        },
        body: {
          fontFeatureSettings: '"ss01" on, "cv11" on',
          background:
            'radial-gradient(1000px 520px at 12% -10%, rgba(142, 90, 206, 0.28), transparent 55%),' +
            'radial-gradient(800px 400px at 92% 0%, rgba(241, 227, 51, 0.08), transparent 48%),' +
            'linear-gradient(180deg, #1A1125 0%, #120E18 45%, #0E0A14 100%)',
          backgroundAttachment: 'fixed',
          color: '#F5F0FA',
        },
        '::-webkit-scrollbar': { width: 10, height: 10 },
        '::-webkit-scrollbar-track': { background: '#120E18' },
        '::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(142, 90, 206, 0.5)',
          borderRadius: 8,
          border: '2px solid #120E18',
          backgroundClip: 'padding-box',
        },
        '::-webkit-scrollbar-thumb:hover': {
          backgroundColor: 'rgba(168, 120, 219, 0.75)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(18, 14, 24, 0.88)',
          color: '#F5F0FA',
          borderBottom: '1px solid rgba(168, 120, 219, 0.2)',
          backdropFilter: 'blur(12px)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(142, 90, 206, 0.1)',
          border: '1px solid rgba(168, 120, 219, 0.2)',
          backgroundImage: 'none',
          backgroundColor: '#1A1424',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 18px rgba(142, 90, 206, 0.45)' },
        },
        containedSecondary: {
          color: '#120E18',
          fontWeight: 700,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 6 },
        sizeSmall: { height: 24 },
        outlined: {
          borderColor: 'rgba(168, 120, 219, 0.35)',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontFamily: '"Outfit", "IBM Plex Sans", sans-serif',
          fontWeight: 700,
          borderRadius: 12,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardWarning: {
          backgroundColor: 'rgba(241, 227, 51, 0.12)',
          color: '#F5F0FA',
        },
        standardError: {
          backgroundColor: 'rgba(248, 113, 113, 0.12)',
          color: '#F5F0FA',
        },
      },
    },
  },
})

/** @deprecated Preferir fiestaTheme — mantido para imports existentes. */
export const biTheme = fiestaTheme

export const themesById: Record<BiThemeId, Theme> = {
  fiesta: fiestaTheme,
  exponential: exponentialTheme,
}

export function resolveThemeId(raw: string | null | undefined): BiThemeId {
  if (raw === 'exponential') return 'exponential'
  return 'fiesta'
}

export function loadStoredThemeId(): BiThemeId {
  try {
    return resolveThemeId(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'fiesta'
  }
}

export function storeThemeId(id: BiThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}
