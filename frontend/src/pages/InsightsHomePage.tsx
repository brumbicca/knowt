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
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AiInsightPanel } from '../components/AiInsightPanel'
import { DomainPageShell } from '../components/DomainPageShell'
import { Hicon, type HiconName } from '../components/Hicon'
import { InsightsAgendaColumn } from '../components/InsightsAgendaColumn'
import { Sparkline } from '../components/Sparkline'
import { StrategyRadar, type RadarAxisPoint } from '../components/StrategyRadar'
import { nowSP } from '../utils/spTime'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchOpsAlerts,
  fmtBrl,
  type OpsAlertsPayload,
  type Periodo,
} from '../api/bridge'

type InsightHorizon = 'hoje' | 'semana' | 'mes'

const HORIZON: Array<{ id: InsightHorizon; label: string }> = [
  { id: 'hoje', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
]

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

function deltaToScore(deltaPct: number | null | undefined): number {
  if (deltaPct == null || Number.isNaN(deltaPct)) return 50
  return clampScore(50 + deltaPct)
}

function greetingForHour(h: number): string {
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

type InsightCardProps = {
  title: string
  value: string
  hint: string
  icon: HiconName
  tone: 'gain' | 'loss' | 'act' | 'perf'
  to: string
  cta: string
}

function InsightHeroCard({ title, value, hint, icon, tone, to, cta }: InsightCardProps) {
  const theme = useTheme()
  const toneColor =
    tone === 'gain'
      ? theme.palette.success.main
      : tone === 'loss'
        ? theme.palette.error.main
        : tone === 'act'
          ? theme.palette.warning.main
          : theme.palette.primary.main

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(toneColor, 0.28),
        bgcolor: alpha(toneColor, 0.04),
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(toneColor, 0.16),
              color: toneColor,
              flexShrink: 0,
            }}
          >
            <Hicon name={icon} sx={{ fontSize: '1.15rem' }} />
          </Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ pt: 0.5, lineHeight: 1.25 }}>
            {title}
          </Typography>
        </Stack>
        <Typography
          sx={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            fontSize: '1.45rem',
            lineHeight: 1.15,
            fontVariantNumeric: 'tabular-nums',
            mb: 0.5,
          }}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25 }}>
          {hint}
        </Typography>
        <Link
          component={RouterLink}
          to={to}
          underline="hover"
          fontWeight={600}
          sx={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 0.35 }}
        >
          {cta}
          <Hicon name="chevron-right" sx={{ fontSize: '0.85rem' }} />
        </Link>
      </CardContent>
    </Card>
  )
}

/** Insights · pág.12 — resumo executivo (KPIs + agenda compacta). */
export function InsightsHomePage() {
  const theme = useTheme()
  const {
    data,
    loading,
    error,
    refresh,
    periodo,
    setPeriodo,
    periodQuery,
    marketplace,
  } = useBiData()
  const { isFiestaActive, activeSource, activeSourceId } = useBiSource()
  const [ops, setOps] = useState<OpsAlertsPayload | null>(null)
  const [horizon, setHorizon] = useState<InsightHorizon>(() => {
    if (periodo === 'hoje') return 'hoje'
    if (periodo === 'mes') return 'mes'
    return 'semana'
  })

  const applyHorizon = useCallback(
    (h: InsightHorizon) => {
      setHorizon(h)
      setPeriodo(h as Periodo)
    },
    [setPeriodo],
  )

  useEffect(() => {
    if (!isFiestaActive) {
      setOps(null)
      return
    }
    fetchOpsAlerts(periodQuery, marketplace || undefined)
      .then(setOps)
      .catch(() => setOps(null))
  }, [periodQuery, marketplace, isFiestaActive, activeSourceId])

  const sparkVendas = useMemo(() => (data?.daily || []).map((d) => d.valor), [data?.daily])
  const sparkPedidos = useMemo(() => (data?.daily || []).map((d) => d.pedidos), [data?.daily])
  const sparkLiquido = useMemo(() => {
    if (!data?.daily?.length || !data.vendas) return []
    const ratio = data.liquido / data.vendas
    return data.daily.map((d) => d.valor * ratio)
  }, [data])

  const ticketMedio = data && data.pedidos > 0 ? data.vendas / data.pedidos : 0
  const cobertura = data?.coberturaPct
  const gapSemNf = isFiestaActive ? Number(ops?.margin_gap?.sem_nf || 0) : 0
  const alertsCrit = isFiestaActive
    ? (ops?.alerts || []).filter((a) => a.severity === 'error' || a.severity === 'warning')
    : []
  const actCount = alertsCrit.length + (gapSemNf > 0 ? 1 : 0) + (cobertura != null && cobertura < 90 ? 1 : 0)

  const ganharValor =
    data?.deltaVendasPct != null && data.deltaVendasPct > 0 && data.prevVendas
      ? (data.deltaVendasPct / 100) * data.prevVendas
      : data?.liquido || 0

  const perderValor =
    isFiestaActive && gapSemNf > 0 && ticketMedio > 0
      ? gapSemNf * ticketMedio
      : data?.taxas || 0

  const focusThemes = useMemo(() => {
    const themes: string[] = []
    if (cobertura != null && cobertura < 95) themes.push('Margem/CMV')
    if (gapSemNf > 0) themes.push('Notas fiscais')
    if ((data?.deltaVendasPct ?? 0) < 0) themes.push('Receita')
    if (alertsCrit.some((a) => /sync|upseller/i.test(`${a.title} ${a.detail}`))) themes.push('Sync')
    if (!themes.length) themes.push('Receita', 'Margem', 'Pedidos')
    return themes.slice(0, 3)
  }, [cobertura, gapSemNf, data?.deltaVendasPct, alertsCrit])

  const radarData = useMemo((): RadarAxisPoint[] => {
    if (!data) return []
    const canaisAtivos = (data.canais || []).filter((c) => c.value > 0 || c.pedidos > 0).length
    const liquidoScore =
      data.vendas > 0 ? clampScore((data.liquido / data.vendas) * 100) : 0
    const fiscalScore =
      data.coberturaPct != null
        ? clampScore(data.coberturaPct)
        : data.pedidos > 0
          ? clampScore((data.totalMargens / data.pedidos) * 100)
          : 0
    return [
      {
        eixo: 'Vendas',
        score: deltaToScore(data.deltaVendasPct),
        hint: data.deltaVendasPct != null ? `${data.deltaVendasPct.toFixed(1)}% vs ant.` : 'sem Δ',
      },
      {
        eixo: 'Líquido',
        score: liquidoScore,
        hint: data.vendas > 0 ? `${((data.liquido / data.vendas) * 100).toFixed(0)}% da receita` : '—',
      },
      {
        eixo: 'Volume',
        score: deltaToScore(data.deltaPedidosPct),
        hint: data.deltaPedidosPct != null ? `${data.deltaPedidosPct.toFixed(1)}% vs ant.` : 'sem Δ',
      },
      {
        eixo: 'Fiscal',
        score: fiscalScore,
        hint:
          data.coberturaPct != null
            ? `cobertura ${data.coberturaPct.toFixed(0)}%`
            : `${data.totalMargens}/${data.pedidos} c/ margem`,
      },
      {
        eixo: 'Canais',
        score: clampScore(canaisAtivos * 25),
        hint: `${canaisAtivos} canal(is)`,
      },
    ]
  }, [data])

  const frentes = useMemo(() => {
    if (!data) return []
    const margemPct = data.vendas > 0 ? (data.margemTotal / data.vendas) * 100 : 0
    const liquidoPct = data.vendas > 0 ? (data.liquido / data.vendas) * 100 : 0
    const topCanal = [...(data.canais || [])].sort((a, b) => b.value - a.value)[0]
    const concentracao =
      topCanal && data.vendas > 0 ? Math.round((topCanal.value / data.vendas) * 100) : 0
    return [
      {
        name: 'Cobertura margem/CMV',
        impacto: cobertura != null && cobertura < 90 ? 'Alto impacto' : 'Monitorar',
        pct: cobertura ?? 0,
        hint: undefined as string | undefined,
        to: '/insights/financeiro',
      },
      {
        name: 'Conversão líquido / receita',
        impacto: liquidoPct < 60 ? 'Alto impacto' : 'Estável',
        pct: clampScore(liquidoPct),
        hint: undefined,
        to: '/insights/comercial',
      },
      {
        name: 'Concentração de canal',
        impacto: concentracao >= 70 ? 'Atenção' : 'Diversificado',
        pct: concentracao,
        hint: topCanal ? topCanal.name : undefined,
        to: '/insights/comercial',
      },
      {
        name: 'Margem no período',
        impacto: margemPct < 15 ? 'Rever CMV' : 'Saudável',
        pct: clampScore(margemPct * 2),
        hint: undefined,
        to: '/insights/financeiro',
      },
    ]
  }, [data, cobertura])

  const perfLabel =
    data?.deltaVendasPct != null
      ? `${data.deltaVendasPct > 0 ? '+' : ''}${data.deltaVendasPct.toFixed(1)}%`
      : '—'

  const hourNow = nowSP().getHours()

  return (
    <DomainPageShell
      title="Insights"
      subtitle="Resumo dos principais insights · mesmo motor do knowt"
      loading={loading && !data}
      error={error}
      onRetry={refresh}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'flex-end' }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 700,
              fontSize: { xs: '1.35rem', sm: '1.6rem' },
              lineHeight: 1.2,
            }}
          >
            {greetingForHour(hourNow)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aqui está o que mais importa
            {activeSource?.name ? ` na ${activeSource.name}` : ''} hoje.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            variant="outlined"
            label={format(nowSP(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          />
          <Stack
            direction="row"
            sx={{
              p: 0.35,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            {HORIZON.map((h) => (
              <Button
                key={h.id}
                size="small"
                variant={horizon === h.id ? 'contained' : 'text'}
                onClick={() => applyHorizon(h.id)}
                sx={{
                  textTransform: 'none',
                  minWidth: 64,
                  fontWeight: 600,
                  borderRadius: 1.5,
                  boxShadow: 'none',
                }}
              >
                {h.label}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Stack>

      <Typography
        variant="overline"
        color="text.secondary"
        fontWeight={700}
        letterSpacing={0.1}
        sx={{ display: 'block', mb: 1 }}
      >
        Resumo dos principais insights
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2}>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <InsightHeroCard
                  title="Onde ganhar dinheiro"
                  value={fmtBrl(ganharValor)}
                  hint={
                    data?.deltaVendasPct != null && data.deltaVendasPct > 0
                      ? 'Potencial alinhado ao Δ de vendas vs período anterior'
                      : 'Líquido do período — foco em canais e ticket'
                  }
                  icon="graph"
                  tone="gain"
                  to="/insights/comercial"
                  cta="Ver oportunidades"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <InsightHeroCard
                  title="Onde perder dinheiro"
                  value={fmtBrl(perderValor)}
                  hint={
                    gapSemNf > 0
                      ? `${gapSemNf} pedidos sem NF · impacto estimado por ticket`
                      : 'Taxas do período — monitorar frete e comissões'
                  }
                  icon="report"
                  tone="loss"
                  to="/insights/alertas"
                  cta="Ver riscos"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <InsightHeroCard
                  title="Onde agir primeiro"
                  value={String(Math.max(actCount, 1))}
                  hint={
                    isFiestaActive
                      ? 'Iniciativas críticas (alertas, NF, cobertura)'
                      : 'Prioridades com base em vendas, margem e canais desta fonte'
                  }
                  icon="activity"
                  tone="act"
                  to="/insights/prioridades"
                  cta="Ver plano de ação"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <InsightHeroCard
                  title="Performance geral"
                  value={perfLabel}
                  hint="vs período anterior · vendas válidas"
                  icon="buy"
                  tone="perf"
                  to="/insights/comercial"
                  cta="Ver indicadores"
                />
              </Grid>
            </Grid>

            <Card
              sx={{
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.07),
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.22),
              }}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ sm: 'center' }}
                  spacing={1}
                >
                  <Typography variant="body2" fontWeight={700}>
                    FOCO DO DIA:{' '}
                    <Box component="span" fontWeight={600} color="text.secondary">
                      {focusThemes.join(', ')}
                    </Box>
                  </Typography>
                  <Link
                    component={RouterLink}
                    to="/insights/prioridades"
                    underline="hover"
                    fontWeight={600}
                    sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    Ver análise completa →
                  </Link>
                </Stack>
              </CardContent>
            </Card>

            <Box>
              <Typography
                variant="overline"
                color="text.secondary"
                fontWeight={700}
                letterSpacing={0.08}
                sx={{ display: 'block', mb: 1 }}
              >
                Desempenho geral
              </Typography>
              <Stack
                direction="row"
                spacing={1.25}
                useFlexGap
                flexWrap="wrap"
                sx={{ mb: 0 }}
              >
                {(
                  [
                    {
                      label: 'Vendas',
                      value: data?.vendasFmt || '—',
                      delta: data?.deltaVendasPct,
                      spark: sparkVendas,
                    },
                    {
                      label: 'Líquido',
                      value: data?.liquidoFmt || '—',
                      delta: null as number | null,
                      spark: sparkLiquido,
                    },
                    {
                      label: 'Margem',
                      value: data?.margemFmt || '—',
                      delta: null,
                      spark: sparkVendas,
                    },
                    {
                      label: 'Pedidos',
                      value: data ? String(data.pedidos) : '—',
                      delta: data?.deltaPedidosPct ?? null,
                      spark: sparkPedidos,
                    },
                    {
                      label: 'Cobertura NF',
                      value: cobertura != null ? `${cobertura.toFixed(0)}%` : '—',
                      delta: null,
                      spark: sparkPedidos,
                    },
                  ] as const
                ).map((row) => (
                  <Box
                    key={row.label}
                    sx={{
                      flex: { xs: '1 1 calc(50% - 10px)', sm: '1 1 0' },
                      minWidth: { sm: 120 },
                    }}
                  >
                    <Card sx={{ height: '100%', borderRadius: 2 }}>
                      <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          {row.label}
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: '"Outfit", sans-serif',
                            fontWeight: 700,
                            fontSize: '1.05rem',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {row.value}
                        </Typography>
                        {row.delta != null ? (
                          <Typography
                            variant="caption"
                            color={row.delta >= 0 ? 'success.main' : 'error.main'}
                            fontWeight={600}
                          >
                            {row.delta > 0 ? '+' : ''}
                            {row.delta.toFixed(1)}%
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            no período
                          </Typography>
                        )}
                        <Sparkline values={[...row.spark]} height={26} />
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Card sx={{ height: '100%', borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Radar estratégico
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      Scores 0–100 a partir dos KPIs do filtro
                    </Typography>
                    <StrategyRadar data={radarData} height={240} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <Card sx={{ height: '100%', borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Frentes que mais movimentam o resultado
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 1.5 }}
                    >
                      Prioridade relativa — clique para aprofundar nos Insights
                    </Typography>
                    <Stack spacing={1.5}>
                      {frentes.map((f) => (
                        <Box key={f.name}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="baseline"
                            spacing={1}
                            sx={{ mb: 0.5 }}
                          >
                            <Link
                              component={RouterLink}
                              to={f.to}
                              underline="hover"
                              fontWeight={600}
                              color="inherit"
                              variant="body2"
                            >
                              {f.name}
                              {f.hint ? (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ ml: 0.75 }}
                                >
                                  · {f.hint}
                                </Typography>
                              ) : null}
                            </Link>
                            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                              {f.impacto} · {Math.round(f.pct)}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={Math.max(4, Math.min(100, f.pct))}
                            sx={{
                              height: 8,
                              borderRadius: 999,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              '& .MuiLinearProgress-bar': { borderRadius: 999 },
                            }}
                          />
                        </Box>
                      ))}
                      {!frentes.length ? (
                        <Typography variant="body2" color="text.secondary">
                          Sem base no período — ajusta o filtro Dia / Semana / Mês.
                        </Typography>
                      ) : null}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card
              sx={{
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.03),
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Decisões rápidas, baseadas em dados, constroem resultados extraordinários. · Foco ·
                  Disciplina · Execução
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack
            spacing={2}
            sx={{
              position: { lg: 'sticky' },
              top: { lg: 16 },
              alignItems: { xs: 'stretch', lg: 'flex-end' },
            }}
          >
            <AiInsightPanel
              key={activeSourceId || 'fiesta'}
              dominio="home"
              fallback={{
                title:
                  gapSemNf > 0
                    ? `${gapSemNf} pedidos sem NF no período`
                    : 'Sem desvio crítico no período',
                detail: isFiestaActive
                  ? 'Leitura do período com base em vendas, margem, frete e alertas — a mesma que a Rica IA usa no chat.'
                  : `Leitura da fonte ${activeSource?.name || 'activa'} (vendas, margem e canais) — sem misturar dados do Fiesta.`,
                recommendations: [
                  {
                    title: 'Ver riscos abertos',
                    detail: 'Alertas por severidade e impacto no resultado.',
                    to: '/insights/alertas',
                  },
                  {
                    title: 'Plano de ação da semana',
                    detail: 'Prioridades por área com prazo e responsável.',
                    to: '/insights/prioridades',
                  },
                ],
              }}
            />
            <Box sx={{ width: '100%', maxWidth: { lg: 400 } }}>
              <InsightsAgendaColumn />
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </DomainPageShell>
  )
}
