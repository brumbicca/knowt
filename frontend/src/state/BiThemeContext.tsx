import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import {
  loadStoredThemeId,
  storeThemeId,
  themesById,
  type BiThemeId,
} from '../theme'

type BiThemeContextValue = {
  themeId: BiThemeId
  setThemeId: (id: BiThemeId) => void
}

const BiThemeContext = createContext<BiThemeContextValue | null>(null)

export function BiThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<BiThemeId>(() => loadStoredThemeId())

  const setThemeId = useCallback((id: BiThemeId) => {
    setThemeIdState(id)
    storeThemeId(id)
  }, [])

  const value = useMemo(() => ({ themeId, setThemeId }), [themeId, setThemeId])
  const theme = themesById[themeId]

  return (
    <BiThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </BiThemeContext.Provider>
  )
}

export function useBiTheme(): BiThemeContextValue {
  const ctx = useContext(BiThemeContext)
  if (!ctx) {
    throw new Error('useBiTheme must be used within BiThemeProvider')
  }
  return ctx
}
