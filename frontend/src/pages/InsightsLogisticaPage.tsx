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
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchFretesPedidos,
  fetchMetricas,
  fetchOpsAlerts,
  fetchPedidosLista,
  fmtBrl,
  type FretesPedidos,
  type OpsAlertsPayload,
  type PedidoListItem,
  type PedidosMetricas,
} from '../api/bridge'

/** S2 `/pedidos` rejeita limite > 100 (400) — amostra de status fica neste teto. */
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

function shortLabel(text: string, max = 28): string {
  const t = (text || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
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

function LogisticaKpi({ label, value, hint, spark, icon, color, progress }: KpiSparkProps) {
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

/** Insights · Logística (pág.19) — fretes/status marketplace, não expedição industrial. */
export function InsightsLogisticaPage() {
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

  const [fretes, setFretes] = useState<FretesPedidos | null>(null)
  const [metricas, setMetricas] = useState<PedidosMetricas | null>(null)
  const [ops, setOps] = useState<OpsAlertsPayload | null>(null)
  const [statusSample, setStatusSample] = useState<PedidoListItem[]>([])
  const [statusTotal, setStatusTotal] = useState<number | null>(null)
  const [extraLoading, setExtraLoading] = useState(true)
  const [extraError, setExtraError] = useState<string | null>(null)

  const loadExtra = useCallback(() => {
    setExtraLoading(true)
    setExtraError(null)
    Promise.all([
      fetchFretesPedidos(periodQuery, marketplace || undefined, 1, 200).catch(() => null),
      fetchMetricas(periodQuery, marketplace || undefined).catch(() => null),
      fetchOpsAlerts(periodQuery, marketplace || undefined).catch(() => null),
      fetchPedidosLista(periodQuery, marketplace || undefined, {
        pagina: 1,
        limite: STATUS_SAMPLE,
      }).catch(() => null),
    ])
      .then(([f, m, alerts, pedidos]) => {
        setFretes(f)
        setMetricas(m)
        setOps(alerts)
        if (pedidos) {
          setStatusSample(pedidos.pedidos || [])
          setStatusTotal(pedidos.paginacao?.total ?? pedidos.pedidos?.length ?? null)
        } else {
          setStatusSample([])
          setStatusTotal(null)
        }
        if (!f && !m && !alerts && !pedidos) {
          setExtraError('Falha ao carregar logística.')
        }
      })
      .finally(() => setExtraLoading(false))
  }, [periodQuery, marketplace, activeSourceId])

  useEffect(() => {
    loadExtra()
  }, [loadExtra])

  const rows = fretes?.fretes || []
  const freteMetricas = Number(
    metricas?.metricas?.totalFrete ?? data?.frete ?? 0,
  )
  const receitaMetricas = Number(
    metricas?.metricas?.totalReceita ?? metricas?.total_receita ?? data?.vendas ?? 0,
  )
  const liquidoMetricas = Number(
    metricas?.metricas?.totalLiquido ?? metricas?.total_liquido ?? data?.liquido ?? 0,
  )
  const pedidosTotal = Number(metricas?.total_pedidos ?? data?.pedidos ?? statusTotal ?? 0)

  const freteSobreReceita =
    receitaMetricas > 0 ? Math.round((1000 * freteMetricas) / receitaMetricas) / 10 : null
  const freteSobreLiquido =
    liquidoMetricas > 0 ? Math.round((1000 * freteMetricas) / liquidoMetricas) / 10 : null
  const freteMedio = pedidosTotal > 0 ? freteMetricas / pedidosTotal : 0

  const gapSemNf = Number(ops?.margin_gap?.sem_nf || 0)
  const gapPorCanal = ops?.margin_gap?.sem_nf_por_canal || {}

  const sparkFrete = useMemo(() => {
    if (!data?.daily?.length || !data.vendas) return []
    const ratio = freteMetricas > 0 && data.vendas > 0 ? freteMetricas / data.vendas : 0.08
    return data.daily.map((d) => d.valor * ratio)
  }, [data, freteMetricas])

  const sparkPedidos = useMemo(() => (data?.daily || []).map((d) => d.pedidos), [data?.daily])

  const statusBars = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of statusSample) {
      const label = labelStatus(String(p.order_status || ''))
      counts.set(label, (counts.get(label) || 0) + 1)
    }
    const ordered = PIPELINE_ORDER.filter((name) => (counts.get(name) || 0) > 0).map((name) => ({
      name,
      total: counts.get(name) || 0,
      fill:
        name === 'Enviado' || name === 'Concluído'
          ? theme.palette.success.main
          : name === 'Cancelado' || name === 'Reembolso'
            ? theme.palette.error.main
            : name === 'Pendente'
              ? theme.palette.warning.main
              : chart.pie[PIPELINE_ORDER.indexOf(name) % chart.pie.length] || chart.line,
    }))
    const extra = [...counts.entries()]
      .filter(([name]) => !PIPELINE_ORDER.includes(name))
      .map(([name, total], i) => ({
        name,
        total,
        fill: chart.pie[(i + 3) % chart.pie.length] || chart.line,
      }))
    return [...ordered, ...extra]
  }, [statusSample, theme, chart])

  const statusAmostra = statusBars.reduce((s, b) => s + b.total, 0)
  const statusTotalSample = statusAmostra || 1
  const enviados = statusBars
    .filter((s) => s.name === 'Enviado' || s.name === 'Concluído')
    .reduce((s, b) => s + b.total, 0)
  const cancelados = statusBars
    .filter((s) => s.name === 'Cancelado' || s.name === 'Reembolso')
    .reduce((s, b) => s + b.total, 0)
  const emTransito = statusBars.find((s) => s.name === 'Enviado')?.total || 0
  const semOcorrenciaPct = Math.round((100 * (statusTotalSample - cancelados)) / statusTotalSample)

  const canalBars = useMemo((): Array<{ name: string; total: number; kind: string }> => {
    const fromGap = Object.entries(gapPorCanal)
      .map(([name, total]) => ({ name, total: Number(total || 0), kind: 'gap' }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
    if (fromGap.length) return fromGap

    return [...(data?.canais || [])]
      .sort((a, b) => b.pedidos - a.pedidos)
      .slice(0, 8)
      .map((c) => ({ name: c.name, total: c.pedidos, kind: 'pedidos' }))
  }, [gapPorCanal, data?.canais])

  const faixasBars = useMemo(() => {
    const buckets = [
      { name: '< R$15', min: 0, max: 15, total: 0 },
      { name: '15–30', min: 15, max: 30, total: 0 },
      { name: '30–60', min: 30, max: 60, total: 0 },
      { name: '60–100', min: 60, max: 100, total: 0 },
      { name: '≥100', min: 100, max: Infinity, total: 0 },
    ]
    for (const r of rows) {
      // ML grava o frete como débito (negativo): a faixa é sempre o custo absoluto.
      const c = Math.abs(Number(r.frete || 0))
      if (c <= 0) continue
      const b = buckets.find((x) => c >= x.min && c < x.max)
      if (b) b.total += 1
    }
    return buckets.filter((b) => b.total > 0).map(({ name, total }) => ({ name, total }))
  }, [rows])

  const ocorrencias = useMemo(() => {
    const items: Array<{ label: string; qtde: number; impacto: 'Alto' | 'Médio' | 'Baixo' }> = []
    if (gapSemNf > 0) {
      items.push({
        label: 'Pedidos sem NF',
        qtde: gapSemNf,
        impacto: gapSemNf >= 20 ? 'Alto' : gapSemNf >= 5 ? 'Médio' : 'Baixo',
      })
    }
    if (cancelados > 0) {
      items.push({
        label: 'Cancelados / reembolsos',
        qtde: cancelados,
        impacto: cancelados / statusTotalSample >= 0.15 ? 'Alto' : 'Médio',
      })
    }
    const freteAlto = rows.filter((r) => Math.abs(Number(r.frete || 0)) >= 60).length
    if (freteAlto > 0) {
      items.push({
        label: 'Fretes ≥ R$60',
        qtde: freteAlto,
        impacto: freteAlto >= 8 ? 'Alto' : 'Médio',
      })
    }
    if (freteSobreReceita != null && freteSobreReceita >= 12) {
      items.push({
        label: 'Frete alto na receita',
        qtde: Math.round(freteSobreReceita),
        impacto: freteSobreReceita >= 18 ? 'Alto' : 'Médio',
      })
    }
    for (const a of (ops?.alerts || []).filter((x) =>
      /frete|ship|envio|nf|sync|upseller/i.test(`${x.code} ${x.title}`),
    ).slice(0, 2)) {
      items.push({
        label: a.title,
        qtde: 1,
        impacto: a.severity === 'error' ? 'Alto' : a.severity === 'warning' ? 'Médio' : 'Baixo',
      })
    }
    return items.slice(0, 6)
  }, [gapSemNf, cancelados, statusTotalSample, rows, freteSobreReceita, ops?.alerts])

  const topCanaisFrete = useMemo(() => {
    const list = [...(data?.canais || [])].sort((a, b) => b.value - a.value).slice(0, 5)
    const max = list[0]?.pedidos || 1
    return list.map((c) => {
      const sharePed = Math.round((100 * c.pedidos) / max)
      const estFrete = pedidosTotal > 0 ? (c.pedidos / pedidosTotal) * freteMetricas : 0
      return {
        name: c.name,
        pedidos: c.pedidos,
        sharePed,
        estFrete,
        risco: gapPorCanal[c.name] ? Number(gapPorCanal[c.name]) : 0,
      }
    })
  }, [data?.canais, pedidosTotal, freteMetricas, gapPorCanal])

  const riscoPedidos = useMemo(() => {
    const fromFretes = [...rows]
      .filter((r) => Math.abs(Number(r.frete || 0)) > 0)
      .sort((a, b) => Math.abs(Number(b.frete || 0)) - Math.abs(Number(a.frete || 0)))
      .slice(0, 5)
      .map((r) => {
        const custo = Math.abs(Number(r.frete || 0))
        const id = String(r.pedido_id || r.shipping_id || '—')
        return {
          id: shortLabel(id, 20),
          full: id,
          detalhe: [r.canal, r.data ? String(r.data).slice(0, 10) : null]
            .filter(Boolean)
            .join(' · ') || 'Frete por pedido',
          valor: custo,
          risco: (custo >= 100 ? 'Alto' : custo >= 60 ? 'Médio' : 'Baixo') as 'Alto' | 'Médio' | 'Baixo',
        }
      })
    if (fromFretes.length) return fromFretes

    return [...statusSample]
      .filter((p) => {
        const st = labelStatus(String(p.order_status || ''))
        return st === 'Pendente' || st === 'Pago'
      })
      .sort((a, b) => Number(b.order_revenue || 0) - Number(a.order_revenue || 0))
      .slice(0, 5)
      .map((p) => {
        const id = String(p.marketplace_id || p._id || '—')
        const st = labelStatus(String(p.order_status || ''))
        return {
          id: shortLabel(id, 20),
          full: id,
          detalhe: `${p.marketplace_name || 'Canal'} · ${st}`,
          valor: Number(p.order_revenue || 0),
          risco: (st === 'Pendente' ? 'Médio' : 'Baixo') as 'Alto' | 'Médio' | 'Baixo',
        }
      })
  }, [rows, statusSample])

  const insightPrincipal = useMemo(() => {
    const topGap = Object.entries(gapPorCanal).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
    if (topGap && Number(topGap[1]) > 0) {
      return {
        title: `Gaps sem NF concentrados em ${topGap[0]}`,
        detail: `${topGap[1]} pedidos sem nota — impacto fiscal e liberação logística.`,
      }
    }
    if (freteSobreReceita != null && freteSobreReceita >= 12) {
      return {
        title: `Frete consome ${freteSobreReceita}% da receita`,
        detail: 'Revisar faixas caras e canais com ticket baixo vs frete.',
      }
    }
    if (cancelados / statusTotalSample >= 0.12) {
      return {
        title: 'Cancelamentos elevados na amostra de status',
        detail: 'Investigar ruptura, prazo de envio e frete nos cancelados.',
      }
    }
    return {
      title: 'Logística estável neste snapshot',
      detail: 'Manter acompanhamento de frete no líquido e status de envio.',
    }
  }, [gapPorCanal, freteSobreReceita, cancelados, statusTotalSample])

  const recommendations = useMemo(
    () =>
      [
        {
          title: gapSemNf > 0 ? `Fechar ${Math.min(gapSemNf, 20)} gaps sem NF` : 'Auditar NF × envio',
          detail: 'Pedidos sem nota travam a leitura fiscal e o pós-venda.',
          to: '/fiscal',
        },
        {
          title: 'Revisar faixas de frete caras',
          detail: 'Priorizar custos ≥ R$60 na amostra S2.',
          to: '/fretes',
        },
        {
          title: 'Acelerar pedidos em trânsito',
          detail: emTransito
            ? `${emTransito} enviados na amostra — cruzar com NF e cliente.`
            : 'Acompanhar status Enviado/Pago no funil de pedidos.',
          to: '/pedidos',
        },
      ] as const,
    [gapSemNf, emTransito],
  )

  const impactoColor = (i: 'Alto' | 'Médio' | 'Baixo') =>
    i === 'Alto'
      ? theme.palette.error.main
      : i === 'Médio'
        ? theme.palette.warning.main
        : theme.palette.success.main

  const loading = (dataLoading || extraLoading) && !data && !fretes
  const error = dataError || extraError
  const onRetry = () => {
    refresh()
    loadExtra()
  }

  return (
    <DomainPageShell
      title="Logística"
      subtitle="Logística inteligente · frete, status de envio e gaps NF"
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
            Logística marketplace
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Frete no líquido e funil de envio — não OTIF/transportadoras industriais do PDF.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" onClick={onRetry} disabled={dataLoading || extraLoading} sx={{ textTransform: 'none' }}>
            Atualizar
          </Button>
          <Link
            component={RouterLink}
            to="/fretes"
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
              label: 'Pedidos no período',
              value: String(pedidosTotal || 0),
              hint: deltaLabel(data?.deltaPedidosPct),
              spark: sparkPedidos,
              icon: 'bag' as const,
              color: theme.palette.primary.main,
            },
            {
              label: freteSobreLiquido != null ? 'Frete no líquido' : 'Frete na receita',
              value:
                freteSobreLiquido != null
                  ? `${freteSobreLiquido}%`
                  : freteSobreReceita != null
                    ? `${freteSobreReceita}%`
                    : '—',
              hint:
                freteSobreLiquido != null
                  ? `${freteSobreReceita ?? '—'}% da receita · ${fmtBrl(freteMetricas)}`
                  : `Sem líquido no período · ${fmtBrl(freteMetricas)} de frete`,
              spark: sparkFrete,
              icon: 'map' as const,
              color: theme.palette.warning.main,
              progress: freteSobreLiquido != null ? Math.min(100, freteSobreLiquido * 4) : undefined,
            },
            {
              label: 'Frete médio',
              value: freteMedio > 0 ? fmtBrl(freteMedio) : '—',
              hint: 'Custo médio por pedido (métricas)',
              spark: sparkFrete,
              icon: 'clock' as const,
              color: chart.line,
            },
            {
              label: 'Sem ocorrência*',
              value: statusAmostra > 0 ? `${semOcorrenciaPct}%` : '—',
              hint:
                statusAmostra > 0
                  ? `*Amostra ${statusAmostra} pedidos · não cancelado/reembolso`
                  : 'Sem amostra de status no período',
              spark: sparkPedidos,
              icon: 'document' as const,
              color: theme.palette.success.main,
              progress: statusAmostra > 0 ? semOcorrenciaPct : undefined,
            },
            {
              label: 'Gaps / alertas',
              value: String(gapSemNf + ocorrencias.filter((o) => o.label !== 'Pedidos sem NF').length),
              hint: gapSemNf ? `${gapSemNf} sem NF` : 'Snapshot operacional',
              spark: sparkPedidos,
              icon: 'report' as const,
              color: theme.palette.error.main,
            },
          ] as const
        ).map((k) => (
          <Box
            key={k.label}
            sx={{ flex: { xs: '1 1 calc(50% - 10px)', md: '1 1 0' }, minWidth: { md: 130 } }}
          >
            <LogisticaKpi {...k} />
          </Box>
        ))}
      </Stack>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {canalBars[0]?.kind === 'gap' ? 'Gaps sem NF · por canal' : 'Pedidos · por canal'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Em vez de “região de destino” (sem geo no bridge)
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                {canalBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={canalBars}
                      margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.palette.divider}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v) => [
                          Number(v),
                          canalBars[0]?.kind === 'gap' ? 'Sem NF' : 'Pedidos',
                        ]}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar
                        dataKey="total"
                        fill={
                          canalBars[0]?.kind === 'gap'
                            ? theme.palette.error.main
                            : theme.palette.primary.main
                        }
                        radius={[0, 6, 6, 0]}
                        maxBarSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem breakdown por canal." dense />
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
              dominio="logistica"
              fallback={{
                title: insightPrincipal.title,
                detail: enviados
                  ? `${insightPrincipal.detail} · ${enviados} enviados/concluídos na amostra (frete ${fmtBrl(freteMetricas)})`
                  : insightPrincipal.detail,
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
                Pedidos por status
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Funil de envio marketplace
                {statusTotal != null && statusSample.length < statusTotal
                  ? ` · amostra ${statusSample.length}/${statusTotal}`
                  : ''}
              </Typography>
              <Box sx={{ width: '100%', height: 220 }}>
                {statusBars.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={statusBars}
                        dataKey="total"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={84}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {statusBars.map((b) => (
                          <Cell key={b.name} fill={b.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [Number(v), 'Pedidos']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem status na amostra." dense />
                )}
              </Box>
              {statusBars.length ? (
                <Stack spacing={0.4}>
                  {statusBars.slice(0, 5).map((b) => (
                    <Stack key={b.name} direction="row" justifyContent="space-between">
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: b.fill }} />
                        <Typography variant="caption" color="text.secondary">
                          {b.name}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight={600}>
                        {b.total} · {Math.round((100 * b.total) / statusTotalSample)}%
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : null}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Faixas de frete
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Em vez de prazo de entrega (sem timestamps OTIF) — histograma de custo
              </Typography>
              <Box sx={{ width: '100%', height: 260 }}>
                {faixasBars.length ? (
                  <ResponsiveContainer>
                    <BarChart data={faixasBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                      />
                      <Tooltip
                        formatter={(v) => [Number(v), 'Fretes']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar
                        dataKey="total"
                        fill={chart.pie[2] || chart.line}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem custos de frete na amostra S2." dense />
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
                Ocorrências mais frequentes
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                Gaps NF, cancelamentos e frete caro
              </Typography>
              {ocorrencias.length ? (
                <Stack spacing={1}>
                  {ocorrencias.map((o) => (
                    <Stack
                      key={o.label}
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
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {o.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Qtde {o.qtde}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={o.impacto}
                        sx={{
                          bgcolor: alpha(impactoColor(o.impacto), 0.12),
                          color: impactoColor(o.impacto),
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <ChartEmpty title="Sem ocorrências relevantes neste snapshot." dense />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top canais · frete estimado
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                Em vez de transportadoras OTIF — rateio por volume de pedidos
              </Typography>
              {topCanaisFrete.length ? (
                <Stack spacing={1.15}>
                  {topCanaisFrete.map((c) => (
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
                          {fmtBrl(c.estFrete)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.35 }}>
                        <Typography variant="caption" color="text.secondary">
                          {c.pedidos} ped.
                          {c.risco ? ` · ${c.risco} sem NF` : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {c.sharePed}% do topo
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={c.sharePed}
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
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Pedidos com risco
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Frete alto ou ainda no funil
              </Typography>
              {riscoPedidos.length ? (
                <Stack spacing={0.85}>
                  {riscoPedidos.map((r) => (
                    <Stack key={r.full} direction="row" spacing={1} alignItems="center">
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {r.id}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap display="block">
                          {r.detalhe}
                        </Typography>
                      </Box>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
                      >
                        {fmtBrl(r.valor)}
                      </Typography>
                      <Chip
                        size="small"
                        label={r.risco}
                        sx={{
                          flexShrink: 0,
                          bgcolor: alpha(impactoColor(r.risco), 0.12),
                          color: impactoColor(r.risco),
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <ChartEmpty title="Sem pedidos de risco na amostra." dense />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </DomainPageShell>
  )
}
