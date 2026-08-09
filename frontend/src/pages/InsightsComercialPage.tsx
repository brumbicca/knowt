import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Link,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AiInsightPanel } from '../components/AiInsightPanel'
import { ChartEmpty } from '../components/ChartEmpty'
import { DomainPageShell } from '../components/DomainPageShell'
import { Hicon, type HiconName } from '../components/Hicon'
import { Sparkline } from '../components/Sparkline'
import { StatusFunnel } from '../components/StatusFunnel'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchClientesRelatorio,
  fetchPedidosLista,
  fmtBrl,
  type PedidoListItem,
} from '../api/bridge'

/** S2 `/pedidos` rejeita limite > 100 (400) — amostra do funil fica neste teto. */
const STATUS_SAMPLE = 100

const PIPELINE_ORDER = ['Pendente', 'Pago', 'Enviado', 'Concluído', 'Reembolso', 'Cancelado', 'Sem status']

function labelStatus(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return 'Sem status'
  const low = s.toLowerCase()
  if (low.includes('cancel')) return 'Cancelado'
  if (low.includes('paid') || low === 'pago' || low.includes('payment_approved')) return 'Pago'
  if (low.includes('ship') || low.includes('enviad') || low.includes('deliver')) return 'Enviado'
  if (low.includes('pending') || low.includes('pendente') || low.includes('unpaid')) return 'Pendente'
  if (low.includes('refund') || low.includes('reembols')) return 'Reembolso'
  if (low.includes('completed') || low.includes('conclu')) return 'Concluído'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function deltaLabel(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return 'vs período anterior'
  const sign = pct > 0 ? '↑' : pct < 0 ? '↓' : '→'
  return `${sign} ${Math.abs(pct).toFixed(1)}% vs período anterior`
}

function fmtAxis(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

function shortId(p: PedidoListItem): string {
  const id = String(p.marketplace_id || p._id || '—')
  return id.length > 18 ? `${id.slice(0, 16)}…` : id
}

type KpiSparkProps = {
  label: string
  value: string
  hint: string
  spark: number[]
  icon: HiconName
  color: string
  progress?: number
}

function ComercialKpi({ label, value, hint, spark, icon, color, progress }: KpiSparkProps) {
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(color, 0.28),
        bgcolor: alpha(color, 0.04),
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(color, 0.18),
              color,
            }}
          >
            <Hicon name={icon} sx={{ fontSize: '0.95rem' }} />
          </Box>
          <Typography
            variant="caption"
            fontWeight={700}
            letterSpacing={0.05}
            sx={{ textTransform: 'uppercase', color, lineHeight: 1.2 }}
          >
            {label}
          </Typography>
        </Stack>
        <Typography
          sx={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            fontSize: '1.35rem',
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {hint}
        </Typography>
        {progress != null ? (
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, progress))}
            sx={{
              mt: 1,
              height: 7,
              borderRadius: 999,
              bgcolor: alpha(color, 0.12),
              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 999 },
            }}
          />
        ) : (
          <Sparkline values={spark} color={color} height={28} />
        )}
      </CardContent>
    </Card>
  )
}

/** Insights · Comercial inteligente (pág.16) — funil marketplace, não CRM BelloCopo. */
export function InsightsComercialPage() {
  const theme = useTheme()
  const chart = theme.chart
  const {
    data,
    loading: dataLoading,
    error: dataError,
    refresh,
    periodQuery,
    marketplace,
  } = useBiData()
  const { activeSourceId } = useBiSource()

  const [statusSample, setStatusSample] = useState<PedidoListItem[]>([])
  const [statusTotal, setStatusTotal] = useState<number | null>(null)
  const [clientesTotal, setClientesTotal] = useState(0)
  const [clientesEstado, setClientesEstado] = useState<Array<{ name: string; total: number }>>([])
  const [extraLoading, setExtraLoading] = useState(true)
  const [extraError, setExtraError] = useState<string | null>(null)

  const loadExtra = useCallback(() => {
    setExtraLoading(true)
    setExtraError(null)
    Promise.all([
      fetchPedidosLista(periodQuery, marketplace || undefined, {
        pagina: 1,
        limite: STATUS_SAMPLE,
      }).catch(() => null),
      fetchClientesRelatorio().catch(() => null),
    ])
      .then(([pedidos, clientes]) => {
        if (pedidos) {
          setStatusSample(pedidos.pedidos || [])
          setStatusTotal(pedidos.paginacao?.total ?? pedidos.pedidos?.length ?? null)
        } else {
          setStatusSample([])
          setStatusTotal(null)
        }
        const r = clientes?.relatorio
        setClientesTotal(Number(r?.totalClientes || 0))
        const estados = Object.entries(r?.clientesPorEstado || {})
          .map(([name, total]) => ({ name, total: Number(total || 0) }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 6)
        setClientesEstado(estados)
        if (!pedidos && !clientes) setExtraError('Falha ao carregar amostra comercial.')
      })
      .finally(() => setExtraLoading(false))
  }, [periodQuery, marketplace, activeSourceId])

  useEffect(() => {
    loadExtra()
  }, [loadExtra])

  const sparkVendas = useMemo(() => (data?.daily || []).map((d) => d.valor), [data?.daily])
  const sparkPedidos = useMemo(() => (data?.daily || []).map((d) => d.pedidos), [data?.daily])
  const sparkLiquido = useMemo(() => {
    if (!data?.daily?.length || !data.vendas) return []
    const ratio = data.liquido / data.vendas
    return data.daily.map((d) => d.valor * ratio)
  }, [data])

  const statusBars = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of statusSample) {
      const label = labelStatus(String(p.order_status || ''))
      counts.set(label, (counts.get(label) || 0) + 1)
    }
    return PIPELINE_ORDER.filter((name) => (counts.get(name) || 0) > 0)
      .map((name) => ({ name, total: counts.get(name) || 0 }))
      .concat(
        [...counts.entries()]
          .filter(([name]) => !PIPELINE_ORDER.includes(name))
          .map(([name, total]) => ({ name, total })),
      )
  }, [statusSample])

  const conversionBars = useMemo(() => {
    if (statusBars.length < 2) {
      return statusBars.map((s) => ({ name: s.name, taxa: 100 }))
    }
    const max = Math.max(...statusBars.map((s) => s.total), 1)
    return statusBars.map((s) => ({
      name: s.name,
      taxa: Math.round((100 * s.total) / max),
    }))
  }, [statusBars])

  const receitaSerie = useMemo(
    () =>
      (data?.daily || []).map((d) => ({
        dia: d.dia,
        receita: d.valor,
        pedidos: d.pedidos,
      })),
    [data?.daily],
  )

  const openPipeline = useMemo(() => {
    return statusBars
      .filter((s) => !['Cancelado', 'Reembolso', 'Concluído'].includes(s.name))
      .reduce((sum, s) => sum + s.total, 0)
  }, [statusBars])

  const metaRef = data?.prevVendas != null && data.prevVendas > 0 ? data.prevVendas : null
  const realizado = data?.vendas || 0
  const atingimento =
    metaRef && metaRef > 0 ? Math.round((100 * realizado) / metaRef) : data?.deltaVendasPct != null
      ? Math.round(100 + data.deltaVendasPct)
      : null

  const canais = useMemo(() => {
    const list = [...(data?.canais || [])].sort((a, b) => b.value - a.value)
    const max = list[0]?.value || 1
    return list.slice(0, 6).map((c) => ({
      ...c,
      ticket: c.pedidos > 0 ? c.value / c.pedidos : 0,
      share: Math.round((100 * c.value) / max),
      conv: c.pedidos > 0 ? Math.round((100 * c.pedidos) / (statusTotal || data?.pedidos || c.pedidos)) : 0,
    }))
  }, [data?.canais, data?.pedidos, statusTotal])

  const topPedidos = useMemo(() => {
    return [...statusSample]
      .filter((p) => Number(p.order_revenue || 0) > 0)
      .sort((a, b) => Number(b.order_revenue || 0) - Number(a.order_revenue || 0))
      .slice(0, 5)
  }, [statusSample])

  const insights = useMemo(() => {
    const items: Array<{ title: string; detail: string }> = []
    const top = canais[0]
    const weak = [...canais].filter((c) => c.pedidos > 0).sort((a, b) => a.ticket - b.ticket)[0]
    const cancel = statusBars.find((s) => s.name === 'Cancelado')
    const pend = statusBars.find((s) => s.name === 'Pendente')
    const sampleN = statusSample.length || 1

    if (data?.deltaVendasPct != null && data.deltaVendasPct < -5) {
      items.push({
        title: 'Queda de receita no período',
        detail: `Receita ${data.deltaVendasPct.toFixed(1)}% vs referência — revisar canais e ticket.`,
      })
    } else if (top) {
      items.push({
        title: `${top.name} concentra o resultado`,
        detail: `${fmtBrl(top.value)} · ${top.pedidos} pedidos — diversificar reduz risco de canal.`,
      })
    }

    if (pend && pend.total / sampleN >= 0.25) {
      items.push({
        title: 'Fila de pedidos pendentes elevada',
        detail: `${pend.total} na amostra (${Math.round((100 * pend.total) / sampleN)}%) — acelerar pagamento/liberação.`,
      })
    }

    if (cancel && cancel.total / sampleN >= 0.1) {
      items.push({
        title: 'Cancelamentos acima do confortável',
        detail: `${cancel.total} cancelados na amostra — investigar ruptura e frete.`,
      })
    }

    if (weak && top && weak.name !== top.name && weak.ticket < top.ticket * 0.6) {
      items.push({
        title: `Ticket baixo em ${weak.name}`,
        detail: `Ticket ${fmtBrl(weak.ticket)} vs ${fmtBrl(top.ticket)} no líder — testar mix/preço.`,
      })
    }

    if (!items.length) {
      items.push({
        title: 'Operação comercial estável',
        detail: 'Sem anomalia forte no snapshot — manter ritmo de canais e funil.',
      })
    }

    return items.slice(0, 3)
  }, [canais, statusBars, statusSample.length, data])

  const recommendations = useMemo(() => {
    const recs: Array<{ title: string; detail: string; to: string }> = []
    const pend = statusBars.find((s) => s.name === 'Pendente')
    const highValue = topPedidos.filter((p) => {
      const st = labelStatus(String(p.order_status || ''))
      return st === 'Pendente' || st === 'Pago'
    }).length

    if (pend && pend.total > 0) {
      recs.push({
        title: `Priorizar ${Math.min(pend.total, 12)} pedidos no funil`,
        detail: 'Focar nos de maior valor ainda não concluídos.',
        to: '/insights/comercial',
      })
    }
    if (highValue > 0) {
      recs.push({
        title: 'Revisar abordagem nos pedidos críticos',
        detail: 'Acompanhar status e NF dos top valores da amostra.',
        to: '/insights/financeiro',
      })
    }
    if (clientesTotal > 0) {
      recs.push({
        title: `Explorar base de ${clientesTotal} clientes`,
        detail: 'Cruzar UF/tipo com campanhas de reativação nos Insights.',
        to: '/clientes',
      })
    } else {
      recs.push({
        title: 'Acompanhar desempenho por canal',
        detail: 'Abrir Comercial nos Insights para drill-down.',
        to: '/insights/comercial',
      })
    }
    return recs.slice(0, 3)
  }, [statusBars, topPedidos, clientesTotal])

  const loading = (dataLoading || extraLoading) && !data
  const error = dataError || extraError

  const onRetry = () => {
    refresh()
    loadExtra()
  }

  return (
    <DomainPageShell
      title="Comercial"
      subtitle="Comercial inteligente · funil de pedidos, canais e receita"
      loading={loading}
      error={error}
      onRetry={onRetry}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-end' }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography
            variant="overline"
            color="text.secondary"
            fontWeight={700}
            letterSpacing={0.1}
          >
            Comercial inteligente
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Funil por status de pedido · canais no lugar de vendedores · mesmo motor do knowt.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" onClick={onRetry} disabled={dataLoading || extraLoading} sx={{ textTransform: 'none' }}>
            Atualizar
          </Button>
          <Link
            component={RouterLink}
            to="/insights/comercial"
            underline="hover"
            fontWeight={600}
            sx={{ fontSize: '0.85rem' }}
          >
            Ver detalhes →
          </Link>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
        {(
          [
            {
              label: 'No funil',
              value: String(openPipeline || data?.pedidos || 0),
              hint: deltaLabel(data?.deltaPedidosPct),
              spark: sparkPedidos,
              icon: 'bag' as const,
              color: theme.palette.primary.main,
            },
            {
              label: 'Receita do período',
              value: data ? fmtBrl(data.vendas) : '—',
              hint: deltaLabel(data?.deltaVendasPct),
              spark: sparkVendas,
              icon: 'graph' as const,
              color: chart.line,
            },
            {
              label: 'Referência (ant.)',
              value: metaRef != null ? fmtBrl(metaRef) : '—',
              hint: 'Período anterior como meta base',
              spark: sparkVendas,
              icon: 'activity' as const,
              color: chart.pie[2] || theme.palette.info.main,
            },
            {
              label: 'Realizado',
              value: data ? fmtBrl(data.liquido) : '—',
              hint: 'Líquido após taxas/frete',
              spark: sparkLiquido,
              icon: 'wallet' as const,
              color: theme.palette.success.main,
            },
          ] as const
        ).map((k) => (
          <Box
            key={k.label}
            sx={{ flex: { xs: '1 1 calc(50% - 10px)', md: '1 1 0' }, minWidth: { md: 130 } }}
          >
            <ComercialKpi {...k} />
          </Box>
        ))}
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 0' }, minWidth: { md: 140 } }}>
          <ComercialKpi
            label="Atingimento"
            value={atingimento != null ? `${Math.min(atingimento, 999)}%` : '—'}
            hint={
              atingimento != null
                ? atingimento >= 100
                  ? 'Acima da referência'
                  : 'Abaixo da referência'
                : 'Sem base de comparação'
            }
            spark={sparkVendas}
            icon="percent"
            color={
              atingimento == null
                ? theme.palette.text.secondary
                : atingimento >= 95
                  ? theme.palette.success.main
                  : atingimento >= 80
                    ? theme.palette.warning.main
                    : theme.palette.error.main
            }
            progress={atingimento != null ? Math.min(100, atingimento) : undefined}
          />
        </Box>
      </Stack>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Receita no período
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Série diária · mesma fonte do knowt
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                {receitaSerie.length > 1 ? (
                  <ResponsiveContainer>
                    <AreaChart
                      data={receitaSerie}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="comercialReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chart.line} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={chart.line} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.palette.divider}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="dia"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={fmtAxis}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                      />
                      <Tooltip
                        formatter={(v) => [fmtBrl(Number(v)), 'Receita']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="receita"
                        stroke={chart.line}
                        fill="url(#comercialReceita)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem série diária neste período." dense />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: { xs: 'stretch', lg: 'flex-end' },
            }}
          >
            <AiInsightPanel
              dominio="comercial"
              fallback={{
                title: insights[0]?.title || 'Comercial sem desvio relevante',
                detail: insights[0]?.detail || 'Manter acompanhamento de canal, ticket e funil.',
                recommendations: recommendations.map((r) => ({
                  title: r.title,
                  detail: r.detail,
                  to: r.to,
                })),
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Funil de pedidos
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Status marketplace
                {statusTotal != null && statusSample.length < statusTotal
                  ? ` · amostra ${statusSample.length}/${statusTotal}`
                  : ''}
              </Typography>
              <StatusFunnel data={statusBars} height={260} />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Mix por etapa
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Participação relativa na amostra (máx. = 100%)
              </Typography>
              <Box sx={{ width: '100%', height: 260 }}>
                {conversionBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      data={conversionBars}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.palette.divider}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        height={48}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        unit="%"
                        width={40}
                      />
                      <Tooltip
                        formatter={(v) => [`${Number(v)}%`, 'Mix']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar
                        dataKey="taxa"
                        fill={theme.palette.primary.main}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem etapas na amostra." dense />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Desempenho por canal
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                Em vez de vendedores — marketplaces
              </Typography>
              {canais.length ? (
                <Stack spacing={1.25}>
                  {canais.map((c) => (
                    <Box key={c.name}>
                      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                        <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: '55%' }}>
                          {c.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {fmtBrl(c.value)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.35 }}>
                        <Typography variant="caption" color="text.secondary">
                          {c.pedidos} ped. · ticket {fmtBrl(c.ticket)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.share}% do topo
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={c.share}
                        sx={{
                          height: 7,
                          borderRadius: 999,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          '& .MuiLinearProgress-bar': {
                            bgcolor: theme.palette.primary.main,
                            borderRadius: 999,
                          },
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <ChartEmpty title="Sem canais neste período." dense />
              )}
              <Box sx={{ textAlign: 'center', mt: 1.5 }}>
                <Link
                  component={RouterLink}
                  to="/insights/comercial"
                  underline="hover"
                  fontWeight={600}
                  sx={{ fontSize: '0.85rem' }}
                >
                  Ver vendas por canal →
                </Link>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top pedidos
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                Maiores valores na amostra · status e receita
              </Typography>
              {topPedidos.length ? (
                <Stack spacing={1}>
                  {topPedidos.map((p, i) => {
                    const st = labelStatus(String(p.order_status || ''))
                    return (
                      <Stack
                        key={`${p.marketplace_id || p._id}-${i}`}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.default',
                        }}
                      >
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                            color: 'primary.main',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {shortId(p)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {p.marketplace_name || 'Canal'}
                          </Typography>
                        </Box>
                        <Chip size="small" label={st} variant="outlined" sx={{ flexShrink: 0 }} />
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          sx={{
                            flexShrink: 0,
                            minWidth: 72,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {fmtBrl(Number(p.order_revenue || 0))}
                        </Typography>
                      </Stack>
                    )
                  })}
                </Stack>
              ) : (
                <ChartEmpty title="Sem pedidos com receita na amostra." dense />
              )}
              <Box sx={{ textAlign: 'center', mt: 1.5 }}>
                <Link
                  component={RouterLink}
                  to="/insights/comercial"
                  underline="hover"
                  fontWeight={600}
                  sx={{ fontSize: '0.85rem' }}
                >
                  Ver todos os pedidos →
                </Link>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Clientes por UF
              </Typography>
              {clientesEstado.length ? (
                <Stack spacing={0.65}>
                  {clientesEstado.map((e) => (
                    <Stack key={e.name} direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        {e.name}
                      </Typography>
                      <Typography variant="caption" fontWeight={600}>
                        {e.total}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Sem breakdown de clientes (ou base vazia).
                </Typography>
              )}
              <Box sx={{ mt: 1 }}>
                <Link
                  component={RouterLink}
                  to="/clientes"
                  underline="hover"
                  fontWeight={600}
                  sx={{ fontSize: '0.8rem' }}
                >
                  Ver base de clientes →
                </Link>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </DomainPageShell>
  )
}
