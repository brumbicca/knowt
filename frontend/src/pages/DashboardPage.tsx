import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Link,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartEmpty } from '../components/ChartEmpty'
import { KpiCard } from '../components/KpiCard'
import { StrategyRadar, type RadarAxisPoint } from '../components/StrategyRadar'
import { AgendaCard } from '../components/AgendaCard'
import { TasksCard } from '../components/TasksCard'
import { ConnectorsCard } from '../components/ConnectorsCard'
import { SyncOpsCard } from '../components/SyncOpsCard'
import { SourceHealthCard } from '../components/SourceHealthCard'
import { OpsAlertsCard } from '../components/OpsAlertsCard'
import { MiniPnlCard } from '../components/MiniPnlCard'
import { AiInsightPanel } from '../components/AiInsightPanel'
import { useBiData } from '../state/BiDataContext'
import { channelNameToId, fmtBrl } from '../api/bridge'

function fmtAxis(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/** Delta % → score 0–100 (50 = estável). */
function deltaToScore(deltaPct: number | null | undefined): number {
  if (deltaPct == null || Number.isNaN(deltaPct)) return 50
  return clampScore(50 + deltaPct)
}

export function DashboardPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { data, loading, error, refresh, marketplace, marketplaceOptions, setMarketplace } =
    useBiData()
  const canalLabel =
    marketplaceOptions.find((o) => o.id === marketplace)?.label || 'Todos os canais'

  const ticketMedio = data && data.pedidos > 0 ? data.vendas / data.pedidos : 0

  const series = useMemo(() => {
    const daily = data?.daily?.length ? data.daily : []
    return daily.map((d) => ({ dia: d.dia, valor: d.valor }))
  }, [data?.daily])

  const canais = useMemo(() => {
    const rows = data?.canais?.length
      ? data.canais.map((c) => ({ name: c.name, value: c.value }))
      : []
    return rows
  }, [data?.canais])

  const sparkVendas = useMemo(() => (data?.daily || []).map((d) => d.valor), [data?.daily])
  const sparkPedidos = useMemo(() => (data?.daily || []).map((d) => d.pedidos), [data?.daily])
  const sparkTicket = useMemo(
    () =>
      (data?.daily || []).map((d) => (d.pedidos > 0 ? d.valor / d.pedidos : 0)),
    [data?.daily],
  )

  const radarData = useMemo((): RadarAxisPoint[] => {
    if (!data) return []
    const canaisAtivos = (data.canais || []).filter((c) => c.value > 0 || c.pedidos > 0).length
    const canaisScore = clampScore(canaisAtivos * 25)
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
            ? `cobertura NF ${data.coberturaPct.toFixed(0)}%`
            : `${data.totalMargens}/${data.pedidos} c/ margem`,
      },
      {
        eixo: 'Canais',
        score: canaisScore,
        hint: `${canaisAtivos} canal(is) com venda`,
      },
    ]
  }, [data])

  const canalTotal = canais.reduce((s, c) => s + c.value, 0)

  const selectCanal = (name: string) => {
    const id = channelNameToId(name)
    if (!id) return
    setMarketplace(marketplace === id ? '' : id)
  }

  const margemHint = (() => {
    if (!data) return 'Soma das margens no período'
    if (data.cmvInconsistente) {
      return `CMV ${data.cmvFmt} >> vendas — rever cadastro (não é P&L)`
    }
    const n = data.totalMargens
    const pedidos = data.pedidos
    if (n === 0 && pedidos > 0) {
      return `${pedidos} pedido(s) sem NF/CMV neste período`
    }
    if (n > 0 && pedidos > 0 && n < pedidos) {
      return `Amostra ${n}/${pedidos} c/ NF · CMV ${data.cmvFmt}`
    }
    return `CMV ${data.cmvFmt} · média ${data.margemMediaFmt}`
  })()

  const margemBadge = (() => {
    if (!data) return null
    if (data.cmvInconsistente) return 'Rever CMV'
    const n = data.totalMargens
    const pedidos = data.pedidos
    if (n === 0 && pedidos > 0) return 'Sem cobertura'
    if (n > 0 && pedidos > 0 && n < pedidos) return `Amostra ${n}/${pedidos}`
    return null
  })()

  const margemTone =
    data?.cmvInconsistente ||
    (data && data.totalMargens > 0 && data.pedidos > 0 && data.totalMargens < data.pedidos) ||
    (data && data.totalMargens === 0 && data.pedidos > 0)
      ? ('caveat' as const)
      : ('default' as const)

  const margemValue = data?.cmvInconsistente ? 'Inconsistente' : (data?.margemFmt ?? '—')

  return (
    <Stack spacing={3}>
      {error ? (
        <Alert
          severity="error"
          action={
            <Typography
              component="button"
              onClick={refresh}
              sx={{
                border: 0,
                bgcolor: 'transparent',
                cursor: 'pointer',
                color: 'inherit',
                fontWeight: 700,
              }}
            >
              Tentar de novo
            </Typography>
          }
        >
          {error}
        </Alert>
      ) : null}

      {loading && !data ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-end' }}
        spacing={1}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
            Command Center
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Visão geral do negócio — análise detalhada de vendas em{' '}
            <Typography
              component={RouterLink}
              to="/vendas"
              variant="body2"
              fontWeight={700}
              color="primary"
              sx={{ textDecoration: 'none' }}
            >
              Vendas
            </Typography>
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to="/vendas"
          variant="contained"
          size="small"
          sx={{ textTransform: 'none', alignSelf: { xs: 'stretch', sm: 'auto' } }}
        >
          Abrir Vendas
        </Button>
      </Stack>

      <Grid container spacing={{ xs: 1.25, sm: 2 }}>
        <Grid size={{ xs: 12, sm: 6, md: 'grow' }}>
          <KpiCard
            label="Vendas brutas"
            value={data?.vendasFmt ?? '—'}
            hint="Pedidos válidos (sem cancelados)"
            deltaPct={data?.deltaVendasPct}
            sparkline={sparkVendas}
            loading={loading}
            to="/vendas"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 'grow' }}>
          <KpiCard
            label="Líquido / a receber"
            value={data?.liquidoFmt ?? '—'}
            hint={data ? `Taxas ${data.taxasFmt} · Frete ${data.freteFmt}` : 'Receita − taxas − frete'}
            sparkline={sparkVendas}
            loading={loading}
            to="/pagamentos"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 'grow' }}>
          <KpiCard
            label="Pedidos válidos"
            value={data ? String(data.pedidos) : '—'}
            hint={marketplace ? canalLabel : 'Todos os canais'}
            deltaPct={data?.deltaPedidosPct}
            sparkline={sparkPedidos}
            loading={loading}
            to="/pedidos"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 'grow' }}>
          <KpiCard
            label="Ticket médio"
            value={data ? fmtBrl(ticketMedio) : '—'}
            hint="Vendas ÷ pedidos válidos"
            sparkline={sparkTicket}
            loading={loading}
            to="/vendas"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 'grow' }}>
          <KpiCard
            label={data?.cmvInconsistente ? 'Margem CMV (cadastro)' : 'Margem CMV'}
            value={margemValue}
            hint={margemHint}
            badge={margemBadge}
            valueTone={margemTone}
            loading={loading}
            to="/margens"
          />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: -1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', mr: 0.5 }}>
          Explorar:
        </Typography>
        {(
          [
            { to: '/vendas', label: 'Vendas' },
            { to: '/pedidos', label: 'Pedidos' },
            { to: '/margens', label: 'Margens' },
            { to: '/fiscal', label: 'Fiscal' },
            { to: '/produtos', label: 'Produtos' },
          ] as const
        ).map((d) => (
          <Chip
            key={d.to}
            component={RouterLink}
            to={d.to}
            clickable
            size="small"
            label={d.label}
            variant={d.to === '/vendas' ? 'filled' : 'outlined'}
            color={d.to === '/vendas' ? 'primary' : 'default'}
            sx={{ textDecoration: 'none', fontWeight: 600 }}
          />
        ))}
      </Stack>

      {data?.cmvInconsistente ? (
        <Alert severity="warning" variant="outlined">
          O CMV cadastrado está fora de escala face às vendas. Ver detalhe em{' '}
          <Typography component={RouterLink} to="/margens" fontWeight={700} color="inherit">
            Margens
          </Typography>
          .
        </Alert>
      ) : null}

      {/* Só a faixa de gráficos + Insight — o resto da página usa largura total */}
      <Grid container spacing={2} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 8 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="baseline"
                    spacing={1}
                    sx={{ mb: 0.5 }}
                  >
                    <Typography variant="h6">Vendas · tendência</Typography>
                    <Link
                      component={RouterLink}
                      to="/vendas"
                      underline="hover"
                      variant="body2"
                      fontWeight={700}
                    >
                      Análise completa
                    </Link>
                  </Stack>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1 }}
                  >
                    Resumo do período — comparação, canais e top SKUs em Vendas
                  </Typography>
                  <Box sx={{ width: '100%', height: { xs: 200, sm: 240 } }}>
                    {series.length ? (
                      <ResponsiveContainer>
                        <AreaChart
                          data={series}
                          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="homeVendasFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={chart.fill} stopOpacity={0.4} />
                              <stop offset="100%" stopColor={chart.fill} stopOpacity={0.02} />
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
                            formatter={(value) => [fmtBrl(Number(value)), 'Vendas']}
                            contentStyle={{
                              borderRadius: 8,
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="valor"
                            stroke={chart.line}
                            fill="url(#homeVendasFill)"
                            strokeWidth={2.5}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmpty title="Sem série diária no período." dense />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={2}>
                <Card>
                  <CardContent>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="baseline"
                      sx={{ mb: 0.5 }}
                    >
                      <Typography variant="h6">Por canal</Typography>
                      {canalTotal > 0 ? (
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          {fmtBrl(canalTotal)}
                        </Typography>
                      ) : null}
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 0.5 }}
                    >
                      Clique para filtrar
                      {marketplace ? ` · ${canalLabel}` : ''}
                    </Typography>
                    <Box
                      sx={{ width: '100%', height: { xs: 150, sm: 160 }, position: 'relative' }}
                    >
                      {canais.length ? (
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={canais}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={40}
                              outerRadius={62}
                              paddingAngle={2}
                              stroke="none"
                              cursor="pointer"
                              onClick={(_, index) => {
                                const row = canais[index]
                                if (row?.name) selectCanal(String(row.name))
                              }}
                            >
                              {canais.map((c, i) => (
                                <Cell
                                  key={c.name}
                                  fill={chart.pie[i % chart.pie.length]}
                                  opacity={
                                    !marketplace || channelNameToId(c.name) === marketplace
                                      ? 1
                                      : 0.35
                                  }
                                />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => fmtBrl(Number(v))} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <ChartEmpty title="Sem vendas por canal." dense />
                      )}
                    </Box>
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {canais.slice(0, 4).map((c, i) => {
                        const pct = canalTotal ? (c.value / canalTotal) * 100 : 0
                        const id = channelNameToId(c.name)
                        const active = marketplace && id === marketplace
                        return (
                          <Stack
                            key={c.name}
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            onClick={() => selectCanal(c.name)}
                            sx={{
                              cursor: id ? 'pointer' : 'default',
                              borderRadius: 1,
                              px: 0.5,
                              py: 0.15,
                              bgcolor: active ? 'action.selected' : 'transparent',
                              '&:hover': id ? { bgcolor: 'action.hover' } : undefined,
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              sx={{ minWidth: 0 }}
                            >
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: chart.pie[i % chart.pie.length],
                                  flexShrink: 0,
                                }}
                              />
                              <Typography
                                variant="body2"
                                noWrap
                                fontWeight={active ? 700 : 400}
                              >
                                {c.name}
                              </Typography>
                            </Stack>
                            <Typography
                              variant="caption"
                              sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                            >
                              {pct.toFixed(0)}%
                            </Typography>
                          </Stack>
                        )
                      })}
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Radar estratégico
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 0.5 }}
                    >
                      Equilíbrio do período · deltas, líquido, cobertura NF e canais activos
                    </Typography>
                    <StrategyRadar data={radarData} height={200} />
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: { xs: 'stretch', lg: 'flex-end' },
            }}
          >
            <AiInsightPanel
              dominio="home"
              fallback={{
                title: data
                  ? `Receita ${fmtBrl(data.vendas)} · ${data.pedidos} pedidos`
                  : 'Insight da IA do período',
                detail:
                  'Leitura geral do Command Center — a mesma que a Rica IA usa no chat.',
                recommendations: [
                  { title: 'Ver pedidos', detail: 'Funil e lista do período.', to: '/pedidos' },
                  { title: 'Ver alertas', detail: 'Gaps e sync.', to: '/insights/alertas' },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <MiniPnlCard data={data} loading={loading} />
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <OpsAlertsCard />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <AgendaCard />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <TasksCard />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <SyncOpsCard />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <SourceHealthCard />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <ConnectorsCard />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  )
}
