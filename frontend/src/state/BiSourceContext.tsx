import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createFonte, fetchFontes, type BiSource } from '../api/bridge'

const STORAGE_KEY = 'knowt-bi:active-source'

type BiSourceContextValue = {
  sources: BiSource[]
  activeSource: BiSource | null
  activeSourceId: string
  isFiestaActive: boolean
  loading: boolean
  error: string | null
  setActiveSourceId: (id: string) => void
  refreshSources: () => void
  addSource: (payload: {
    name: string
    slug?: string
    role?: string
    logo_url?: string
    origin_product_id?: string
    actor?: string
  }) => Promise<{
    fonte: BiSource
    bind_s1?: {
      ok?: boolean
      error?: string
      connection_id?: string
      authz_status?: string
      smoke?: { ok?: boolean; pedidos_na_pagina?: number }
      note?: string
    } | null
  }>
  replaceSource: (fonte: BiSource) => void
}

const BiSourceContext = createContext<BiSourceContextValue | null>(null)

function readStoredId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'tinyerp'
  } catch {
    return 'tinyerp'
  }
}

export function BiSourceProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<BiSource[]>([])
  const [activeSourceId, setActiveSourceIdState] = useState(readStoredId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refreshSources = useCallback(() => setTick((t) => t + 1), [])

  const setActiveSourceId = useCallback((id: string) => {
    const next = (id || 'tinyerp').trim().toLowerCase()
    setActiveSourceIdState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchFontes(true)
      .then((res) => {
        if (cancelled) return
        const list = res.fontes || []
        setSources(list)
        const ids = new Set(list.map((s) => s.id))
        setActiveSourceIdState((current) => {
          if (ids.has(current)) return current
          try {
            localStorage.setItem(STORAGE_KEY, 'tinyerp')
          } catch {
            /* ignore */
          }
          return 'tinyerp'
        })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSources([
            {
              id: 'tinyerp',
              name: 'Tiny ERP',
              db_name: 'bi_tinyerp',
              builtin: true,
              status: 'active',
            },
          ])
          setError(err instanceof Error ? err.message : 'Falha ao carregar fontes')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tick])

  const replaceSource = useCallback((fonte: BiSource) => {
    setSources((prev) => prev.map((s) => (s.id === fonte.id ? { ...s, ...fonte } : s)))
  }, [])

  const addSource = useCallback(
    async (payload: {
      name: string
      slug?: string
      role?: string
      logo_url?: string
      origin_product_id?: string
      actor?: string
    }) => {
      const res = await createFonte(payload)
      if (!res.ok || !res.fonte) {
        throw new Error(res.error || 'Não foi possível criar a fonte')
      }
      refreshSources()
      setActiveSourceId(res.fonte.id)
      return { fonte: res.fonte, bind_s1: res.bind_s1 ?? null }
    },
    [refreshSources, setActiveSourceId],
  )

  const activeSource = useMemo(
    () => sources.find((s) => s.id === activeSourceId) || sources[0] || null,
    [sources, activeSourceId],
  )

  const value = useMemo(
    () => ({
      sources,
      activeSource,
      activeSourceId: activeSource?.id || 'tinyerp',
      isFiestaActive: (activeSource?.id || 'tinyerp') === 'tinyerp',
      loading,
      error,
      setActiveSourceId,
      refreshSources,
      addSource,
      replaceSource,
    }),
    [
      sources,
      activeSource,
      loading,
      error,
      setActiveSourceId,
      refreshSources,
      addSource,
      replaceSource,
    ],
  )

  return <BiSourceContext.Provider value={value}>{children}</BiSourceContext.Provider>
}

export function useBiSource() {
  const ctx = useContext(BiSourceContext)
  if (!ctx) throw new Error('useBiSource fora de BiSourceProvider')
  return ctx
}
