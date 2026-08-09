import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
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
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartEmpty } from '../components/ChartEmpty'
import { CoverageGauge } from '../components/CoverageGauge'
import { DomainPageShell } from '../components/DomainPageShell'
import { KpiCard } from '../components/KpiCard'
import { AiInsightPanel } from '../components/AiInsightPanel'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchFiscalConciliacao,
  fetchNotasPeriodo,
  fetchOpsAlerts,
  fmtBrl,
  fmtIsoDate,
  S1_APP_URL,
  type FiscalConciliacao,
  type NotasPeriodo,
  type OpsAlertsPayload,
} from '../api/bridge'

type KpiId = 'nfs' | 'total' | 'cobertura' | 'sem_nf'

function canalLabel(raw: string): string {
  const n = (raw || '').toLowerCase()
  if (n.includes('shopee')) return 'Shopee'
  if (n.includes('mercado') || n === 'ml' || n.includes('mercadolibre')) return 'Mercado Livre'
  if (n.includes('shein')) return 'Shein'
  if (n.includes('amazon')) return 'Amazon'
  if (n.includes('tiktok')) return 'TikTok'
  if (n.includes('tray')) return 'Tray'
  return raw || '—'
}

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

export function FiscalPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { periodQuery, marketplace } = useBiData()
  const { activeSourceId } = useBiSource()
  const [notas, setNotas] = useState<NotasPeriodo | null>(null)
  const [ops, setOps] = useState<OpsAlertsPayload | null>(null)
  const [conc, setConc] = useState<FiscalConciliacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpiId, setKpiId] = useState<KpiId>('sem_nf')
  const [pagina, setPagina] = useState(1)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchNotasPeriodo(periodQuery, marketplace || undefined, pagina).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar NF')
        return null
      }),
      fetchOpsAlerts(periodQuery, marketplace || undefined).catch(() => null),
      fetchFiscalConciliacao(periodQuery, marketplace || undefined).catch(() => null),
    ])
      .then(([n, o, c]) => {
        setNotas(n)
        setOps(o)
        setConc(c)
        if (n) setError(null)
      })
      .finally(() => setLoading(false))
  }, [periodQuery, marketplace, pagina, activeSourceId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPagina(1)
  }, [periodQuery, marketplace, activeSourceId])

  const rows = notas?.notas || []
  const total = Number(notas?.resumo?.valor_total_nf || 0)
  const totalNotas = Number(
    notas?.resumo?.total_notas ?? notas?.paginacao?.total ?? notas?.count ?? rows.length,
  )
  const gap = ops?.margin_gap
  const coverage = ops?.margin_coverage
  const summaries = conc?.summaries || []

  const pedidosCov = coverage?.pedidos ?? gap?.pedidos
  const margensCov = coverage?.margens_registros ?? gap?.com_margem
  const pct =
    coverage?.cobertura_pct != null
      ? coverage.cobertura_pct
      : pedidosCov && margensCov != null
        ? Math.round((1000 * Number(margensCov)) / Number(pedidosCov)) / 10
        : null
  const hojeSemNf = gap?.sem_nf_hoje_por_canal
    ? Object.entries(gap.sem_nf_hoje_por_canal).reduce((s, [, v]) => s + Number(v || 0), 0)
    : null

  const semNfPorCanal = useMemo(() => {
    const src = gap?.sem_nf_por_canal || {}
    return Object.entries(src)
      .map(([canal, qtd]) => ({
        name: canalLabel(canal),
        total: Number(qtd || 0),
      }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [gap?.sem_nf_por_canal])

  const hubsBars = useMemo(
    () =>
      summaries.map((s) => ({
        name: String(s.label || s.hub_label || s.hub || 'Hub').slice(0, 18),
        matched: Number(s.matched ?? 0),
        sem_nf: Number(s.sem_nf ?? 0),
        nf_orfa: Number(s.nf_orfa ?? 0),
      })),
    [summaries],
  )

  const concEscopoParcial = Boolean(marketplace) && conc?.escopo?.nf_orfa_confiavel === false

  const coberturaBars = useMemo(() => {
    const com = Number(margensCov || 0)
    const ped = Number(pedidosCov || 0)
    if (!ped) return []
    return [
      { name: 'Com NF/CMV', total: com },
      { name: 'Sem cobertura', total: Math.max(0, ped - com) },
    ]
  }, [margensCov, pedidosCov])

  const topNfBars = useMemo(
    () =>
      [...rows]
        .sort((a, b) => Number(b.invoice_total || 0) - Number(a.invoice_total || 0))
        .slice(0, 8)
        .map((n) => {
          const label = String(n.invoice_number || n.marketplace_order_id || n._id || '—')
          return {
            name: shortLabel(label, 16),
            full: label,
            valor: Number(n.invoice_total || 0),
          }
        }),
    [rows],
  )

  const nfCountBars = useMemo(() => {
    const count = totalNotas
    const sem = Number(gap?.sem_nf || 0)
    if (!count && !sem) return []
    return [
      { name: 'NFs no período', total: count, fill: chart.line },
      { name: 'Pedidos sem NF', total: sem, fill: theme.palette.warning.main },
    ]
  }, [totalNotas, gap?.sem_nf, chart.line, theme.palette.warning.main])

  return (
    <DomainPageShell
      title="Fiscal (NF)"
      subtitle={
        notas?.periodo
          ? `${notas.periodo.inicio} → ${notas.periodo.fim} · clique num card para mudar os gráficos`
          : 'Clique num card para mudar os gráficos'
      }
      loading={loading}
      error={error}
      onRetry={load}
    >
      <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="NFs no período"
            value={String(totalNotas)}
            hint={`Página ${notas?.paginacao?.pagina || pagina} · ${rows.length} notas exibidas`}
            selected={kpiId === 'nfs'}
            loading={loading}
            onClick={() => setKpiId('nfs')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Total NF"
            value={fmtBrl(total)}
            hint="Soma de todas as notas do recorte"
            selected={kpiId === 'total'}
            loading={loading}
            onClick={() => setKpiId('total')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Cobertura margem"
            value={pct != null ? `${pct}%` : '—'}
            hint={
              margensCov != null && pedidosCov != null
                ? `${margensCov}/${pedidosCov} pedidos`
                : undefined
            }
            badge={pct != null && pct < 100 ? 'Parcial' : null}
            valueTone={pct != null && pct < 100 ? 'caveat' : 'default'}
            selected={kpiId === 'cobertura'}
            loading={loading}
            onClick={() => setKpiId('cobertura')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Sem NF"
            value={gap?.sem_nf != null ? String(gap.sem_nf) : '—'}
            hint={
              [
                gap?.sem_nf_por_canal
                  ? Object.entries(gap.sem_nf_por_canal)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(' · ')
                  : null,
                hojeSemNf != null && hojeSemNf > 0 ? `${hojeSemNf} de hoje` : null,
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            }
            selected={kpiId === 'sem_nf'}
            loading={loading}
            onClick={() => setKpiId('sem_nf')}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: hubsBars.length && kpiId !== 'total' ? 5 : 12 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {kpiId === 'nfs'
                  ? 'NFs vs gaps · donut'
                  : kpiId === 'total'
                    ? 'Top NFs · valor'
                    : kpiId === 'cobertura'
                      ? 'Cobertura · gauge'
                      : 'Sem NF · por canal'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {kpiId === 'nfs'
                  ? 'Quantidade de notas face a pedidos sem NF · clique nos cards acima'
                  : kpiId === 'total'
                    ? 'Maiores totais na página de notas · clique nos cards acima'
                    : kpiId === 'cobertura'
                      ? 'Pedidos com vs sem margem/CMV · clique nos cards acima'
                      : 'Pedidos do período ainda sem nota · clique nos cards acima'}
              </Typography>
              <Box sx={{ width: '100%', height: { xs: 220, sm: 260 } }}>
                {kpiId === 'nfs' ? (
                  nfCountBars.some((b) => b.total > 0) ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={nfCountBars.filter((b) => b.total > 0)}
                          dataKey="total"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={82}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {nfCountBars
                            .filter((b) => b.total > 0)
                            .map((b) => (
                              <Cell key={b.name} fill={b.fill} />
                            ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [Number(value), 'Qtd']}
                          contentStyle={{
                            borderRadius: 8,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty title="Sem contagem de NFs/gaps." dense />
                  )
                ) : kpiId === 'total' ? (
                  topNfBars.length ? (
                    <ResponsiveContainer>
                      <BarChart
                        layout="vertical"
                        data={topNfBars}
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
                          formatter={(value) => [fmtBrl(Number(value)), 'Total']}
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
                    <ChartEmpty title="Sem NFs no período." dense />
                  )
                ) : kpiId === 'cobertura' ? (
                  <CoverageGauge
                    value={pct}
                    label="com CMV/margem"
                    hint={
                      coberturaBars.length
                        ? coberturaBars.map((b) => `${b.name}: ${b.total}`).join(' · ')
                        : undefined
                    }
                    height={240}
                  />
                ) : semNfPorCanal.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={semNfPorCanal}
                      margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
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
                        formatter={(value) => [Number(value), 'Sem NF']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={24}>
                        {semNfPorCanal.map((_, i) => (
                          <Cell key={i} fill={chart.pie[i % chart.pie.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty
                    title={
                      gap?.sem_nf === 0
                        ? 'Nenhum pedido sem NF neste período.'
                        : 'Sem breakdown por canal (ou zero gaps).'
                    }
                    hint={
                      gap?.sem_nf === 0
                        ? 'Cobertura fiscal completa neste filtro.'
                        : undefined
                    }
                    suggestPeriod={gap?.sem_nf !== 0}
                    dense
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {hubsBars.length && kpiId !== 'total' ? (
          <Grid size={{ xs: 12, md: 7 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ sm: 'center' }}
                  spacing={1}
                  sx={{ mb: 0.5 }}
                >
                  <Box>
                    <Typography variant="h6">Conciliação · por hub</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {concEscopoParcial
                        ? 'Matched e Sem NF filtram pelo canal; NF órfã é global do hub'
                        : 'Matched vs Sem NF vs NF órfã (S1)'}
                    </Typography>
                  </Box>
                  <Button
                    component="a"
                    href={conc?.s1_url || `${S1_APP_URL}/pedidos?aba=conciliacao`}
                    target="_blank"
                    rel="noreferrer"
                    size="small"
                    variant="outlined"
                    sx={{ textTransform: 'none', flexShrink: 0 }}
                  >
                    Abrir no S1
                  </Button>
                </Stack>
                <Box sx={{ width: '100%', height: { xs: 240, sm: 260 } }}>
                  <ResponsiveContainer>
                    <BarChart data={hubsBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="matched"
                        name="Matched"
                        fill={chart.line}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                      <Bar
                        dataKey="sem_nf"
                        name="Sem NF"
                        fill={theme.palette.warning.main}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                      <Bar
                        dataKey="nf_orfa"
                        name="NF órfã"
                        fill={theme.palette.error.main}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
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
              dominio="fiscal"
              fallback={{
                title:
                  gap?.sem_nf != null && gap.sem_nf > 0
                    ? `${gap.sem_nf} pedidos sem NF no período`
                    : `${totalNotas} NFs no período`,
                detail: 'Leitura fiscal — mesma verdade do painel Insights e do chat Hermes.',
                recommendations: [
                  {
                    title: 'Ver margens',
                    detail: 'NF sem CMV impede lucro por pedido.',
                    to: '/margens',
                  },
                  { title: 'Ver pedidos', detail: 'Cruzar status e canal.', to: '/pedidos' },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      {summaries.length ? (
        <Card sx={{ mb: 1.5 }}>
          <CardContent>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ sm: 'center' }}
              spacing={1}
              sx={{ mb: 1 }}
            >
              <Typography variant="h6">Conciliação S1 (tabela)</Typography>
              {!hubsBars.length ? (
                <Button
                  component="a"
                  href={conc?.s1_url || `${S1_APP_URL}/pedidos?aba=conciliacao`}
                  target="_blank"
                  rel="noreferrer"
                  size="small"
                  variant="outlined"
                  sx={{ textTransform: 'none' }}
                >
                  Abrir no S1
                </Button>
              ) : null}
            </Stack>
            {concEscopoParcial ? (
              <Alert severity="info" sx={{ mb: 1 }}>
                {conc?.escopo?.nota ||
                  'Com filtro de canal, Matched e Sem NF referem-se aos pedidos do canal; NFs e NF órfã continuam globais do hub.'}
              </Alert>
            ) : null}
            <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <Table size="small" sx={{ minWidth: 420 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Hub</TableCell>
                    <TableCell align="right">Matched</TableCell>
                    <TableCell align="right">Sem NF</TableCell>
                    <TableCell align="right">{concEscopoParcial ? 'NF órfã (global)' : 'NF órfã'}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summaries.map((s) => (
                    <TableRow key={String(s.hub || s.label || s.hub_label)}>
                      <TableCell>{String(s.label || s.hub_label || s.hub || '—')}</TableCell>
                      <TableCell align="right">{Number(s.matched ?? 0)}</TableCell>
                      <TableCell align="right">{Number(s.sem_nf ?? 0)}</TableCell>
                      <TableCell align="right">{Number(s.nf_orfa ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Notas fiscais
          </Typography>
          <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Número</TableCell>
                  <TableCell>Emissão</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Pedido</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((n) => (
                  <TableRow key={String(n._id || n.invoice_number)}>
                    <TableCell>
                      {n.invoice_number || '—'}
                      {n.invoice_serie ? `/${n.invoice_serie}` : ''}
                    </TableCell>
                    <TableCell>{fmtIsoDate(n.issuance_date)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {n.client?.nome || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {n.marketplace_order_id ? (
                        <Link
                          component={RouterLink}
                          to={`/pedidos?pedido=${encodeURIComponent(n.marketplace_order_id)}`}
                          underline="hover"
                          fontWeight={600}
                          title="Abrir este pedido"
                        >
                          {n.marketplace_order_id}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">{fmtBrl(Number(n.invoice_total || 0))}</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <ChartEmpty title="Sem NFs no período." dense />
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
              disabled={!notas?.paginacao?.hasPrevPage || loading}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Typography variant="caption" color="text.secondary">
              Página {notas?.paginacao?.pagina || pagina} de{' '}
              {notas?.paginacao?.totalPaginas || 1}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={!notas?.paginacao?.hasNextPage || loading}
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
