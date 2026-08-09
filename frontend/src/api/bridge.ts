export type Periodo = 'hoje' | 'semana' | 'mes' | '7d' | '30d'

/** Preset de período ou intervalo custom (bridge: data_inicio / data_fim). */
export type PeriodQuery = {
  periodo?: Periodo
  dataInicio?: string
  dataFim?: string
}

export function periodParams(
  query: PeriodQuery,
  marketplace?: string,
): Record<string, string> {
  const params: Record<string, string> = {}
  if (query.dataInicio && query.dataFim) {
    params.data_inicio = query.dataInicio
    params.data_fim = query.dataFim
  } else {
    params.periodo = query.periodo || '7d'
  }
  if (marketplace) params.marketplace = marketplace
  // Fonte activa do BI (localStorage) — o bridge resolve source_id → db; nunca envia db_name.
  try {
    const sid = (localStorage.getItem('knowt-bi:active-source') || 'tinyerp').trim().toLowerCase()
    params.source_id = sid || 'tinyerp'
  } catch {
    params.source_id = 'tinyerp'
  }
  return params
}

export type VendasPeriodo = {
  periodo: { inicio: string; fim: string; label: string }
  marketplace: string | null
  pedidos_validos: number
  vendas_validas: number
  vendas_validas_fmt: string
  raw?: Record<string, unknown>
}

export type PedidosMetricas = {
  periodo: { inicio: string; fim: string; label: string }
  total_liquido: number
  total_liquido_fmt: string
  total_receita: number
  total_receita_fmt: string
  total_pedidos: number
  metricas?: Record<string, number>
}

export type DailyItem = {
  date: string
  pedidosValidos?: number
  receitaValida?: number
  pedidos?: number
  receita?: number
}

export type DashboardCompleto = {
  periodo: { inicio: string; fim: string; label: string }
  dashboard: {
    stats?: {
      totalPedidos?: number
      totalVendas?: number
      totalLiquido?: number
      totalVendasValidas?: number
      totalPedidosValidos?: number
    }
    dailyStats?: DailyItem[]
    topSkus?: Array<{
      sku: string
      descricao?: string
      quantidade?: number
      receita?: number
      catalog_sku?: string
      listing_id?: string
    }>
  }
}

export type Comparacao = {
  comparacao: {
    principal?: { totalVendasValidas?: number; totalPedidosValidos?: number }
    comparacao?: { totalVendasValidas?: number; totalPedidosValidos?: number }
    diferenca?: { totalVendas?: number; totalPedidos?: number }
  }
}

export type MargemPeriodo = {
  periodo: { inicio: string; fim: string; label: string }
  margem: {
    margemTotal?: number
    margemMedia?: number
    totalMargens?: number
    totalCMV?: number
    totalValorPago?: number
    totalImpostos?: number
    totalFretes?: number
    totalQuantidade?: number
  }
}

const BASE = (import.meta.env.VITE_BI_BRIDGE_BASE as string) || '/api/bridge'
const KEY = (import.meta.env.VITE_BI_BRIDGE_KEY as string) || ''

const CHANNELS = [
  { id: 'shopee', label: 'Shopee' },
  { id: 'ml', label: 'Mercado Livre' },
  { id: 'shein', label: 'Shein' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'tray', label: 'Tray' },
] as const

/** Nome exibido no donut/bridge → id do filtro Canal. */
export function channelNameToId(name: string): string {
  const n = (name || '').trim().toLowerCase()
  if (!n) return ''
  if (n.includes('shopee')) return 'shopee'
  if (n.includes('mercado') || n === 'ml' || n.includes('mercadolivre')) return 'ml'
  if (n.includes('shein')) return 'shein'
  if (n.includes('amazon')) return 'amazon'
  if (n.includes('tiktok')) return 'tiktok'
  if (n.includes('tray')) return 'tray'
  const exact = CHANNELS.find((c) => c.label.toLowerCase() === n || c.id === n)
  return exact?.id || ''
}

async function bridgeGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params)
  const url = `${BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}${
    qs.toString() ? `?${qs}` : ''
  }`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(KEY ? { 'X-Fiesta-Bi-Key': KEY } : {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Bridge ${res.status}: ${text.slice(0, 160) || res.statusText}`)
  }
  return res.json() as Promise<T>
}

async function bridgePost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const url = `${BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(KEY ? { 'X-Fiesta-Bi-Key': KEY } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Bridge ${res.status}: ${text.slice(0, 160) || res.statusText}`)
  }
  return res.json() as Promise<T>
}

async function bridgePatch<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const url = `${BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(KEY ? { 'X-Fiesta-Bi-Key': KEY } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Bridge ${res.status}: ${text.slice(0, 160) || res.statusText}`)
  }
  return res.json() as Promise<T>
}

async function bridgeDelete<T>(path: string): Promise<T> {
  const url = `${BASE.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...(KEY ? { 'X-Fiesta-Bi-Key': KEY } : {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Bridge ${res.status}: ${text.slice(0, 160) || res.statusText}`)
  }
  return res.json() as Promise<T>
}

export { bridgeGet, bridgePost, bridgePatch, bridgeDelete }

export function fetchVendas(query: PeriodQuery | Periodo, marketplace?: string) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<VendasPeriodo>('/vendas/periodo', periodParams(q, marketplace))
}

export function fetchMetricas(query: PeriodQuery | Periodo, marketplace?: string) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<PedidosMetricas>('/pedidos/metricas', periodParams(q, marketplace))
}

export function fetchDashboard(
  query: PeriodQuery | Periodo,
  marketplace?: string,
  opts?: { enrich?: boolean },
) {
  const q = typeof query === 'string' ? { periodo: query } : query
  const params = periodParams(q, marketplace)
  if (opts?.enrich === false) params.enrich = '0'
  return bridgeGet<DashboardCompleto>('/vendas/dashboard-completo', params)
}

export function fetchComparacao(query: PeriodQuery | Periodo, marketplace?: string) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<Comparacao>('/vendas/comparacao', periodParams(q, marketplace))
}

export function fetchMargens(query: PeriodQuery | Periodo, marketplace?: string) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<MargemPeriodo>('/margens/periodo', periodParams(q, marketplace))
}

export const MARKETPLACE_OPTIONS = [
  { id: '', label: 'Todos os canais' },
  ...CHANNELS.map((c) => ({ id: c.id, label: c.label })),
] as const

export type MarketplaceId = (typeof CHANNELS)[number]['id'] | ''

export async function fetchCanais(query: PeriodQuery | Periodo, marketplace?: string) {
  const q = typeof query === 'string' ? { periodo: query } : query
  try {
    const res = await bridgeGet<{
      canais?: Array<{
        nome?: string
        name?: string
        vendas?: number
        value?: number
        pedidos?: number
      }>
      capability_status?: string
    }>('/vendas/canais', {
      ...periodParams(q, marketplace),
      limite: '15',
    })
    if (res.capability_status === 'unavailable') return []
    return (res.canais || [])
      .map((c) => {
        const name = String(c.name || c.nome || '').trim() || '(sem canal)'
        return {
          id: name,
          name,
          value: Number(c.value ?? c.vendas ?? 0),
          pedidos: Number(c.pedidos || 0),
        }
      })
      .filter((r) => r.value > 0 || r.pedidos > 0)
  } catch {
    return []
  }
}

export type BiOverview = {
  periodo: Periodo | 'custom'
  marketplace: string | null
  rangeLabel: string
  vendasFmt: string
  vendas: number
  liquidoFmt: string
  liquido: number
  pedidos: number
  taxas: number
  taxasFmt: string
  frete: number
  freteFmt: string
  margemFmt: string
  margemTotal: number
  cmvFmt: string
  cmvTotal: number
  margemMediaFmt: string
  totalMargens: number
  coberturaPct: number | null
  /** CMV agregado absurdo vs vendas (cadastro de custo) — não tratar como P&L */
  cmvInconsistente?: boolean
  prevVendas: number | null
  prevVendasFmt: string | null
  prevPedidos: number | null
  deltaVendasPct: number | null
  deltaPedidosPct: number | null
  daily: Array<{ dia: string; valor: number; pedidos: number }>
  canais: Array<{ name: string; value: number; pedidos: number }>
  topSkus: Array<{
    sku: string
    descricao: string
    receita: number
    quantidade: number
    catalog_sku?: string
    listing_id?: string
  }>
}

export type SyncStatusPayload = {
  ok?: boolean
  error?: string
  message?: string
  sync?: {
    running?: boolean
    progress?: number
    message?: string
    last_sync?: string | null
    last_sync_source?: string | null
    last_sync_marketplace?: string | null
    last_sync_efetiva?: string | null
    last_sync_efetiva_origem?: string | null
    last_activity_at?: string | null
    last_activity_marketplace?: string | null
    last_activity_summary?: string | null
    errors?: unknown[]
    sync_orders_processed?: number
    sync_orders_total?: number
  }
}

export type LojasPayload = {
  ok?: boolean
  s2_platform_stores?: Array<{
    key?: string
    label?: string
    stores?: Array<{ id?: string; name?: string; label?: string }>
  }>
  s1_marketplaces?: unknown
  s1_error?: string
  s1_note?: string
  s2_error?: string
}

export type OpsAlert = {
  severity: 'error' | 'warning' | 'info'
  code: string
  title: string
  detail: string
  at?: string
  marketplace?: string
  ocorrencias?: number
  desde?: string
}

export type MarginCoverage = {
  pedidos: number
  margens_registros: number
  cmv_total: number
  cmv_total_fmt: string
  margem_total: number
  margem_total_fmt: string
  cobertura_pct: number | null
  sem_margem: boolean
  sem_cmv: boolean
}

export type OpsAlertsPayload = {
  periodo: { inicio: string; fim: string; label: string }
  marketplace: string | null
  margin_coverage?: MarginCoverage
  margin_gap?: {
    pedidos?: number
    com_margem?: number
    sem_nf?: number
    nf_sem_margem?: number
    sem_nf_por_canal?: Record<string, number>
    sem_nf_hoje_por_canal?: Record<string, number>
    nf_sem_margem_por_canal?: Record<string, number>
    causa_principal?: string
    upseller_stalled?: boolean
    upseller_detail?: string
    nota?: string
  }
  alerts: OpsAlert[]
}

export function fetchOpsAlerts(query: PeriodQuery | Periodo, marketplace?: string) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<OpsAlertsPayload>('/ops/alerts', periodParams(q, marketplace))
}

export type InsightDominio =
  | 'home'
  | 'comercial'
  | 'mix'
  | 'logistica'
  | 'financeiro'
  | 'fiscal'
  | 'operacoes'
  | 'clientes'
  | 'despesas'
  | 'agenda'

export type InsightAchado = {
  titulo: string
  detalhe: string
  impacto?: 'alto' | 'medio' | 'baixo'
  destino?: string
  valor?: number
}

export type InsightAcao = InsightAchado & {
  dominio: InsightDominio
  dominio_label?: string
  score: number
  ordem_origem?: number
}

export type InsightPlano = {
  periodo?: { inicio?: string; fim?: string; label?: string }
  marketplace?: string | null
  acoes: InsightAcao[]
  total: number
  confianca?: { nivel?: 'alta' | 'media' | 'baixa'; motivo?: string }
  texto?: string
  fonte?: string
}

export type InsightSituacaoBreakdown = {
  situacao: string
  api?: string
  ok?: boolean
  total_orders?: number | null
  reason_code?: string
}

export type InsightResumo = {
  dominio: InsightDominio
  dominio_label?: string
  periodo?: { inicio?: string; fim?: string; label?: string }
  marketplace?: string | null
  titulo: string
  leitura: string
  insight: string
  principal: InsightAchado
  achados: InsightAchado[]
  recomendacoes: InsightAchado[]
  proxima_acao?: { titulo?: string; detalhe?: string; destino?: string }
  confianca?: { nivel?: 'alta' | 'media' | 'baixa'; motivo?: string }
  texto?: string
  fonte?: string
  breakdown?: {
    by_situacao?: InsightSituacaoBreakdown[]
    cached?: boolean
  } | null
}

/** «Insight da IA»: mesma leitura que o Hermes dá no chat (bridge `/insights/resumo`). */
export function fetchInsightResumo(
  dominio: InsightDominio,
  query: PeriodQuery | Periodo,
  marketplace?: string,
) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<InsightResumo>('/insights/resumo', {
    ...periodParams(q, marketplace),
    dominio,
  })
}

/** Plano transversal priorizado pela mesma lógica dos painéis e do Hermes. */
export function fetchInsightPlano(query: PeriodQuery | Periodo, marketplace?: string) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<InsightPlano>('/insights/plano', periodParams(q, marketplace))
}

export function fetchSyncStatus() {
  return bridgeGet<SyncStatusPayload>('/sync/status')
}

export function fetchLojas() {
  return bridgeGet<LojasPayload>('/lojas')
}

function fmtDay(iso: string): string {
  try {
    const d = new Date(`${iso}T12:00:00`)
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  } catch {
    return iso
  }
}

function pctDelta(atual: number, anterior: number): number | null {
  if (!anterior) return atual ? 100 : null
  return ((atual - anterior) / anterior) * 100
}

function assembleOverview(
  q: PeriodQuery,
  mp: string | undefined,
  vendas: VendasPeriodo,
  metricas: PedidosMetricas | null,
  dash: DashboardCompleto,
  comp: Comparacao | null,
  margens: MargemPeriodo | null,
  canais: BiOverview['canais'],
): BiOverview {
  const principal = comp?.comparacao?.principal?.totalVendasValidas
  const previo = comp?.comparacao?.comparacao?.totalVendasValidas
  const prevPedidosRaw = comp?.comparacao?.comparacao?.totalPedidosValidos
  const pedidosAtual = Number(
    vendas.pedidos_validos ||
      metricas?.total_pedidos ||
      comp?.comparacao?.principal?.totalPedidosValidos ||
      0,
  )
  const delta =
    principal != null && previo != null ? pctDelta(Number(principal), Number(previo)) : null
  const deltaPedidos =
    prevPedidosRaw != null ? pctDelta(pedidosAtual, Number(prevPedidosRaw)) : null

  const margemTotal = Number(margens?.margem?.margemTotal || 0)
  const cmvTotal = Number(margens?.margem?.totalCMV || 0)
  const margemMedia = Number(margens?.margem?.margemMedia || 0)
  const totalMargens = Number(margens?.margem?.totalMargens || 0)
  const coberturaPct =
    pedidosAtual > 0 ? Math.round((totalMargens / pedidosAtual) * 1000) / 10 : null
  const vendasNum = Number(vendas.vendas_validas || 0)
  const cmvInconsistente =
    vendasNum > 0 &&
    (cmvTotal > vendasNum * 1.5 || margemTotal < -vendasNum * 0.5)

  const m = metricas?.metricas || {}
  const taxas = Number(m.totalTaxas ?? 0)
  const frete = Number(m.totalFrete ?? 0)

  const daily = (dash.dashboard?.dailyStats || []).map((d) => ({
    dia: fmtDay(d.date),
    valor: Number(d.receitaValida ?? d.receita ?? 0),
    pedidos: Number(d.pedidosValidos ?? d.pedidos ?? 0),
  }))

  const topSkus = (dash.dashboard?.topSkus || []).slice(0, 5).map((s) => ({
    sku: String(s.sku || ''),
    descricao: String(s.descricao || s.sku || ''),
    receita: Number(s.receita || 0),
    quantidade: Number(s.quantidade || 0),
    catalog_sku: s.catalog_sku ? String(s.catalog_sku) : undefined,
    listing_id: s.listing_id ? String(s.listing_id) : undefined,
  }))

  const p = vendas.periodo
  const rangeLabel =
    p?.inicio && p?.fim
      ? `${p.inicio} → ${p.fim}`
      : q.dataInicio && q.dataFim
        ? `${q.dataInicio} → ${q.dataFim}`
        : q.periodo || 'custom'

  const liquidoFiltrado = Number(dash.dashboard?.stats?.totalLiquido || 0)
  const liquido = metricas ? Number(metricas.total_liquido || 0) : liquidoFiltrado
  const prevVendas = previo != null ? Number(previo) : null

  return {
    periodo: q.dataInicio && q.dataFim ? 'custom' : q.periodo || '7d',
    marketplace: mp || null,
    rangeLabel,
    vendasFmt: vendas.vendas_validas_fmt || fmtBrl(vendas.vendas_validas),
    vendas: Number(vendas.vendas_validas || 0),
    liquidoFmt: fmtBrl(liquido),
    liquido,
    pedidos: pedidosAtual,
    taxas,
    taxasFmt: fmtBrl(taxas),
    frete,
    freteFmt: fmtBrl(frete),
    margemFmt: fmtBrl(margemTotal),
    margemTotal,
    cmvFmt: fmtBrl(cmvTotal),
    cmvTotal,
    margemMediaFmt: `${margemMedia.toFixed(1)}%`,
    totalMargens,
    coberturaPct,
    cmvInconsistente,
    prevVendas,
    prevVendasFmt: prevVendas != null ? fmtBrl(prevVendas) : null,
    prevPedidos: prevPedidosRaw != null ? Number(prevPedidosRaw) : null,
    deltaVendasPct: delta,
    deltaPedidosPct: deltaPedidos,
    daily,
    canais,
    topSkus,
  }
}

/** KPIs + canais (rápido) — gráficos vêm depois via fetchDashboard. */
export async function loadOverviewKpis(
  query: PeriodQuery | Periodo,
  marketplace?: string | null,
): Promise<BiOverview> {
  const q: PeriodQuery = typeof query === 'string' ? { periodo: query } : query
  const mp = marketplace?.trim() || undefined
  const [vendas, metricas, comp, margens, canais] = await Promise.all([
    fetchVendas(q, mp),
    fetchMetricas(q, mp).catch(() => null),
    fetchComparacao(q, mp).catch(() => null),
    fetchMargens(q, mp).catch(() => null),
    fetchCanais(q, mp),
  ])
  const emptyDash: DashboardCompleto = {
    periodo: vendas.periodo,
    dashboard: { stats: {}, dailyStats: [], topSkus: [] },
  }
  return assembleOverview(q, mp, vendas, metricas, emptyDash, comp, margens, canais)
}

export function patchOverviewCharts(overview: BiOverview, dash: DashboardCompleto): BiOverview {
  const daily = (dash.dashboard?.dailyStats || []).map((d) => ({
    dia: fmtDay(d.date),
    valor: Number(d.receitaValida ?? d.receita ?? 0),
    pedidos: Number(d.pedidosValidos ?? d.pedidos ?? 0),
  }))
  const topSkus = (dash.dashboard?.topSkus || []).slice(0, 5).map((s) => ({
    sku: String(s.sku || ''),
    descricao: String(s.descricao || s.sku || ''),
    receita: Number(s.receita || 0),
    quantidade: Number(s.quantidade || 0),
    catalog_sku: s.catalog_sku ? String(s.catalog_sku) : undefined,
    listing_id: s.listing_id ? String(s.listing_id) : undefined,
  }))
  const liquidoFiltrado = Number(dash.dashboard?.stats?.totalLiquido || 0)
  return {
    ...overview,
    daily,
    topSkus,
    liquido: overview.liquido || liquidoFiltrado,
    liquidoFmt: overview.liquido ? overview.liquidoFmt : fmtBrl(liquidoFiltrado),
  }
}

export async function loadOverview(
  query: PeriodQuery | Periodo,
  marketplace?: string | null,
): Promise<BiOverview> {
  const q: PeriodQuery = typeof query === 'string' ? { periodo: query } : query
  const mp = marketplace?.trim() || undefined
  const kpis = await loadOverviewKpis(q, mp)
  try {
    const dash = await fetchDashboard(q, mp, { enrich: false })
    return patchOverviewCharts(kpis, dash)
  } catch {
    return kpis
  }
}

export function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export type BiSource = {
  id: string
  name: string
  db_name: string
  builtin?: boolean
  status?: string
  role?: string
  logo_url?: string | null
  pedidos_count?: number
}

export type FontesResponse = {
  ok?: boolean
  fontes: BiSource[]
  total?: number
}

export function fetchFontes(includeCounts = false) {
  return bridgeGet<FontesResponse>('/fontes', includeCounts ? { counts: '1' } : {})
}

export function createFonte(payload: {
  name: string
  slug?: string
  role?: string
  logo_url?: string
  origin_product_id?: string
  actor?: string
  skip_smoke?: boolean
}) {
  return bridgePost<{
    ok: boolean
    fonte: BiSource
    error?: string
    bind_s1?: {
      ok?: boolean
      error?: string
      connection_id?: string
      authz_status?: string
      smoke?: { ok?: boolean; pedidos_na_pagina?: number }
      note?: string
      token_exposed?: boolean
    } | null
  }>('/fontes', payload)
}

export function bindFonteS1(
  id: string,
  payload?: { actor?: string; skip_env_write?: boolean; skip_smoke?: boolean },
) {
  return bridgePost<{
    ok: boolean
    bind_s1?: {
      ok?: boolean
      error?: string
      connection_id?: string
      authz_status?: string
      smoke?: { ok?: boolean; pedidos_na_pagina?: number }
      token_exposed?: boolean
    }
    error?: string
  }>(`/fontes/${encodeURIComponent(id)}/bind-s1`, payload || {})
}

export function updateFonte(
  id: string,
  payload: { name?: string; role?: string; logo_url?: string; slug?: string },
) {
  return bridgePatch<{ ok: boolean; fonte: BiSource; error?: string }>(
    `/fontes/${encodeURIComponent(id)}`,
    payload,
  )
}

export function deleteFonte(id: string) {
  return bridgeDelete<{ ok: boolean; id?: string; error?: string }>(
    `/fontes/${encodeURIComponent(id)}`,
  )
}

export type SourceStatusPayload = {
  ok?: boolean
  error?: string
  source_id?: string
  health?: 'ok' | 'warning' | 'error' | 'suspended' | string
  shadow?: boolean
  source?: {
    id?: string
    name?: string
    db_name?: string
    builtin?: boolean
    role?: string
    status?: string
    is_mirror?: boolean
    kill_switch_reason?: string | null
    kill_switch_at?: string | null
  }
  kill_switch?: {
    suspended?: boolean
    reason?: string | null
    at?: string | null
    fiesta_protected?: boolean
    resume_hint?: string | null
  }
  identity?: {
    org_id?: string | null
    unit_id?: string | null
    origin_product_id?: string | null
    connection_id?: string | null
    names?: {
      org?: string
      unit?: string
      origin_product?: string
      vendor?: string
    } | null
  }
  authorization?: {
    status?: string
    id?: string | null
    approved_by?: string
    approved_at?: string
    purpose?: string
    scope_mode?: string
    retention_days?: number
    missing?: boolean
    note?: string
  }
  connections?: Array<{
    id?: string
    kind?: string
    status?: string
    label?: string
  }>
  freshness?: {
    field?: string | null
    at?: string | null
    age_minutes?: number | null
    pedidos_count?: number
    ok?: boolean
    sla_minutes?: number
    state?: 'fresh' | 'stale' | 'critical' | 'unknown' | 'suspended' | string
  }
  coverage?: {
    pedidos_count?: number
    quality_suggestion?: string | null
    recon_ok?: boolean | null
    capabilities?: string[]
    capabilities_count?: number
  }
  drift?: {
    last?: {
      id?: string
      at?: string
      severity?: string
      alert_count?: number
      suggest_kill_switch?: boolean
      codes?: string[]
    } | null
  }
  semantics?: {
    last_run_id?: string
    quality_suggestion?: string | null
    recon_ok?: boolean | null
  }
  provenance?: {
    label_pt?: string
    contract_hint?: string | null
  }
}

/** Fase 8 — status/proveniência da fonte activa. */
export function fetchSourceStatus(sourceId?: string) {
  const sid = (sourceId || '').trim() || 'tinyerp'
  return bridgeGet<SourceStatusPayload>('/fonte/status', { source_id: sid })
}

/** DoD #1 — organizações / unidades / produtos de origem. */
export function fetchOrganizacoes() {
  return bridgeGet<{ ok?: boolean; organizacoes: Array<{ id: string; name: string; status?: string }>; total?: number }>(
    '/organizacoes',
  )
}

export function fetchUnidades(orgId?: string) {
  return bridgeGet<{ ok?: boolean; unidades: Array<{ id: string; org_id: string; name: string }>; total?: number }>(
    '/unidades',
    orgId ? { org_id: orgId } : {},
  )
}

export function fetchProdutosOrigem() {
  return bridgeGet<{
    ok?: boolean
    produtos_origem: Array<{ id: string; name: string; vendor?: string }>
    total?: number
  }>('/produtos-origem')
}

export function fetchAutorizacoes(sourceId?: string) {
  return bridgeGet<{
    ok?: boolean
    autorizacoes: Array<{
      id: string
      source_id?: string
      status?: string
      purpose?: string
      approved_by?: string
      scope?: { mode?: string }
    }>
    total?: number
  }>('/autorizacoes', sourceId ? { source_id: sourceId } : {})
}

export function seedOrganizacoes(actor = 'bi-wizard') {
  return bridgePost<{ ok?: boolean; identity?: unknown; authorizations?: unknown }>(
    '/organizacoes/seed',
    { actor },
  )
}

export function fetchCapabilities(sourceId?: string) {
  const sid = (sourceId || '').trim() || 'tinyerp'
  return bridgeGet<{
    ok?: boolean
    source_id?: string
    capabilities?: Record<string, { status?: string; reason_code?: string; quality?: string }>
  }>('/capabilities', { source_id: sid })
}

export function fetchConnectorObservability(sourceId?: string) {
  const sid = (sourceId || '').trim() || 'tinyerp'
  return bridgeGet<{
    ok?: boolean
    source_id?: string
    lag_state?: string
    availability?: string
    last_run?: {
      status?: string
      at?: string
      duration_ms?: number
      records_written?: number
      reason_codes?: string[]
    } | null
  }>('/connectors/observability', { source_id: sid })
}

export function fetchConexoes(sourceId?: string) {
  return bridgeGet<{
    ok?: boolean
    conexoes: Array<{ id: string; source_id?: string; kind?: string; label?: string; status?: string }>
    total?: number
  }>('/conexoes', sourceId ? { source_id: sourceId } : {})
}

/** Overview vazio para fontes externas (bridge multi-DB = fatia C). */
export function buildEmptyOverview(
  query: PeriodQuery | Periodo,
  marketplace?: string | null,
): BiOverview {
  const q: PeriodQuery = typeof query === 'string' ? { periodo: query } : query
  const rangeLabel =
    q.dataInicio && q.dataFim
      ? `${q.dataInicio} → ${q.dataFim}`
      : PERIODO_OPTIONS.find((o) => o.id === q.periodo)?.label || q.periodo || '—'
  return {
    periodo: q.dataInicio && q.dataFim ? 'custom' : q.periodo || '7d',
    marketplace: marketplace?.trim() || null,
    rangeLabel,
    vendasFmt: fmtBrl(0),
    vendas: 0,
    liquidoFmt: fmtBrl(0),
    liquido: 0,
    pedidos: 0,
    taxas: 0,
    taxasFmt: fmtBrl(0),
    frete: 0,
    freteFmt: fmtBrl(0),
    margemFmt: fmtBrl(0),
    margemTotal: 0,
    cmvFmt: fmtBrl(0),
    cmvTotal: 0,
    margemMediaFmt: '0,0%',
    totalMargens: 0,
    coberturaPct: null,
    prevVendas: null,
    prevVendasFmt: null,
    prevPedidos: null,
    deltaVendasPct: null,
    deltaPedidosPct: null,
    daily: [],
    canais: [],
    topSkus: [],
  }
}

export const PERIODO_OPTIONS: Array<{ id: Periodo; label: string }> = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: 'mes', label: 'Este mês' },
  { id: '30d', label: 'Últimos 30 dias' },
]

export type AssistantChatResponse = {
  ok: boolean
  reply?: string
  session_id?: string
  error?: string
  message?: string
}

export type AssistantTranscribeResponse = {
  ok: boolean
  transcript?: string
  model?: string
  provider?: string
  error?: string
  message?: string
}

export type BiChatContext = {
  page?: string
  insight_dominio?: InsightDominio
  periodo?: string
  data_inicio?: string
  data_fim?: string
  range_label?: string
  marketplace?: string | null
  marketplace_label?: string
  /** Fonte activa no BI — o bridge/Hermes nunca misturam fontes. */
  source_id?: string
  source_name?: string
  source_db_name?: string
  vendas_fmt?: string
  liquido_fmt?: string
  taxas_fmt?: string
  frete_fmt?: string
  margem_fmt?: string
  cmv_fmt?: string
  cmv_inconsistente?: boolean
  cobertura_pct?: number | null
  total_margens?: number
  pedidos?: number
  canais?: Array<{ name: string; value: number; vendas_fmt?: string }>
}

export async function sendAssistantChat(
  message: string,
  sessionId?: string | null,
  context?: BiChatContext | null,
): Promise<AssistantChatResponse> {
  const url = `${BASE.replace(/\/$/, '')}/assistant/chat`
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 160_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(KEY ? { 'X-Fiesta-Bi-Key': KEY } : {}),
      },
      body: JSON.stringify({
        message,
        ...(sessionId ? { session_id: sessionId } : {}),
        ...(context ? { context } : {}),
      }),
    })
    const data = (await res.json().catch(() => ({}))) as AssistantChatResponse
    if (!res.ok && !data.error) {
      return { ok: false, error: `http_${res.status}`, message: data.message }
    }
    return data
  } finally {
    window.clearTimeout(timer)
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler áudio'))
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.readAsDataURL(blob)
  })
}

/** Transcreve áudio do Chat BI (mesmo STT OpenAI do Telegram). */
export async function transcribeAssistantAudio(
  blob: Blob,
  mime?: string,
): Promise<AssistantTranscribeResponse> {
  const url = `${BASE.replace(/\/$/, '')}/assistant/transcribe`
  const audio_base64 = await blobToBase64(blob)
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 90_000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(KEY ? { 'X-Fiesta-Bi-Key': KEY } : {}),
      },
      body: JSON.stringify({
        audio_base64,
        mime: mime || blob.type || 'audio/webm',
        language: 'pt',
      }),
    })
    const data = (await res.json().catch(() => ({}))) as AssistantTranscribeResponse
    if (!res.ok && !data.error) {
      return { ok: false, error: `http_${res.status}`, message: data.message }
    }
    return data
  } finally {
    window.clearTimeout(timer)
  }
}

/* --- Fase B: domínios financeiros --- */

export type DespesasRelatorio = {
  periodo: { inicio: string; fim: string; label: string }
  relatorio: {
    totalDespesas?: number
    totalValor?: number
    despesasPorCategoria?: Array<{ _id?: string; total?: number; valor?: number }>
    despesasPorFornecedor?: Array<{ _id?: string; total?: number; valor?: number }>
    despesasPorMes?: Array<{ _id?: string; total?: number; valor?: number }>
  }
}

export type DespesasPeriodo = {
  periodo: { inicio: string; fim: string; label: string }
  despesas: Array<Record<string, unknown>>
}

export type NotasPeriodo = {
  periodo: { inicio: string; fim: string; label: string }
  marketplace?: string | null
  notas: Array<{
    _id?: string
    invoice_number?: string
    invoice_serie?: string
    invoice_total?: number
    issuance_date?: string
    marketplace_order_id?: string
    client?: { nome?: string; documento?: string }
    uf?: string
  }>
  count?: number
  resumo?: {
    total_notas?: number
    valor_total_nf?: number
    parcial?: boolean
  }
  paginacao?: {
    pagina?: number
    limite?: number
    total?: number
    totalPaginas?: number
    hasNextPage?: boolean
    hasPrevPage?: boolean
  }
}

export type FretesPeriodo = {
  periodo: { inicio: string; fim: string; label: string }
  fretes: Array<{
    _id?: string
    shipping_marketplace_id?: string
    total_cost?: number
    data_criacao?: string
    marketplace_data?: Record<string, unknown>
  }>
  paginacao?: { total?: number; pagina?: number; limite?: number }
}

export type MargensLista = {
  periodo: { inicio: string; fim: string; label: string }
  items: Array<{
    _id?: string
    description?: string
    ad_description?: string
    marketplace_name?: string
    paid_value?: number
    cmv?: number
    calculated_margin?: number
    calculated_margin_percent?: number
    taxes?: number
    shipping_cost?: number
    reference_date?: string
    code?: string
  }>
  totais?: Record<string, number>
  paginacao?: { total?: number }
}

export type MargensEstatisticas = {
  periodo: { inicio: string; fim: string; label: string }
  estatisticas: {
    totalMargens?: number
    margemTotal?: number
    margemMedia?: number
    totalCMV?: number
    totalImpostos?: number
    totalFretes?: number
    totalValorPago?: number
    totalQuantidade?: number
  }
}

export type ClientesRelatorio = {
  relatorio: {
    totalClientes?: number
    clientesPorEstado?: Record<string, number>
    clientesPorTipo?: Record<string, number>
  }
}

export function fetchDespesasRelatorio(query: PeriodQuery | Periodo) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<DespesasRelatorio>('/despesas/relatorio', periodParams(q))
}

export function fetchDespesasPeriodo(query: PeriodQuery | Periodo) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<DespesasPeriodo>('/despesas/periodo', {
    ...periodParams(q),
    limite: '30',
  })
}

export function fetchNotasPeriodo(
  query: PeriodQuery | Periodo,
  marketplace?: string,
  pagina = 1,
) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<NotasPeriodo>('/notas-fiscais/periodo', {
    ...periodParams(q, marketplace),
    pagina: String(pagina),
    limite: '50',
  })
}

export function fetchFretesPeriodo(query: PeriodQuery | Periodo) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<FretesPeriodo>('/fretes/periodo', {
    ...periodParams(q),
    limite: '50',
  })
}

export type FretesPedidos = {
  periodo: { inicio: string; fim: string; label: string }
  marketplace?: string | null
  fretes: Array<{
    pedido_id?: string
    canal?: string
    data?: string
    status?: string
    shipping_id?: string
    receita?: number
    frete?: number
  }>
  resumo?: {
    pedidos?: number
    pedidosComFrete?: number
    totalFrete?: number
    totalReceita?: number
    total_frete_fmt?: string
    porCanal?: Array<{ canal?: string; pedidos?: number; frete?: number }>
  }
  paginacao?: { pagina?: number; limite?: number; total?: number; pages?: number }
  fonte?: string
}

export function fetchFretesPedidos(
  query: PeriodQuery | Periodo,
  marketplace?: string,
  pagina = 1,
  limite = 50,
) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<FretesPedidos>('/fretes/pedidos', {
    ...periodParams(q, marketplace),
    pagina: String(pagina),
    limite: String(limite),
  })
}

export function fetchMargensLista(query: PeriodQuery | Periodo, marketplace?: string) {
  const q = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<MargensLista>('/margens/lista', {
    ...periodParams(q, marketplace),
    limite: '30',
  })
}

/** Usa `/margens/periodo` (canónico). Alias `/margens/estatisticas` no bridge aponta para o mesmo. */
export async function fetchMargensEstatisticas(
  query: PeriodQuery | Periodo,
  marketplace?: string,
): Promise<MargensEstatisticas> {
  const raw = await fetchMargens(query, marketplace)
  return {
    periodo: raw.periodo,
    estatisticas: raw.margem || {},
  }
}

export function fetchClientesRelatorio() {
  return bridgeGet<ClientesRelatorio>('/clientes/relatorio', periodParams({}))
}

export function fmtIsoDate(iso?: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return String(iso).slice(0, 10)
  }
}

/* --- Fase C: pedidos + operações --- */

export type PedidoListItem = {
  _id?: string
  marketplace_id?: string
  marketplace_name?: string
  order_status?: string
  order_date?: string
  order_revenue?: number
  marketplace_fees?: number
  marketplace_shipping_cost?: number
  order_products?: Array<{
    descricao_produto?: string
    quantidade?: number
    preco_total?: number
  }>
}

export type PedidosLista = {
  periodo: { inicio: string; fim: string; label: string }
  marketplace: string | null
  pedidos: PedidoListItem[]
  paginacao?: {
    pagina?: number
    limite?: number
    total?: number
    totalPaginas?: number
    hasNextPage?: boolean
    hasPrevPage?: boolean
  }
}

export type PedidoDetalhe = {
  pedido: PedidoListItem & Record<string, unknown>
}

export type OrigemStats = {
  origem: {
    hoje?: number
    por_marketplace?: Array<{ marketplace?: string; total?: number }>
    por_status?: Array<{ status_pedido?: string; total?: number }>
  }
}

export type OrigemPedidos = {
  pedidos:
    | {
        data?: Array<{
          id?: string
          id_pedido?: string
          marketplace?: string
          status_pedido?: string
          data_venda?: string
          nome_produto?: string
          valor?: number
          quantidade?: number
        }>
      }
    | Array<Record<string, unknown>>
}

export function fetchPedidosLista(
  query: PeriodQuery | Periodo,
  marketplace?: string,
  opts?: {
    pagina?: number
    limite?: number
    order_status?: string
    marketplace_id?: string
    /** Se true, não envia datas — útil para achar pedido por ID fora do período do filtro */
    semPeriodo?: boolean
  },
) {
  const q = typeof query === 'string' ? { periodo: query } : query
  const params: Record<string, string> = {
    pagina: String(opts?.pagina ?? 1),
    limite: String(opts?.limite ?? 30),
  }
  if (!opts?.semPeriodo) {
    Object.assign(params, periodParams(q, marketplace))
  } else if (marketplace) {
    params.marketplace = marketplace
  }
  if (opts?.order_status) params.order_status = opts.order_status
  if (opts?.marketplace_id) params.marketplace_id = opts.marketplace_id
  return bridgeGet<PedidosLista>('/pedidos', params)
}

export function fetchPedidoDetalhe(id: string) {
  return bridgeGet<PedidoDetalhe>(`/pedidos/${encodeURIComponent(id)}`)
}

export type ProdutoDetalhe = {
  sku: string
  catalog_sku?: string
  listing_id?: string | null
  resolved_from?: string | null
  produto: Record<string, unknown> | null
  cmv?: Record<string, unknown> | null
}

export type PagamentosLista = {
  periodo?: { inicio?: string; fim?: string; label?: string }
  pagamentos: Array<Record<string, unknown>>
  paginacao?: {
    page?: number
    limit?: number
    total?: number
    pages?: number
  }
}

export function fetchProdutoPorSku(sku: string) {
  return bridgeGet<ProdutoDetalhe>(`/produtos/sku/${encodeURIComponent(sku)}`)
}

export type ProdutosLista = {
  produtos: Array<Record<string, unknown>>
  paginacao?: {
    pagina?: number
    limite?: number
    total?: number
    totalPaginas?: number
    hasNextPage?: boolean
    hasPrevPage?: boolean
  }
}

export function fetchProdutosLista(opts?: {
  pagina?: number
  limite?: number
  q?: string
  sku?: string
  categoria?: string
}) {
  const params: Record<string, string> = {
    pagina: String(opts?.pagina ?? 1),
    limite: String(opts?.limite ?? 25),
  }
  if (opts?.q) params.q = opts.q
  if (opts?.sku) params.sku = opts.sku
  if (opts?.categoria) params.categoria = opts.categoria
  return bridgeGet<ProdutosLista>('/produtos', params)
}

export type ProdutosVendidos = {
  periodo: { inicio: string; fim: string; label: string }
  marketplace?: string | null
  produtos: Array<{
    product_id?: string
    descricao?: string
    canais?: string[]
    quantidade?: number
    receita?: number
    pedidos?: number
    ticket_medio?: number
  }>
  resumo?: {
    total_produtos?: number
    receita_total?: number
    quantidade_total?: number
    receita_total_fmt?: string
  }
  paginacao?: { pagina?: number; limite?: number; total?: number; pages?: number }
  fonte?: string
}

export function fetchProdutosVendidos(
  query: PeriodQuery | Periodo,
  marketplace?: string,
  opts?: { pagina?: number; limite?: number; busca?: string; ordenarPor?: 'receita' | 'quantidade' },
) {
  const q = typeof query === 'string' ? { periodo: query } : query
  const params: Record<string, string> = {
    ...periodParams(q, marketplace),
    pagina: String(opts?.pagina ?? 1),
    limite: String(opts?.limite ?? 30),
  }
  if (opts?.busca) params.busca = opts.busca
  if (opts?.ordenarPor) params.ordenar_por = opts.ordenarPor
  return bridgeGet<ProdutosVendidos>('/produtos/vendidos', params)
}

export type BridgeHealth = {
  ok?: boolean
  service?: string
  version?: string
  date?: string
  s1_configured?: boolean
  hermes_bin?: boolean
  stt_configured?: boolean
}

export function fetchBridgeHealth() {
  return bridgeGet<BridgeHealth>('/health')
}

export function fetchPagamentos(
  query: PeriodQuery | Periodo,
  opts?: { pagina?: number; limite?: number; status?: string },
) {
  const q = typeof query === 'string' ? { periodo: query } : query
  const params: Record<string, string> = {
    ...periodParams(q),
    pagina: String(opts?.pagina ?? 1),
    limite: String(opts?.limite ?? 30),
  }
  if (opts?.status) params.status = opts.status
  return bridgeGet<PagamentosLista>('/pagamentos', params)
}

export function fetchOrigemStats() {
  return bridgeGet<OrigemStats>('/origem/stats')
}

export function fetchOrigemPedidos(opts?: {
  per_page?: number
  marketplace?: string
  dataInicio?: string
  dataFim?: string
}) {
  const params: Record<string, string> = {
    page: '1',
    per_page: String(opts?.per_page ?? 15),
  }
  if (opts?.marketplace) params.marketplace = opts.marketplace
  if (opts?.dataInicio) params.data_inicio = opts.dataInicio
  if (opts?.dataFim) params.data_fim = opts.dataFim
  return bridgeGet<OrigemPedidos>('/origem/pedidos', params)
}

export type FiscalConciliacao = {
  periodo?: { inicio?: string; fim?: string; label?: string }
  summaries?: Array<{
    hub?: string
    label?: string
    hub_label?: string
    matched?: number
    sem_nf?: number
    nf_orfa?: number
    pedidos?: number
    [key: string]: unknown
  }>
  marketplace?: string | null
  escopo?: {
    pedidos?: string
    nfs?: string
    nf_orfa_confiavel?: boolean
    nota?: string
  }
  s1_url?: string
  ok?: boolean
  error?: string
  message?: string
}

export function fetchFiscalConciliacao(query: PeriodQuery | Periodo, marketplace?: string) {
  const q: PeriodQuery = typeof query === 'string' ? { periodo: query } : query
  return bridgeGet<FiscalConciliacao>('/fiscal/conciliacao', periodParams(q, marketplace))
}

export const S2_APP_URL =
  (import.meta.env.VITE_S2_APP_URL as string) || 'https://fiestaup.toteus.cloud'
export const S1_APP_URL =
  (import.meta.env.VITE_S1_APP_URL as string) || 'https://api.fiestaup.toteus.cloud'
