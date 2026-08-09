import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
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
import { Link as RouterLink } from 'react-router-dom'
import { ChartEmpty } from '../components/ChartEmpty'
import { CoverageGauge } from '../components/CoverageGauge'
import { DomainPageShell } from '../components/DomainPageShell'
import { KpiCard } from '../components/KpiCard'
import { AiInsightPanel } from '../components/AiInsightPanel'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchMargensEstatisticas,
  fetchMargensLista,
  fmtBrl,
  fmtIsoDate,
  type MargensEstatisticas,
  type MargensLista,
} from '../api/bridge'

type KpiId = 'margem' | 'cmv' | 'pago' | 'impostos'

function shortLabel(text: string, max = 28): string {
  const t = (text || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function fmtAxis(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

export function MargensPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { periodQuery, marketplace, data: overview } = useBiData()
  const { activeSourceId } = useBiSource()
  const [lista, setLista] = useState<MargensLista | null>(null)
  const [stats, setStats] = useState<MargensEstatisticas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpiId, setKpiId] = useState<KpiId>('margem')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchMargensLista(periodQuery, marketplace || undefined),
      fetchMargensEstatisticas(periodQuery, marketplace || undefined),
    ])
      .then(([l, s]) => {
        setLista(l)
        setStats(s)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar margens')
      })
      .finally(() => setLoading(false))
  }, [periodQuery, marketplace, activeSourceId])

  useEffect(() => {
    load()
  }, [load])

  const e = stats?.estatisticas
  const cobertura =
    overview && overview.pedidos > 0
      ? Math.round((overview.totalMargens / overview.pedidos) * 1000) / 10
      : null

  const composicaoBars = useMemo(() => {
    if (!e) return []
    return [
      { name: 'Valor pago', valor: Number(e.totalValorPago || 0), fill: chart.pie[0] },
      { name: 'CMV', valor: Number(e.totalCMV || 0), fill: chart.pie[3] || '#c2410c' },
      { name: 'Margem', valor: Number(e.margemTotal || 0), fill: chart.line },
      { name: 'Impostos', valor: Number(e.totalImpostos || 0), fill: chart.pie[1] },
      { name: 'Frete', valor: Number(e.totalFretes || 0), fill: chart.pie[2] },
    ]
  }, [e, chart])

  const impostosFocusBars = useMemo(() => {
    if (!e) return []
    return [
      { name: 'Impostos', valor: Number(e.totalImpostos || 0), fill: chart.pie[1] },
      { name: 'Frete', valor: Number(e.totalFretes || 0), fill: chart.pie[2] },
      { name: 'Margem', valor: Number(e.margemTotal || 0), fill: chart.line },
    ]
  }, [e, chart])

  const cmvFocusBars = useMemo(() => {
    if (!e) return []
    return [
      { name: 'Valor pago', valor: Number(e.totalValorPago || 0), fill: chart.pie[0] },
      { name: 'CMV', valor: Number(e.totalCMV || 0), fill: chart.pie[3] || '#c2410c' },
      { name: 'Margem', valor: Number(e.margemTotal || 0), fill: chart.line },
    ]
  }, [e, chart])

  const rankingBars = useMemo(() => {
    const items = [...(lista?.items || [])]
    const key =
      kpiId === 'cmv' ? 'cmv' : kpiId === 'pago' ? 'paid_value' : 'calculated_margin'
    return items
      .filter((r) => (r as Record<string, unknown>)[key] != null)
      .sort(
        (a, b) =>
          Number((b as Record<string, unknown>)[key] || 0) -
          Number((a as Record<string, unknown>)[key] || 0),
      )
      .slice(0, 8)
      .map((r) => ({
        name: shortLabel(String(r.ad_description || r.description || r.code || '—')),
        valor: Number((r as Record<string, unknown>)[key] || 0),
        full: String(r.ad_description || r.description || r.code || '—'),
      }))
  }, [lista?.items, kpiId])

  const coberturaBars = useMemo(() => {
    if (!overview || overview.pedidos <= 0) return []
    const com = Number(overview.totalMargens || 0)
    const sem = Math.max(0, overview.pedidos - com)
    return [
      { name: 'Com NF/CMV', total: com },
      { name: 'Sem cobertura', total: sem },
    ]
  }, [overview])

  const primaryMeta = useMemo(() => {
    if (kpiId === 'cmv') {
      return {
        title: 'CMV · face ao pago',
        caption: 'Valor pago, CMV e margem (amostra NF) · clique nos cards acima',
        bars: cmvFocusBars,
      }
    }
    if (kpiId === 'pago') {
      return {
        title: 'Composição · valor pago',
        caption: 'Pago, CMV, margem, impostos e frete · clique nos cards acima',
        bars: composicaoBars,
      }
    }
    if (kpiId === 'impostos') {
      return {
        title: 'Impostos + frete',
        caption: 'Impostos, frete e margem da amostra · clique nos cards acima',
        bars: impostosFocusBars,
      }
    }
    return {
      title: 'Composição · amostra NF',
      caption: 'Valor pago, CMV, margem, impostos e frete · clique nos cards acima',
      bars: composicaoBars,
    }
  }, [kpiId, composicaoBars, cmvFocusBars, impostosFocusBars])

  const rankingMeta = useMemo(() => {
    if (kpiId === 'cmv') {
      return { title: 'Top CMV · registos', caption: 'Maiores CMV na amostra', label: 'CMV' }
    }
    if (kpiId === 'pago') {
      return { title: 'Top pago · registos', caption: 'Maiores valores pagos na amostra', label: 'Pago' }
    }
    if (kpiId === 'impostos') {
      return {
        title: 'Top margem · registos',
        caption: 'Sem breakdown de imposto por linha — ranking por margem',
        label: 'Margem',
      }
    }
    return {
      title: 'Top margens · registos',
      caption: 'Maiores margens na lista carregada',
      label: 'Margem',
    }
  }, [kpiId])

  return (
    <DomainPageShell
      title="Margens & CMV"
      subtitle={
        lista?.periodo
          ? `${lista.periodo.inicio} → ${lista.periodo.fim} · clique num card para mudar os gráficos`
          : 'Clique num card para mudar os gráficos'
      }
      loading={loading}
      error={error}
      onRetry={load}
    >
      <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Margem total"
            value={e?.margemTotal != null ? fmtBrl(e.margemTotal) : '—'}
            hint={cobertura != null ? `Cobertura NF ${cobertura}%` : undefined}
            badge={
              cobertura != null && cobertura < 100 && overview
                ? `Amostra ${overview.totalMargens}/${overview.pedidos}`
                : null
            }
            valueTone={cobertura != null && cobertura < 100 ? 'caveat' : 'default'}
            selected={kpiId === 'margem'}
            loading={loading}
            onClick={() => setKpiId('margem')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="CMV"
            value={e?.totalCMV != null ? fmtBrl(e.totalCMV) : '—'}
            hint={`${e?.totalMargens ?? 0} registos`}
            selected={kpiId === 'cmv'}
            loading={loading}
            onClick={() => setKpiId('cmv')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Valor pago"
            value={e?.totalValorPago != null ? fmtBrl(e.totalValorPago) : '—'}
            hint="Soma na amostra com NF"
            selected={kpiId === 'pago'}
            loading={loading}
            onClick={() => setKpiId('pago')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Impostos + frete"
            value={
              e?.totalImpostos != null
                ? `${fmtBrl(e.totalImpostos)} · frete ${fmtBrl(e.totalFretes || 0)}`
                : '—'
            }
            hint="Amostra NF"
            selected={kpiId === 'impostos'}
            loading={loading}
            onClick={() => setKpiId('impostos')}
          />
        </Grid>
      </Grid>

      {cobertura != null && cobertura < 100 ? (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          Valores de margem/CMV cobrem só pedidos com NF ({overview?.totalMargens}/{overview?.pedidos}
          ). Não interpretar como P&L completo do período.
        </Alert>
      ) : null}

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {primaryMeta.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1 }}
                  >
                    {primaryMeta.caption}
                  </Typography>
                  <Box sx={{ width: '100%', height: { xs: 220, sm: 260 } }}>
                    {primaryMeta.bars.some((b) => b.valor !== 0) ? (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={primaryMeta.bars.filter((b) => b.valor > 0)}
                            dataKey="valor"
                            nameKey="name"
                            innerRadius={52}
                            outerRadius={82}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {primaryMeta.bars
                              .filter((b) => b.valor > 0)
                              .map((b) => (
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
                    ) : (
                      <ChartEmpty title="Sem totais de margem neste período." dense />
                    )}
                  </Box>
                  {primaryMeta.bars.some((b) => b.valor !== 0) ? (
                    <Stack spacing={0.4} sx={{ mt: 1 }}>
                      {primaryMeta.bars
                        .filter((b) => b.valor !== 0)
                        .map((b) => (
                          <Stack
                            key={b.name}
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Box
                                sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: b.fill }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {b.name}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" fontWeight={600}>
                              {fmtBrl(b.valor)}
                            </Typography>
                          </Stack>
                        ))}
                    </Stack>
                  ) : null}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Cobertura NF · pedidos
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 1 }}
                  >
                    {cobertura != null
                      ? `${cobertura}% dos pedidos com margem/CMV`
                      : 'Pedidos com vs sem cobertura'}
                  </Typography>
                  <CoverageGauge
                    value={cobertura}
                    label="com CMV/margem"
                    hint={
                      coberturaBars.length
                        ? coberturaBars.map((b) => `${b.name}: ${b.total}`).join(' · ')
                        : undefined
                    }
                    height={240}
                  />
                </CardContent>
              </Card>
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
              dominio="financeiro"
              fallback={{
                title:
                  e?.margemTotal != null
                    ? `Margem ${fmtBrl(e.margemTotal)} no período`
                    : 'Insight de margens do período',
                detail:
                  cobertura != null && cobertura < 100
                    ? `Cobertura NF ${cobertura}% — interpretação parcial até fechar o gap.`
                    : 'Leitura de margens/CMV — mesma verdade do chat Hermes.',
                recommendations: [
                  { title: 'Ver fiscal', detail: 'Pedidos sem NF bloqueiam margem.', to: '/fiscal' },
                  {
                    title: 'Ver produtos',
                    detail: 'Mix e SKUs que puxam o resultado.',
                    to: '/produtos',
                  },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {rankingMeta.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {rankingMeta.caption}
              </Typography>
              <Box sx={{ width: '100%', height: { xs: 240, sm: 280 } }}>
                {rankingBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={rankingBars}
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
                        width={160}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [fmtBrl(Number(value)), rankingMeta.label]}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as { full?: string } | undefined
                          return row?.full || ''
                        }}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar dataKey="valor" fill={chart.line} radius={[0, 6, 6, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem registos para ranking." dense />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Últimas margens calculadas
          </Typography>
          <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Produto / anúncio</TableCell>
                  <TableCell>Pedido</TableCell>
                  <TableCell>Canal</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell align="right">Pago</TableCell>
                  <TableCell align="right">CMV</TableCell>
                  <TableCell align="right">Margem</TableCell>
                  <TableCell align="right">%</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(lista?.items || []).map((row) => (
                  <TableRow key={String(row._id || row.code)}>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ maxWidth: 240 }}
                        noWrap
                        title={row.ad_description || row.description}
                      >
                        {row.ad_description || row.description || row.code || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {row.code ? (
                        <Link
                          component={RouterLink}
                          to={`/pedidos?pedido=${encodeURIComponent(String(row.code))}`}
                          underline="hover"
                          fontWeight={600}
                          variant="body2"
                        >
                          {row.code}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{row.marketplace_name || '—'}</TableCell>
                    <TableCell>{fmtIsoDate(row.reference_date)}</TableCell>
                    <TableCell align="right">{fmtBrl(Number(row.paid_value || 0))}</TableCell>
                    <TableCell align="right">{fmtBrl(Number(row.cmv || 0))}</TableCell>
                    <TableCell align="right">{fmtBrl(Number(row.calculated_margin || 0))}</TableCell>
                    <TableCell align="right">
                      {row.calculated_margin_percent != null
                        ? `${Number(row.calculated_margin_percent).toFixed(1)}%`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && !(lista?.items || []).length ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <ChartEmpty title="Sem margens no período." dense />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>
    </DomainPageShell>
  )
}
