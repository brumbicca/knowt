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
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchOpsAlerts,
  fmtBrl,
  type OpsAlert,
  type OpsAlertsPayload,
} from '../api/bridge'

type AlertCategory = 'Fiscal' | 'Margem' | 'Sync' | 'Operações' | 'Outros'

function categorize(alert: OpsAlert): AlertCategory {
  const blob = `${alert.code} ${alert.title} ${alert.detail}`.toLowerCase()
  if (/nf|fiscal|nota|invoice/.test(blob)) return 'Fiscal'
  if (/margem|cmv|cobertura|margin/.test(blob)) return 'Margem'
  if (/sync|upseller|token|oauth|beat/.test(blob)) return 'Sync'
  if (/loja|marketplace|pedido|oper/.test(blob)) return 'Operações'
  return 'Outros'
}

function severityRank(sev: OpsAlert['severity']): number {
  if (sev === 'error') return 0
  if (sev === 'warning') return 1
  return 2
}

function urgencyLabel(sev: OpsAlert['severity']): string {
  if (sev === 'error') return 'Crítica'
  if (sev === 'warning') return 'Alta'
  return 'Média'
}

function impactScore(
  alert: OpsAlert,
  ticketMedio: number,
  gapSemNf: number,
): number {
  const base = alert.severity === 'error' ? 90 : alert.severity === 'warning' ? 55 : 25
  const cat = categorize(alert)
  let boost = 0
  if (cat === 'Fiscal' && gapSemNf > 0 && ticketMedio > 0) {
    boost = Math.min(40, (gapSemNf * ticketMedio) / 1000)
  }
  if (cat === 'Margem') boost += 15
  if (cat === 'Sync') boost += 10
  return Math.min(100, Math.round(base + boost))
}

type SevCardProps = {
  label: string
  value: string
  hint: string
  icon: HiconName
  color: string
  cta: string
  to: string
  selected?: boolean
  onClick?: () => void
}

function SeverityKpi({
  label,
  value,
  hint,
  icon,
  color,
  cta,
  to,
  selected,
  onClick,
}: SevCardProps) {
  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: selected ? color : alpha(color, 0.28),
        bgcolor: alpha(color, selected ? 0.1 : 0.04),
        cursor: onClick ? 'pointer' : 'default',
        outline: selected ? `2px solid ${color}` : 'none',
        outlineOffset: -1,
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(color, 0.18),
              color,
            }}
          >
            <Hicon name={icon} sx={{ fontSize: '1rem' }} />
          </Box>
          <Typography
            variant="caption"
            fontWeight={700}
            letterSpacing={0.06}
            sx={{ textTransform: 'uppercase', color }}
          >
            {label}
          </Typography>
        </Stack>
        <Typography
          sx={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            fontSize: '1.5rem',
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {hint}
        </Typography>
        <Link
          component={RouterLink}
          to={to}
          underline="hover"
          fontWeight={600}
          onClick={(e) => e.stopPropagation()}
          sx={{ fontSize: '0.78rem', color, display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
        >
          {cta}
          <Hicon name="chevron-right" sx={{ fontSize: '0.85rem' }} />
        </Link>
      </CardContent>
    </Card>
  )
}

type FilterSev = 'all' | 'error' | 'warning' | 'info'

/** Insights · Alertas do dia (pág.13) — snapshot ops/alerts + gaps NF. */
export function InsightsAlertasPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { periodQuery, marketplace, data, loading: dataLoading } = useBiData()
  const { activeSourceId } = useBiSource()
  const [payload, setPayload] = useState<OpsAlertsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterSev>('all')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchOpsAlerts(periodQuery, marketplace || undefined)
      .then(setPayload)
      .catch((err: unknown) => {
        setPayload(null)
        setError(err instanceof Error ? err.message : 'Falha ao carregar alertas')
      })
      .finally(() => setLoading(false))
  }, [periodQuery, marketplace, activeSourceId])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  const alerts = payload?.alerts || []
  const coverage = payload?.margin_coverage
  const gap = payload?.margin_gap
  const ticketMedio = data && data.pedidos > 0 ? data.vendas / data.pedidos : 0
  const gapSemNf = Number(gap?.sem_nf || 0)

  const counts = useMemo(() => {
    let error = 0
    let warning = 0
    let info = 0
    for (const a of alerts) {
      if (a.severity === 'error') error += 1
      else if (a.severity === 'warning') warning += 1
      else info += 1
    }
    return { error, warning, info, total: alerts.length }
  }, [alerts])

  const impactoLabel =
    counts.error >= 3 || gapSemNf >= 20
      ? 'Alto'
      : counts.error >= 1 || counts.warning >= 3 || gapSemNf >= 5
        ? 'Médio'
        : counts.total || gapSemNf
          ? 'Baixo'
          : 'Ok'

  const impactoColor =
    impactoLabel === 'Alto'
      ? theme.palette.error.main
      : impactoLabel === 'Médio'
        ? theme.palette.warning.main
        : theme.palette.success.main

  const ranked = useMemo(() => {
    const rows = alerts.map((a) => ({
      alert: a,
      cat: categorize(a),
      score: impactScore(a, ticketMedio, gapSemNf),
    }))
    rows.sort((a, b) => b.score - a.score || severityRank(a.alert.severity) - severityRank(b.alert.severity))
    return rows
  }, [alerts, ticketMedio, gapSemNf])

  const filtered = useMemo(() => {
    if (filter === 'all') return ranked
    return ranked.filter((r) => r.alert.severity === filter)
  }, [ranked, filter])

  const categoryBars = useMemo(() => {
    const map = new Map<AlertCategory, number>()
    for (const a of alerts) {
      const c = categorize(a)
      map.set(c, (map.get(c) || 0) + 1)
    }
    if (gapSemNf > 0) map.set('Fiscal', (map.get('Fiscal') || 0) + 1)
    const colors: Record<AlertCategory, string> = {
      Fiscal: theme.palette.error.main,
      Margem: theme.palette.warning.main,
      Sync: chart.pie[1] || chart.line,
      Operações: chart.pie[2] || chart.fill,
      Outros: chart.pie[4] || theme.palette.text.secondary,
    }
    return [...map.entries()]
      .map(([name, total]) => ({ name, total, fill: colors[name] }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [alerts, gapSemNf, theme, chart])

  const gapCanalBars = useMemo(() => {
    const src = gap?.sem_nf_por_canal || {}
    return Object.entries(src)
      .map(([name, total]) => ({ name, total: Number(total || 0) }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [gap?.sem_nf_por_canal])

  const catTotal = categoryBars.reduce((s, c) => s + c.total, 0)

  return (
    <DomainPageShell
      title="Alertas"
      subtitle={
        payload?.periodo
          ? `Alertas do período · ${payload.periodo.inicio} → ${payload.periodo.fim}`
          : 'Alertas do dia · ops + gaps NF/margem'
      }
      loading={(loading || dataLoading) && !payload}
      error={error}
      onRetry={load}
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
            Alertas do dia
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Severidade, ranking por impacto e categorias — mesma fonte da Home / Operações.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" onClick={load} disabled={loading} sx={{ textTransform: 'none' }}>
            Atualizar
          </Button>
          <Link
            component={RouterLink}
            to="/operacoes"
            underline="hover"
            fontWeight={600}
            sx={{ fontSize: '0.85rem' }}
          >
            Ver detalhes →
          </Link>
        </Stack>
      </Stack>

      {coverage && coverage.pedidos > 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
          Cobertura CMV/NF: {coverage.margens_registros}/{coverage.pedidos}
          {coverage.cobertura_pct != null ? ` (${coverage.cobertura_pct}%)` : ''}
          {gapSemNf ? ` · ${gapSemNf} sem NF` : ''}
          {gap?.nf_sem_margem ? ` · ${gap.nf_sem_margem} NF sem margem` : ''}
          {gap?.upseller_stalled ? ' · UpSeller parado' : ''}
        </Typography>
      ) : null}

      <Stack
        direction="row"
        spacing={1.25}
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: 2 }}
      >
        {(
          [
            {
              id: 'error' as FilterSev,
              label: 'Críticos',
              value: String(counts.error),
              hint: 'Impactos imediatos no resultado',
              icon: 'report' as const,
              color: theme.palette.error.main,
              cta: 'Ver detalhes',
              to: '/fiscal',
            },
            {
              id: 'warning' as FilterSev,
              label: 'Atenção',
              value: String(counts.warning),
              hint: 'Acompanhar de perto',
              icon: 'activity' as const,
              color: theme.palette.warning.main,
              cta: 'Ver detalhes',
              to: '/insights/prioridades',
            },
            {
              id: 'info' as FilterSev,
              label: 'Informações',
              value: String(counts.info),
              hint: 'Atualizações importantes',
              icon: 'document' as const,
              color: chart.pie[5] || theme.palette.info.main,
              cta: 'Ver lista',
              to: '/operacoes',
            },
            {
              id: 'all' as FilterSev,
              label: 'Gaps NF',
              value: String(gapSemNf),
              hint:
                gapSemNf > 0 && ticketMedio > 0
                  ? `Impacto estimado ~ ${fmtBrl(gapSemNf * ticketMedio)}`
                  : 'Pedidos sem nota no período',
              icon: 'archive' as const,
              color: theme.palette.error.light,
              cta: 'Abrir Fiscal',
              to: '/fiscal',
            },
            {
              id: 'all' as FilterSev,
              label: 'Impacto total',
              value: impactoLabel,
              hint: 'Leitura geral do snapshot',
              icon: 'graph' as const,
              color: impactoColor,
              cta: 'Entenda o impacto',
              to: '/insights',
            },
          ] as const
        ).map((k, idx) => (
          <Box
            key={`${k.label}-${idx}`}
            sx={{
              flex: { xs: '1 1 calc(50% - 10px)', md: '1 1 0' },
              minWidth: { md: 140 },
            }}
          >
            <SeverityKpi
              label={k.label}
              value={k.value}
              hint={k.hint}
              icon={k.icon}
              color={k.color}
              cta={k.cta}
              to={k.to}
              selected={
                k.label === 'Críticos' || k.label === 'Atenção' || k.label === 'Informações'
                  ? filter === k.id
                  : false
              }
              onClick={
                k.label === 'Críticos' || k.label === 'Atenção' || k.label === 'Informações'
                  ? () => setFilter((prev) => (prev === k.id ? 'all' : k.id))
                  : undefined
              }
            />
          </Box>
        ))}
      </Stack>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={1}
                sx={{ mb: 1.5 }}
              >
                <Box>
                  <Typography variant="h6">Top alertas por impacto</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ordenado por severidade + peso fiscal/margem · clique nos KPIs para filtrar
                  </Typography>
                </Box>
                {filter !== 'all' ? (
                  <Chip
                    size="small"
                    label={`Filtro: ${filter === 'error' ? 'críticos' : filter === 'warning' ? 'atenção' : 'info'}`}
                    onDelete={() => setFilter('all')}
                  />
                ) : null}
              </Stack>

              {filtered.length ? (
                <Stack spacing={1.1}>
                  {filtered.slice(0, 10).map((row, i) => {
                    const sevColor =
                      row.alert.severity === 'error'
                        ? theme.palette.error.main
                        : row.alert.severity === 'warning'
                          ? theme.palette.warning.main
                          : chart.line
                    return (
                      <Stack
                        key={`${row.alert.code}-${row.alert.at || i}`}
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        alignItems={{ sm: 'center' }}
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
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: alpha(chart.line, 0.12),
                            color: 'primary.main',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {row.alert.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {row.alert.detail}
                          </Typography>
                        </Box>
                        <Chip size="small" label={row.cat} variant="outlined" sx={{ flexShrink: 0 }} />
                        <Box sx={{ width: { xs: '100%', sm: 100 }, flexShrink: 0 }}>
                          <LinearProgress
                            variant="determinate"
                            value={row.score}
                            sx={{
                              height: 8,
                              borderRadius: 999,
                              bgcolor: alpha(sevColor, 0.12),
                              '& .MuiLinearProgress-bar': {
                                bgcolor: sevColor,
                                borderRadius: 999,
                              },
                            }}
                          />
                        </Box>
                        <Chip
                          size="small"
                          label={urgencyLabel(row.alert.severity)}
                          color={
                            row.alert.severity === 'error'
                              ? 'error'
                              : row.alert.severity === 'warning'
                                ? 'warning'
                                : 'default'
                          }
                          variant="outlined"
                          sx={{ flexShrink: 0, minWidth: 72 }}
                        />
                      </Stack>
                    )
                  })}
                </Stack>
              ) : (
                <ChartEmpty
                  title={
                    loading
                      ? 'A carregar alertas…'
                      : filter !== 'all'
                        ? 'Sem alertas neste filtro.'
                        : 'Sem alertas no período — operação estável.'
                  }
                  dense
                />
              )}

              <Box sx={{ textAlign: 'center', mt: 1.5 }}>
                <Link
                  component={RouterLink}
                  to="/operacoes"
                  underline="hover"
                  fontWeight={600}
                  sx={{ fontSize: '0.85rem' }}
                >
                  Ver painel de Operações →
                </Link>
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
              dominio="operacoes"
              ctaTo="/insights/prioridades"
              fallback={{
                title:
                  gapSemNf > 0
                    ? `${gapSemNf} pedidos sem NF em aberto`
                    : 'Sem alerta crítico no período',
                detail:
                  'Leitura operacional do período — sync, cobertura de margem e gaps fiscais.',
                recommendations: [
                  {
                    title: 'Abrir conciliação fiscal',
                    detail: 'Ver pedidos sem nota por canal e fechar o gap.',
                    to: '/fiscal',
                  },
                  {
                    title: 'Rever operações',
                    detail: 'Status de sync, lojas e últimas execuções.',
                    to: '/operacoes',
                  },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Alertas por categoria
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Classificação por código/título · {catTotal} itens
              </Typography>
              <Box sx={{ width: '100%', height: 200 }}>
                {categoryBars.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={categoryBars}
                        dataKey="total"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {categoryBars.map((b) => (
                          <Cell key={b.name} fill={b.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [Number(value), 'Alertas']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem categorias neste snapshot." dense />
                )}
              </Box>
              {categoryBars.length ? (
                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                  {categoryBars.map((b) => (
                    <Stack
                      key={b.name}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: b.fill }} />
                        <Typography variant="caption" color="text.secondary">
                          {b.name}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight={600}>
                        {b.total}
                        {catTotal ? ` · ${Math.round((100 * b.total) / catTotal)}%` : ''}
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
                Gaps sem NF · por canal
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Em vez da série 7d (ainda sem histórico no bridge) — breakdown actual do gap fiscal
              </Typography>
              <Box sx={{ width: '100%', height: 220 }}>
                {gapCanalBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={gapCanalBars}
                      margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
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
                        width={88}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [Number(value), 'Sem NF']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar
                        dataKey="total"
                        fill={theme.palette.error.main}
                        radius={[0, 6, 6, 0]}
                        maxBarSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty
                    title={
                      gapSemNf === 0
                        ? 'Nenhum gap sem NF neste período.'
                        : 'Sem breakdown por canal.'
                    }
                    dense
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </DomainPageShell>
  )
}
