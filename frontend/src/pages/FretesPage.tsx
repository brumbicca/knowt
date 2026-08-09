import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
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
import { ChartEmpty } from '../components/ChartEmpty'
import { DomainPageShell } from '../components/DomainPageShell'
import { KpiCard } from '../components/KpiCard'
import { AiInsightPanel } from '../components/AiInsightPanel'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchFretesPedidos,
  fetchMetricas,
  fmtBrl,
  fmtIsoDate,
  type FretesPedidos,
  type PedidosMetricas,
} from '../api/bridge'

type KpiId = 'metricas' | 'registos' | 'soma'

function shortLabel(text: string, max = 28): string {
  const t = (text || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function fmtAxis(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(Math.round(n))
}

export function FretesPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { periodQuery, marketplace } = useBiData()
  const { activeSourceId } = useBiSource()
  const [fretes, setFretes] = useState<FretesPedidos | null>(null)
  const [metricas, setMetricas] = useState<PedidosMetricas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpiId, setKpiId] = useState<KpiId>('metricas')
  const [pagina, setPagina] = useState(1)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchFretesPedidos(periodQuery, marketplace || undefined, pagina),
      fetchMetricas(periodQuery, marketplace || undefined).catch(() => null),
    ])
      .then(([f, m]) => {
        setFretes(f)
        setMetricas(m)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar fretes')
      })
      .finally(() => setLoading(false))
  }, [periodQuery, marketplace, pagina, activeSourceId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPagina(1)
  }, [periodQuery, marketplace, activeSourceId])

  const rows = fretes?.fretes || []
  const resumo = fretes?.resumo
  const listaTotal = Number(resumo?.totalFrete ?? 0)
  const freteMetricas = Number(metricas?.metricas?.totalFrete ?? 0)
  const receitaMetricas = Number(
    metricas?.metricas?.totalReceita ?? metricas?.total_receita ?? 0,
  )
  const liquidoMetricas = Number(
    metricas?.metricas?.totalLiquido ?? metricas?.total_liquido ?? 0,
  )
  const totalRegistos = Number(resumo?.pedidosComFrete ?? fretes?.paginacao?.total ?? rows.length)

  const freteSobreReceita =
    receitaMetricas > 0
      ? Math.round((1000 * freteMetricas) / receitaMetricas) / 10
      : null
  const freteSobreLiquido =
    liquidoMetricas > 0
      ? Math.round((1000 * freteMetricas) / liquidoMetricas) / 10
      : null

  const canalBars = useMemo(
    () =>
      (resumo?.porCanal || [])
        .filter((c) => Number(c.frete || 0) !== 0)
        .map((c, i) => ({
          name: c.canal || '—',
          valor: Number(c.frete || 0),
          pedidos: Number(c.pedidos || 0),
          fill: chart.pie[i % chart.pie.length],
        })),
    [resumo?.porCanal, chart],
  )

  const fontesBars = useMemo(
    () => [
      { name: 'Métricas pedidos', valor: freteMetricas, fill: chart.line },
      { name: 'Soma da lista', valor: listaTotal, fill: chart.pie[2] },
    ],
    [freteMetricas, listaTotal, chart],
  )

  const topFreteBars = useMemo(
    () =>
      [...rows]
        .sort((a, b) => Math.abs(Number(b.frete || 0)) - Math.abs(Number(a.frete || 0)))
        .slice(0, 8)
        .map((r) => {
          const id = String(r.pedido_id || '—')
          return {
            name: shortLabel(id, 18),
            full: `${id}${r.canal ? ` · ${r.canal}` : ''}`,
            custo: Number(r.frete || 0),
          }
        }),
    [rows],
  )

  const registosBars = useMemo(
    () => [
      { name: 'Pedidos com frete', valor: totalRegistos, fill: chart.line },
      {
        name: 'Sem frete',
        valor: Math.max(0, Number(resumo?.pedidos ?? 0) - totalRegistos),
        fill: chart.pie[0],
      },
    ],
    [totalRegistos, resumo?.pedidos, chart],
  )

  const faixasBars = useMemo(() => {
    const buckets = [
      { name: 'Negativo', min: -Infinity, max: 0, total: 0 },
      { name: '< R$15', min: 0, max: 15, total: 0 },
      { name: '15–30', min: 15, max: 30, total: 0 },
      { name: '30–60', min: 30, max: 60, total: 0 },
      { name: '60–100', min: 60, max: 100, total: 0 },
      { name: '≥100', min: 100, max: Infinity, total: 0 },
    ]
    for (const r of rows) {
      const c = Number(r.frete || 0)
      if (c === 0) continue
      const b = buckets.find((x) => c >= x.min && c < x.max)
      if (b) b.total += 1
    }
    return buckets.filter((b) => b.total > 0).map(({ name, total }) => ({ name, total }))
  }, [rows])

  const shareBars = useMemo(() => {
    if (receitaMetricas <= 0 && freteMetricas <= 0) return []
    const resto = Math.max(0, receitaMetricas - freteMetricas)
    return [
      { name: 'Frete', valor: freteMetricas, fill: chart.pie[2] || theme.palette.warning.main },
      { name: 'Restante receita', valor: resto, fill: chart.line },
    ].filter((b) => b.valor > 0)
  }, [receitaMetricas, freteMetricas, chart, theme.palette.warning.main])

  const chartLayout = useMemo(() => {
    const canais = {
      kind: 'canais' as const,
      title: 'Frete por canal',
      caption: 'Quebra do total do período · negativo = subsídio do canal',
    }
    const fontes = {
      kind: 'fontes' as const,
      title: 'Fontes · donut',
      caption: 'Métricas dos pedidos vs soma da lista (devem bater)',
    }
    const top = {
      kind: 'top' as const,
      title: 'Top fretes · por pedido',
      caption: 'Maiores fretes na página actual da lista',
    }
    const registos = {
      kind: 'registos' as const,
      title: 'Pedidos · com e sem frete',
      caption: 'Cobertura de frete nos pedidos do período',
    }
    const faixas = {
      kind: 'faixas' as const,
      title: 'Faixas de frete',
      caption: 'Histograma · frete por pedido na página actual',
    }
    const share = {
      kind: 'share' as const,
      title: 'Frete no líquido',
      caption: 'Participação do frete face à receita / líquido dos pedidos',
    }

    if (kpiId === 'soma') {
      return {
        primary: topFreteBars.length ? top : canais,
        secondary: faixasBars.length ? faixas : canais,
        tertiary: shareBars.length ? share : null,
      }
    }
    if (kpiId === 'registos') {
      return {
        primary: registos,
        secondary: faixasBars.length ? faixas : topFreteBars.length ? top : fontes,
        tertiary: shareBars.length ? share : null,
      }
    }
    return {
      primary: canalBars.length ? canais : fontes,
      secondary: faixasBars.length ? faixas : topFreteBars.length ? top : null,
      tertiary: shareBars.length ? share : null,
    }
  }, [kpiId, topFreteBars.length, faixasBars.length, shareBars.length, canalBars.length])

  const renderChart = (kind: 'fontes' | 'top' | 'registos' | 'faixas' | 'share' | 'canais') => {
    if (kind === 'canais') {
      if (!canalBars.length) {
        return <ChartEmpty title="Sem frete por canal no período." dense />
      }
      return (
        <ResponsiveContainer>
          <BarChart data={canalBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              tickFormatter={fmtAxis}
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              formatter={(value, _n, item) => {
                const pedidos = (item?.payload as { pedidos?: number } | undefined)?.pedidos
                return [
                  `${fmtBrl(Number(value))}${pedidos ? ` · ${pedidos} pedidos` : ''}`,
                  'Frete',
                ]
              }}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${theme.palette.divider}`,
              }}
            />
            <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {canalBars.map((b) => (
                <Cell key={b.name} fill={b.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )
    }

    if (kind === 'share') {
      if (!shareBars.length) {
        return <ChartEmpty title="Sem receita/frete para composição." dense />
      }
      return (
        <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={shareBars}
                dataKey="valor"
                nameKey="name"
                innerRadius={52}
                outerRadius={82}
                paddingAngle={2}
                stroke="none"
              >
                {shareBars.map((b) => (
                  <Cell key={b.name} fill={b.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [fmtBrl(Number(value)), 'R$']}
                contentStyle={{
                  borderRadius: 8,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {freteSobreReceita != null ? (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
                pb: 1,
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Typography
                  sx={{
                    fontFamily: '"Outfit", sans-serif',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    lineHeight: 1.1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {freteSobreReceita.toFixed(1)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  frete / receita
                </Typography>
                {freteSobreLiquido != null ? (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {freteSobreLiquido}% / líquido
                  </Typography>
                ) : null}
              </Box>
            </Box>
          ) : null}
        </Box>
      )
    }

    if (kind === 'fontes') {
      return fontesBars.some((b) => b.valor !== 0) ? (
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={fontesBars.filter((b) => b.valor !== 0)}
              dataKey="valor"
              nameKey="name"
              innerRadius={52}
              outerRadius={82}
              paddingAngle={2}
              stroke="none"
            >
              {fontesBars
                .filter((b) => b.valor !== 0)
                .map((b) => (
                  <Cell key={b.name} fill={b.fill} />
                ))}
            </Pie>
            <Tooltip
              formatter={(value) => [fmtBrl(Number(value)), 'Frete']}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${theme.palette.divider}`,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmpty title="Sem frete nas métricas nem na lista." dense />
      )
    }

    if (kind === 'registos') {
      return (
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={registosBars}
              dataKey="valor"
              nameKey="name"
              innerRadius={52}
              outerRadius={82}
              paddingAngle={2}
              stroke="none"
            >
              {registosBars.map((b) => (
                <Cell key={b.name} fill={b.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [Number(value), 'Registos']}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${theme.palette.divider}`,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (kind === 'faixas') {
      if (!faixasBars.length) {
        return <ChartEmpty title="Sem faixas de frete na amostra." dense />
      }
      return (
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
              width={36}
            />
            <Tooltip
              formatter={(value) => [Number(value), 'Envios']}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${theme.palette.divider}`,
              }}
            />
            <Bar dataKey="total" fill={chart.pie[2]} radius={[6, 6, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      )
    }

    if (!topFreteBars.length) {
      return <ChartEmpty title="Sem registos de frete no período." dense />
    }
    return (
      <ResponsiveContainer>
        <BarChart
          layout="vertical"
          data={topFreteBars}
          margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={theme.palette.divider}
            horizontal={false}
          />
          <XAxis
            type="number"
            tickFormatter={fmtAxis}
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
            formatter={(value) => [fmtBrl(Number(value)), 'Custo']}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { full?: string } | undefined
              return row?.full || ''
            }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${theme.palette.divider}`,
            }}
          />
          <Bar dataKey="custo" fill={chart.pie[2]} radius={[0, 6, 6, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  const hasSecondary = Boolean(chartLayout.secondary)
  const hasTertiary = Boolean(chartLayout.tertiary)
  const primaryMd = hasSecondary ? (chartLayout.primary.kind === 'fontes' || chartLayout.primary.kind === 'registos' ? 5 : 7) : 12
  const secondaryMd = chartLayout.primary.kind === 'fontes' || chartLayout.primary.kind === 'registos' ? 7 : 5

  return (
    <DomainPageShell
      title="Fretes"
      subtitle={
        fretes?.periodo
          ? `${fretes.periodo.inicio} → ${fretes.periodo.fim} · clique num card para mudar os gráficos`
          : 'Clique num card para mudar os gráficos'
      }
      loading={loading}
      error={error}
      onRetry={load}
    >
      <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Frete (métricas pedidos)"
            value={fmtBrl(freteMetricas)}
            hint="Mesma fonte do líquido na Home"
            selected={kpiId === 'metricas'}
            loading={loading}
            onClick={() => setKpiId('metricas')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Pedidos com frete"
            value={String(totalRegistos)}
            hint={`de ${Number(resumo?.pedidos ?? 0)} pedidos no período`}
            selected={kpiId === 'registos'}
            loading={loading}
            onClick={() => setKpiId('registos')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Soma da lista"
            value={fmtBrl(listaTotal)}
            hint={
              Math.abs(listaTotal - freteMetricas) < 0.01
                ? 'Bate com o valor canónico'
                : 'Divergente do canónico'
            }
            selected={kpiId === 'soma'}
            loading={loading}
            onClick={() => setKpiId('soma')}
          />
        </Grid>
      </Grid>

      <Alert severity="info" variant="outlined" sx={{ mb: 1.5 }}>
        A lista abaixo é o frete <strong>pedido a pedido</strong>, da mesma fonte do valor canónico
        do Command Center — por isso a soma bate com o cartão. No Mercado Livre o frete pode ser
        negativo (subsídio do canal), o que reduz o total.
      </Alert>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: primaryMd }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {chartLayout.primary.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {chartLayout.primary.caption}
              </Typography>
              <Box sx={{ width: '100%', height: { xs: 200, sm: 240 } }}>
                {renderChart(chartLayout.primary.kind)}
              </Box>
              {(chartLayout.primary.kind === 'fontes' || chartLayout.primary.kind === 'registos') &&
              (chartLayout.primary.kind === 'fontes' ? fontesBars : registosBars).some(
                (b) => b.valor !== 0,
              ) ? (
                <Stack spacing={0.35} sx={{ mt: 1 }}>
                  {(chartLayout.primary.kind === 'fontes' ? fontesBars : registosBars)
                    .filter((b) => b.valor !== 0)
                    .map((b) => (
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
                          {chartLayout.primary.kind === 'fontes'
                            ? fmtBrl(b.valor)
                            : b.valor}
                        </Typography>
                      </Stack>
                    ))}
                </Stack>
              ) : null}
            </CardContent>
          </Card>
        </Grid>

        {chartLayout.secondary ? (
          <Grid size={{ xs: 12, md: secondaryMd }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {chartLayout.secondary.title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1 }}
                >
                  {chartLayout.secondary.caption}
                </Typography>
                <Box sx={{ width: '100%', height: { xs: 200, sm: 240 } }}>
                  {renderChart(chartLayout.secondary.kind)}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ) : null}
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
              dominio="logistica"
              fallback={{
                title: `${fmtBrl(freteMetricas)} de frete em ${totalRegistos} pedidos`,
                detail:
                  freteSobreReceita != null
                    ? `Frete representa ${freteSobreReceita}% da receita do período.`
                    : 'Leitura logística do período — a mesma verdade do chat Hermes.',
                recommendations: [
                  { title: 'Ver pedidos', detail: 'Identificar pedidos com maior custo.', to: '/pedidos' },
                  { title: 'Ver pagamentos', detail: 'Comparar frete, taxas e líquido.', to: '/pagamentos' },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {hasTertiary && chartLayout.tertiary ? (
          <Grid size={{ xs: 12, md: hasSecondary ? 12 : 5 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {chartLayout.tertiary.title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1 }}
                >
                  {chartLayout.tertiary.caption}
                </Typography>
                <Box sx={{ width: '100%', height: { xs: 200, sm: 240 }, maxWidth: 360, mx: 'auto' }}>
                  {renderChart(chartLayout.tertiary.kind)}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ) : null}
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Frete por pedido
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Só pedidos com frete diferente de zero · clique no ID para abrir o pedido
          </Typography>
          <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table size="small" sx={{ minWidth: 620 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell>Canal</TableCell>
                  <TableCell>Pedido</TableCell>
                  <TableCell align="right">Receita</TableCell>
                  <TableCell align="right">Frete</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => {
                  const pid = r.pedido_id
                  const frete = Number(r.frete || 0)
                  return (
                    <TableRow key={`${pid}-${r.shipping_id || ''}`}>
                      <TableCell>{fmtIsoDate(r.data)}</TableCell>
                      <TableCell>
                        {r.canal ? (
                          <Chip label={r.canal} size="small" variant="outlined" />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {pid ? (
                          <Link
                            component={RouterLink}
                            to={`/pedidos?pedido=${encodeURIComponent(String(pid))}`}
                            underline="hover"
                            fontWeight={600}
                          >
                            {pid}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell align="right">{fmtBrl(Number(r.receita || 0))}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: frete < 0 ? theme.palette.success.main : undefined }}
                      >
                        {fmtBrl(frete)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <ChartEmpty title="Nenhum pedido com frete no período." dense />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={pagina <= 1 || loading}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Typography variant="caption" color="text.secondary">
              Página {fretes?.paginacao?.pagina || pagina} de {fretes?.paginacao?.pages || 1}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={pagina >= (fretes?.paginacao?.pages || 1) || loading}
              onClick={() => setPagina((p) => p + 1)}
            >
              Seguinte
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </DomainPageShell>
  )
}
