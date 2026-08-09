import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import {
  Area,
  AreaChart,
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
import { StatusFunnel } from '../components/StatusFunnel'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchMetricas,
  fetchPedidoDetalhe,
  fetchPedidosLista,
  fmtBrl,
  fmtIsoDate,
  S1_APP_URL,
  S2_APP_URL,
  type PedidoListItem,
  type PedidosLista,
  type PedidosMetricas,
} from '../api/bridge'

const STATUS_SAMPLE = 100

type KpiId = 'pedidos' | 'receita' | 'liquido' | 'frete'

function fmtAxis(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

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

export function PedidosPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { periodQuery, marketplace, data: overview } = useBiData()
  const { activeSourceId } = useBiSource()
  const [searchParams, setSearchParams] = useSearchParams()
  const pedidoParam = (searchParams.get('pedido') || searchParams.get('marketplace_id') || '').trim()

  const [lista, setLista] = useState<PedidosLista | null>(null)
  const [metricas, setMetricas] = useState<PedidosMetricas | null>(null)
  const [statusSample, setStatusSample] = useState<PedidoListItem[]>([])
  const [statusTotal, setStatusTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [draftPedido, setDraftPedido] = useState(pedidoParam)
  const [selected, setSelected] = useState<PedidoListItem | null>(null)
  const [kpiId, setKpiId] = useState<KpiId>('pedidos')
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [autoOpened, setAutoOpened] = useState(false)

  useEffect(() => {
    setDraftPedido(pedidoParam)
    setAutoOpened(false)
  }, [pedidoParam])

  const applyPedidoFilter = (value: string) => {
    const v = value.trim()
    setPagina(1)
    setAutoOpened(false)
    if (v) {
      setSearchParams({ pedido: v }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    const idFilter = pedidoParam || undefined
    const listPromise = fetchPedidosLista(periodQuery, idFilter ? undefined : marketplace || undefined, {
      pagina,
      limite: 25,
      marketplace_id: idFilter,
      semPeriodo: Boolean(idFilter),
    })
    const metricasPromise = fetchMetricas(periodQuery, marketplace || undefined).catch(() => null)
    const statusPromise = idFilter
      ? Promise.resolve(null)
      : fetchPedidosLista(periodQuery, marketplace || undefined, {
          pagina: 1,
          limite: STATUS_SAMPLE,
        }).catch(() => null)

    Promise.all([listPromise, metricasPromise, statusPromise])
      .then(([l, m, st]) => {
        setLista(l)
        setMetricas(m)
        if (st) {
          setStatusSample(st.pedidos || [])
          setStatusTotal(st.paginacao?.total ?? st.pedidos?.length ?? null)
        } else {
          setStatusSample([])
          setStatusTotal(null)
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar pedidos')
      })
      .finally(() => setLoading(false))
  }, [periodQuery, marketplace, pagina, pedidoParam, activeSourceId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (pedidoParam) return
    setPagina(1)
  }, [periodQuery, marketplace, pedidoParam, activeSourceId])

  const openDetail = useCallback((row: PedidoListItem) => {
    setSelected(row)
    setDetail(null)
    const id = row._id || row.marketplace_id
    if (!id) return
    setDetailLoading(true)
    fetchPedidoDetalhe(String(id))
      .then((r) => setDetail((r.pedido || {}) as Record<string, unknown>))
      .catch(() => setDetail(row as Record<string, unknown>))
      .finally(() => setDetailLoading(false))
  }, [])

  const rows = lista?.pedidos || []
  const pag = lista?.paginacao
  const m = metricas?.metricas
  const pedidosValidos = Number(overview?.pedidos || 0)
  const vendasValidas = Number(overview?.vendas || 0)
  const pedidosTotais = Number(metricas?.total_pedidos ?? m?.totalPedidos ?? 0)
  const receitaTotal = Number(metricas?.total_receita ?? m?.totalReceita ?? 0)
  const pedidosCancelados = Math.max(0, pedidosTotais - pedidosValidos)

  useEffect(() => {
    if (loading || autoOpened || !pedidoParam || rows.length !== 1) return
    setAutoOpened(true)
    openDetail(rows[0])
  }, [loading, autoOpened, pedidoParam, rows, openDetail])

  const dailyBars = useMemo(() => {
    const daily = overview?.daily || []
    return daily.map((d) => ({
      dia: d.dia,
      pedidos: Number(d.pedidos || 0),
      receita: Number(d.valor || 0),
    }))
  }, [overview?.daily])

  const statusBars = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of statusSample) {
      const label = labelStatus(String(p.order_status || ''))
      counts.set(label, (counts.get(label) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [statusSample])

  const statusAmostra =
    statusTotal != null && statusSample.length > 0 && statusTotal > statusSample.length

  const composicaoBars = useMemo(() => {
    const receita = Number(m?.totalReceita ?? metricas?.total_receita ?? 0)
    const taxas = Number(m?.totalTaxas ?? 0)
    const frete = Number(m?.totalFrete ?? 0)
    const liquido = Number(m?.totalLiquido ?? metricas?.total_liquido ?? 0)
    return [
      { name: 'Receita', valor: receita, fill: chart.pie[0] },
      { name: 'Taxas', valor: taxas, fill: chart.pie[3] || '#c2410c' },
      { name: 'Frete', valor: frete, fill: chart.pie[2] },
      { name: 'Líquido', valor: liquido, fill: chart.line },
    ]
  }, [m, metricas, chart])

  const freteFocusBars = useMemo(() => {
    const taxas = Number(m?.totalTaxas ?? 0)
    const frete = Number(m?.totalFrete ?? 0)
    const liquido = Number(m?.totalLiquido ?? metricas?.total_liquido ?? 0)
    return [
      { name: 'Frete', valor: frete, fill: chart.pie[2] },
      { name: 'Taxas', valor: taxas, fill: chart.pie[3] || '#c2410c' },
      { name: 'Líquido', valor: liquido, fill: chart.line },
    ]
  }, [m, metricas, chart])

  const primaryMeta = useMemo(() => {
    if (kpiId === 'receita') {
      return {
        title: 'Receita · por dia',
        caption: 'Receita válida diária · clique nos cards acima',
        mode: 'daily' as const,
        dataKey: 'receita' as const,
        money: true,
      }
    }
    if (kpiId === 'liquido') {
      return {
        title: 'Composição · líquido',
        caption: 'Receita, taxas, frete e líquido · clique nos cards acima',
        mode: 'composicao' as const,
        dataKey: 'pedidos' as const,
        money: true,
      }
    }
    if (kpiId === 'frete') {
      return {
        title: 'Frete · no líquido',
        caption: 'Frete face a taxas e líquido · clique nos cards acima',
        mode: 'frete' as const,
        dataKey: 'pedidos' as const,
        money: true,
      }
    }
    return {
      title: 'Pedidos · por dia',
      caption: 'Volume diário · clique nos cards acima',
      mode: 'daily' as const,
      dataKey: 'pedidos' as const,
      money: false,
    }
  }, [kpiId])

  const secondaryMeta = useMemo(() => {
    if (kpiId === 'pedidos') {
      return {
        title: 'Status · distribuição',
        caption: statusAmostra
          ? `Amostra dos primeiros ${statusSample.length} de ${statusTotal} pedidos`
          : 'Contagem por status no período',
        mode: 'status' as const,
      }
    }
    return {
      title: 'Composição · métricas',
      caption: 'Receita, taxas, frete e líquido do período',
      mode: 'composicao' as const,
    }
  }, [kpiId, statusAmostra, statusSample.length, statusTotal])

  const showCharts = !pedidoParam

  return (
    <DomainPageShell
      title="Pedidos"
      subtitle={
        lista?.periodo
          ? `${lista.periodo.inicio} → ${lista.periodo.fim} · clique num card para mudar os gráficos`
          : 'Leitura · clique num card para mudar os gráficos'
      }
      loading={loading}
      error={error}
      onRetry={load}
    >
      <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Pedidos válidos"
            value={String(pedidoParam ? pag?.total ?? rows.length : pedidosValidos)}
            hint={
              pedidoParam
                ? `Filtro ID: ${pedidoParam}`
                : `${pedidosTotais} totais · ${pedidosCancelados} cancelados`
            }
            selected={kpiId === 'pedidos'}
            loading={loading}
            onClick={() => setKpiId('pedidos')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Receita válida"
            value={fmtBrl(vendasValidas)}
            hint={`${fmtBrl(receitaTotal)} bruto incluindo cancelados`}
            selected={kpiId === 'receita'}
            loading={loading}
            onClick={() => setKpiId('receita')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Líquido"
            value={metricas?.total_liquido_fmt || '—'}
            hint={`Taxas ${fmtBrl(Number(m?.totalTaxas || 0))}`}
            selected={kpiId === 'liquido'}
            loading={loading}
            onClick={() => setKpiId('liquido')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Frete"
            value={fmtBrl(Number(m?.totalFrete || 0))}
            hint="Agregado das métricas de pedidos"
            selected={kpiId === 'frete'}
            loading={loading}
            onClick={() => setKpiId('frete')}
          />
        </Grid>
      </Grid>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <TextField
            size="small"
            label="ID marketplace"
            placeholder="Ex.: MLB… ou ID Shopee/Shein"
            value={draftPedido}
            onChange={(e) => setDraftPedido(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyPedidoFilter(draftPedido)
            }}
            sx={{ minWidth: { sm: 280 } }}
          />
          <Button size="small" variant="contained" onClick={() => applyPedidoFilter(draftPedido)}>
            Buscar
          </Button>
          {pedidoParam ? (
            <Button size="small" variant="outlined" onClick={() => applyPedidoFilter('')}>
              Limpar filtro
            </Button>
          ) : null}
        </Stack>
        <Button
          size="small"
          href={`${S2_APP_URL}/dashboard-pedidos`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ textTransform: 'none' }}
        >
          Abrir no Financial
        </Button>
      </Stack>

      {pedidoParam ? (
        <Alert severity="info" variant="outlined" sx={{ mb: 1 }}>
          A mostrar pedidos com ID <strong>{pedidoParam}</strong> (sem filtrar pelo período do
          painel, para achar o pedido vindo do Fiscal).
        </Alert>
      ) : null}

      {showCharts ? (
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
                      {primaryMeta.mode === 'daily' ? (
                        dailyBars.length ? (
                          <ResponsiveContainer>
                            <AreaChart
                              data={dailyBars}
                              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="pedidosDailyFill" x1="0" y1="0" x2="0" y2="1">
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
                                tickFormatter={primaryMeta.money ? fmtAxis : undefined}
                                allowDecimals={false}
                                tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                                axisLine={false}
                                tickLine={false}
                                width={44}
                              />
                              <Tooltip
                                formatter={(value) =>
                                  primaryMeta.money
                                    ? [fmtBrl(Number(value)), 'Receita']
                                    : [Number(value), 'Pedidos']
                                }
                                contentStyle={{
                                  borderRadius: 8,
                                  border: `1px solid ${theme.palette.divider}`,
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey={primaryMeta.dataKey}
                                stroke={chart.line}
                                fill="url(#pedidosDailyFill)"
                                strokeWidth={2.5}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <ChartEmpty title="Sem série diária neste período." dense />
                        )
                      ) : (
                        (() => {
                          const bars =
                            primaryMeta.mode === 'frete' ? freteFocusBars : composicaoBars
                          return bars.some((b) => b.valor !== 0) ? (
                            <ResponsiveContainer>
                              <BarChart
                                data={bars}
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
                                />
                                <YAxis
                                  tickFormatter={fmtAxis}
                                  tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                                  axisLine={false}
                                  tickLine={false}
                                  width={44}
                                />
                                <Tooltip
                                  formatter={(value) => [fmtBrl(Number(value)), 'R$']}
                                  contentStyle={{
                                    borderRadius: 8,
                                    border: `1px solid ${theme.palette.divider}`,
                                  }}
                                />
                                <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={52}>
                                  {bars.map((b) => (
                                    <Cell key={b.name} fill={b.fill} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <ChartEmpty title="Sem métricas neste período." dense />
                          )
                        })()
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 5 }}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {secondaryMeta.mode === 'status' ? 'Status · funil' : 'Composição · donut'}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      {secondaryMeta.caption}
                    </Typography>
                    <Box sx={{ width: '100%', height: { xs: 220, sm: 260 } }}>
                      {secondaryMeta.mode === 'status' ? (
                        <StatusFunnel data={statusBars} />
                      ) : composicaoBars.some((b) => b.valor !== 0) ? (
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={composicaoBars}
                              dataKey="valor"
                              nameKey="name"
                              innerRadius={52}
                              outerRadius={78}
                              paddingAngle={2}
                              stroke="none"
                            >
                              {composicaoBars.map((b) => (
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
                        <ChartEmpty title="Sem composição neste período." dense />
                      )}
                    </Box>
                    {secondaryMeta.mode !== 'status' &&
                    composicaoBars.some((b) => b.valor !== 0) ? (
                      <Stack spacing={0.4} sx={{ mt: 1 }}>
                        {composicaoBars.map((b) => (
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
                dominio="comercial"
                fallback={{
                  title: `${pedidosValidos} pedidos válidos · ${fmtBrl(vendasValidas)}`,
                  detail: 'Leitura comercial do período — mesma verdade do chat Hermes.',
                  recommendations: [
                    { title: 'Ver fiscal', detail: 'Cobertura NF e sem NF.', to: '/fiscal' },
                    { title: 'Ver margens', detail: 'CMV e lucro por pedido.', to: '/margens' },
                  ],
                }}
              />
            </Box>
          </Grid>
        </Grid>
      ) : (
        <Box
          sx={{
            mb: 2,
            display: 'flex',
            justifyContent: { xs: 'stretch', lg: 'flex-end' },
          }}
        >
          <AiInsightPanel
            dominio="comercial"
            fallback={{
              title: `${pedidosValidos} pedidos válidos · ${fmtBrl(vendasValidas)}`,
              detail: 'Leitura comercial do período — mesma verdade do chat Hermes.',
              recommendations: [
                { title: 'Ver fiscal', detail: 'Cobertura NF e sem NF.', to: '/fiscal' },
                { title: 'Ver margens', detail: 'CMV e lucro por pedido.', to: '/margens' },
              ],
            }}
          />
        </Box>
      )}

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Lista do período</Typography>
            <Typography variant="caption" color="text.secondary">
              {pag?.total != null ? `${pag.total} total` : `${rows.length} linhas`}
            </Typography>
          </Stack>
          <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell>Canal</TableCell>
                  <TableCell>ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Produto</TableCell>
                  <TableCell align="right">Receita</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p) => {
                  const prod = p.order_products?.[0]?.descricao_produto || '—'
                  const mid = String(p.marketplace_id || '')
                  const highlight = Boolean(pedidoParam && mid === pedidoParam)
                  return (
                    <TableRow
                      key={String(p._id || p.marketplace_id)}
                      hover
                      selected={highlight}
                      sx={highlight ? { bgcolor: 'action.selected' } : undefined}
                    >
                      <TableCell>{fmtIsoDate(p.order_date)}</TableCell>
                      <TableCell>{p.marketplace_name || '—'}</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ maxWidth: 140, fontWeight: highlight ? 700 : 400 }}
                        >
                          {p.marketplace_id || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={p.order_status || '—'} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 220 }} title={prod}>
                          {prod}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{fmtBrl(Number(p.order_revenue || 0))}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => openDetail(p)} sx={{ textTransform: 'none' }}>
                          Detalhe
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      {pedidoParam ? (
                        <Stack spacing={0.75}>
                          <Typography color="text.secondary">
                            Nenhum pedido com este ID no Financial.
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Causas típicas: sync Shopee/Shein ainda não trouxe o pedido (NF UpSeller
                            pode chegar antes), pedido cancelado fora do ETL, ou ID só existe na NF.
                            Experimenta Actualizar no API (S1) ou abrir o Financial; o BI já procura
                            variantes SH-/SN- e pack_id.
                          </Typography>
                          <Button
                            size="small"
                            href={`${S1_APP_URL}/marketplaces`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                          >
                            Abrir sync no API (S1)
                          </Button>
                        </Stack>
                      ) : (
                        <ChartEmpty title="Sem pedidos no período." dense />
                      )}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>

          {!pedidoParam ? (
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
              <Button
                size="small"
                disabled={!pag?.hasPrevPage && pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                Pág. {pag?.pagina ?? pagina}
                {pag?.totalPaginas ? ` / ${pag.totalPaginas}` : ''}
              </Typography>
              <Button
                size="small"
                disabled={pag?.hasNextPage === false}
                onClick={() => setPagina((p) => p + 1)}
              >
                Seguinte
              </Button>
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Pedido {selected?.marketplace_id || ''}</DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Typography color="text.secondary">A carregar…</Typography>
          ) : (
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Canal:</strong>{' '}
                {String(detail?.marketplace_name || selected?.marketplace_name || '—')}
              </Typography>
              <Typography variant="body2">
                <strong>Status:</strong> {String(detail?.order_status || selected?.order_status || '—')}
              </Typography>
              <Typography variant="body2">
                <strong>Data:</strong>{' '}
                {fmtIsoDate(String(detail?.order_date || selected?.order_date || ''))}
              </Typography>
              <Typography variant="body2">
                <strong>Receita:</strong>{' '}
                {fmtBrl(Number(detail?.order_revenue ?? selected?.order_revenue ?? 0))}
              </Typography>
              <Typography variant="body2">
                <strong>Taxas:</strong>{' '}
                {fmtBrl(Number(detail?.marketplace_fees ?? selected?.marketplace_fees ?? 0))}
              </Typography>
              <Typography variant="body2">
                <strong>Frete:</strong>{' '}
                {fmtBrl(
                  Number(
                    detail?.marketplace_shipping_cost ?? selected?.marketplace_shipping_cost ?? 0,
                  ),
                )}
              </Typography>
              {(
                (detail?.order_products as PedidoListItem['order_products']) ||
                selected?.order_products ||
                []
              ).map((op, i) => (
                <Typography key={i} variant="body2" color="text.secondary">
                  · {op.descricao_produto} × {op.quantidade} — {fmtBrl(Number(op.preco_total || 0))}
                </Typography>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/fiscal" size="small" sx={{ textTransform: 'none' }}>
              Fiscal
            </Button>
            <Button component={RouterLink} to="/margens" size="small" sx={{ textTransform: 'none' }}>
              Margens
            </Button>
            <Button
              size="small"
              href={`${S2_APP_URL}/dashboard-pedidos`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: 'none' }}
            >
              Abrir no Financial
            </Button>
          </Stack>
          <Button onClick={() => setSelected(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </DomainPageShell>
  )
}
