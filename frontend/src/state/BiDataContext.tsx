import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  loadOverviewKpis,
  patchOverviewCharts,
  fetchDashboard,
  buildEmptyOverview,
  type BiOverview,
  type Periodo,
  type PeriodQuery,
  PERIODO_OPTIONS,
  MARKETPLACE_OPTIONS,
} from '../api/bridge'
import { useBiSource } from './BiSourceContext'

type MarketplaceOption = { id: string; label: string }

type BiDataContextValue = {
  periodo: Periodo
  setPeriodo: (p: Periodo) => void
  customRange: { inicio: string; fim: string } | null
  setCustomRange: (r: { inicio: string; fim: string } | null) => void
  periodQuery: PeriodQuery
  marketplace: string
  setMarketplace: (m: string) => void
  data: BiOverview | null
  loading: boolean
  error: string | null
  refresh: () => void
  periodoOptions: typeof PERIODO_OPTIONS
  marketplaceOptions: MarketplaceOption[]
}

const BiDataContext = createContext<BiDataContextValue | null>(null)

export function BiDataProvider({ children }: { children: ReactNode }) {
  const { isFiestaActive, activeSource } = useBiSource()
  const [periodo, setPeriodoState] = useState<Periodo>('7d')
  const [customRange, setCustomRangeState] = useState<{ inicio: string; fim: string } | null>(
    null,
  )
  const [marketplace, setMarketplace] = useState('')
  const [data, setData] = useState<BiOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  const setPeriodo = useCallback((p: Periodo) => {
    setCustomRangeState(null)
    setPeriodoState(p)
  }, [])

  const setCustomRange = useCallback((r: { inicio: string; fim: string } | null) => {
    setCustomRangeState(r)
  }, [])

  const periodQuery: PeriodQuery = useMemo(() => {
    if (customRange?.inicio && customRange?.fim) {
      return { dataInicio: customRange.inicio, dataFim: customRange.fim }
    }
    return { periodo }
  }, [customRange, periodo])

  // Ao mudar de fonte, limpar filtro de canal (IDs Fiesta ≠ representantes SF).
  useEffect(() => {
    setMarketplace('')
  }, [activeSource?.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const canLoad =
      isFiestaActive ||
      (Boolean(activeSource?.db_name) &&
        /^bi_/i.test(String(activeSource?.db_name)) &&
        Number(activeSource?.pedidos_count || 0) > 0)

    if (!canLoad) {
      const empty = buildEmptyOverview(periodQuery, marketplace || null)
      setData(empty)
      setError(null)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    // As duas chamadas correm em paralelo: se o dashboard chegar primeiro guardamos
    // a série para aplicar no overview, senão o patch perdia-se e os gráficos ficavam vazios.
    let dashPendente: Awaited<ReturnType<typeof fetchDashboard>> | null = null
    let overviewPronto = false

    loadOverviewKpis(periodQuery, marketplace || null)
      .then((overview) => {
        if (cancelled) return
        overviewPronto = true
        setData(dashPendente ? patchOverviewCharts(overview, dashPendente) : overview)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null)
          setError(err instanceof Error ? err.message : 'Falha ao carregar dados')
          setLoading(false)
        }
      })

    fetchDashboard(periodQuery, marketplace || undefined, { enrich: false })
      .then((dash) => {
        if (cancelled) return
        dashPendente = dash
        if (overviewPronto) {
          setData((prev) => (prev ? patchOverviewCharts(prev, dash) : prev))
        }
      })
      .catch(() => {
        /* gráficos opcionais — KPIs já visíveis */
      })

    return () => {
      cancelled = true
    }
  }, [periodQuery, marketplace, tick, isFiestaActive, activeSource?.id, activeSource?.db_name, activeSource?.pedidos_count])

  const marketplaceOptions = useMemo((): MarketplaceOption[] => {
    if (isFiestaActive) return [...MARKETPLACE_OPTIONS]
    const fromData = (data?.canais || [])
      .filter((c) => c.name && (c.value > 0 || c.pedidos > 0))
      .map((c) => ({ id: c.name, label: c.name }))
    return [{ id: '', label: 'Todos os canais' }, ...fromData]
  }, [isFiestaActive, data?.canais])

  const value = useMemo(
    () => ({
      periodo,
      setPeriodo,
      customRange,
      setCustomRange,
      periodQuery,
      marketplace,
      setMarketplace,
      data,
      loading,
      error,
      refresh,
      periodoOptions: PERIODO_OPTIONS,
      marketplaceOptions,
    }),
    [
      periodo,
      setPeriodo,
      customRange,
      setCustomRange,
      periodQuery,
      marketplace,
      data,
      loading,
      error,
      refresh,
      marketplaceOptions,
    ],
  )

  return <BiDataContext.Provider value={value}>{children}</BiDataContext.Provider>
}

export function useBiData() {
  const ctx = useContext(BiDataContext)
  if (!ctx) throw new Error('useBiData fora de BiDataProvider')
  return ctx
}
