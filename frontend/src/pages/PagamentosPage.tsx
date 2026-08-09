import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
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
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
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
  fetchMetricas,
  fetchPagamentos,
  fmtBrl,
  fmtIsoDate,
  S2_APP_URL,
  type PagamentosLista,
  type PedidosMetricas,
} from '../api/bridge'

type KpiId = 'receita' | 'taxas' | 'liquido' | 'registros'

function cell(v: unknown): string {
  if (v == null || v === '') return '—'
  if (typeof v === 'number') return String(v)
  return String(v)
}

function money(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? fmtBrl(n) : '—'
}

function dateCell(v: unknown): string {
  if (!v) return '—'
  try {
    return fmtIsoDate(String(v).slice(0, 10))
  } catch {
    return String(v).slice(0, 10)
  }
}

function shortLabel(text: string, max = 22): string {
  const t = (text || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function fmtAxis(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

export function PagamentosPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { periodQuery, marketplace, data: overview } = useBiData()
  const { activeSourceId } = useBiSource()
  const [lista, setLista] = useState<PagamentosLista | null>(null)
  const [metricas, setMetricas] = useState<PedidosMetricas | null>(null)
  const [sample, setSample] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [kpiId, setKpiId] = useState<KpiId>('receita')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchPagamentos(periodQuery, { pagina, limite: 25 }).catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar pagamentos')
        return null
      }),
      fetchMetricas(periodQuery, marketplace || undefined).catch(() => null),
      fetchPagamentos(periodQuery, { pagina: 1, limite: 100 }).catch(() => null),
    ])
      .then(([l, m, sm]) => {
        setLista(l)
        setMetricas(m)
        setSample(sm?.pagamentos || [])
        if (l) setError(null)
      })
      .finally(() => setLoading(false))
  }, [periodQuery, marketplace, pagina, activeSourceId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPagina(1)
  }, [periodQuery, marketplace, activeSourceId])

  const rows = lista?.pagamentos || []
  const pag = lista?.paginacao
  const total = pag?.total ?? rows.length
  const pages = pag?.pages ?? 1
  const m = metricas?.metricas
  const vendasValidas = Number(overview?.vendas || 0)
  const receitaBruta = Number(metricas?.total_receita ?? m?.totalReceita ?? 0)

  const composicaoBars = useMemo(() => {
    const receita = Number(m?.totalReceita ?? metricas?.total_receita ?? 0)
    const taxas = Number(m?.totalTaxas ?? 0)
    const liquido = Number(m?.totalLiquido ?? metricas?.total_liquido ?? 0)
    const frete = Number(m?.totalFrete ?? 0)
    return [
      { name: 'Receita', valor: receita, fill: chart.pie[0] },
      { name: 'Taxas', valor: taxas, fill: chart.pie[3] || '#c2410c' },
      { name: 'Líquido', valor: liquido, fill: chart.line },
      { name: 'Frete', valor: frete, fill: chart.pie[2] },
    ]
  }, [m, metricas, chart])

  const taxasFocusBars = useMemo(() => {
    const receita = Number(m?.totalReceita ?? metricas?.total_receita ?? 0)
    const taxas = Number(m?.totalTaxas ?? 0)
    const liquido = Number(m?.totalLiquido ?? metricas?.total_liquido ?? 0)
    return [
      { name: 'Taxas', valor: taxas, fill: chart.pie[3] || '#c2410c' },
      { name: 'Receita', valor: receita, fill: chart.pie[0] },
      { name: 'Líquido', valor: liquido, fill: chart.line },
    ]
  }, [m, metricas, chart])

  const dailySeries = useMemo(
    () =>
      (overview?.daily || []).map((d) => ({
        dia: d.dia.slice(5),
        receita: d.valor,
        pedidos: d.pedidos,
      })),
    [overview?.daily],
  )

  const formaBars = useMemo(() => {
    const counts = new Map<string, { total: number; valor: number }>()
    for (const p of sample) {
      const forma = String(p.forma_pagamento || p.gateway_pagamento || 'Outro').trim() || 'Outro'
      const cur = counts.get(forma) || { total: 0, valor: 0 }
      cur.total += 1
      cur.valor += Number(p.valor_total ?? p.valor ?? 0) || 0
      counts.set(forma, cur)
    }
    return [...counts.entries()]
      .map(([name, v]) => ({
        name: shortLabel(name),
        full: name,
        total: v.total,
        valor: v.valor,
      }))
      .sort((a, b) => b.valor - a.valor || b.total - a.total)
      .slice(0, 8)
  }, [sample])

  const statusBars = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of sample) {
      const st = String(p.status || 'Sem status').trim() || 'Sem status'
      counts.set(st, (counts.get(st) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, qtd]) => ({ name: shortLabel(name, 18), full: name, total: qtd }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [sample])

  const leftBars = kpiId === 'taxas' ? taxasFocusBars : composicaoBars

  return (
    <DomainPageShell
      title="Pagamentos"
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
            label="Receita válida"
            value={fmtBrl(vendasValidas)}
            hint={`${fmtBrl(receitaBruta)} bruto incluindo cancelados`}
            selected={kpiId === 'receita'}
            loading={loading}
            onClick={() => setKpiId('receita')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Taxas"
            value={fmtBrl(Number(m?.totalTaxas || 0))}
            hint="Marketplace fees"
            selected={kpiId === 'taxas'}
            loading={loading}
            onClick={() => setKpiId('taxas')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Líquido"
            value={metricas?.total_liquido_fmt || '—'}
            hint={`Frete ${fmtBrl(Number(m?.totalFrete || 0))}`}
            selected={kpiId === 'liquido'}
            loading={loading}
            onClick={() => setKpiId('liquido')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Registros S2"
            value={String(total)}
            hint={total === 0 ? 'Coleção pagamentos vazia' : 'Lançamentos no extrato'}
            selected={kpiId === 'registros'}
            loading={loading}
            onClick={() => setKpiId('registros')}
          />
        </Grid>
      </Grid>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            component={RouterLink}
            to="/pedidos"
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            Ver pedidos
          </Button>
          <Button
            component={RouterLink}
            to="/fretes"
            size="small"
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            Fretes
          </Button>
        </Stack>
        <Button
          component="a"
          href={`${S2_APP_URL}/pagamentos`}
          target="_blank"
          rel="noreferrer"
          size="small"
          variant="outlined"
          sx={{ textTransform: 'none' }}
        >
          Abrir no Financial
        </Button>
      </Stack>

      {total === 0 ? (
        <Alert severity="info" variant="outlined" sx={{ mb: 1.5 }}>
          A coleção de pagamentos do Financial está vazia neste período. Os KPIs e gráficos abaixo usam
          receita / taxas / líquido dos pedidos (mesma fonte da Rica IA). O extrato linha a linha
          continua no S2 quando houver lançamentos.
        </Alert>
      ) : null}

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {kpiId === 'taxas'
                  ? 'Fluxo · taxas × receita'
                  : kpiId === 'liquido'
                    ? 'Fluxo · líquido'
                    : kpiId === 'registros'
                      ? 'Fluxo · referência'
                      : 'Fluxo · receita × taxas × líquido'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Barras + linha · métricas de pedidos · clique nos cards acima
              </Typography>
              <Box sx={{ width: '100%', height: { xs: 220, sm: 260 } }}>
                {leftBars.some((b) => b.valor !== 0) ? (
                  <ResponsiveContainer>
                    <ComposedChart data={leftBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                      <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={48}>
                        {leftBars.map((b) => (
                          <Cell key={b.name} fill={b.fill} />
                        ))}
                      </Bar>
                      {leftBars.length >= 2 ? (
                        <Line
                          type="monotone"
                          dataKey="valor"
                          stroke={chart.line}
                          strokeWidth={2}
                          dot={{ r: 3, fill: chart.line }}
                          activeDot={{ r: 5 }}
                        />
                      ) : null}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem métricas no período." dense />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {kpiId === 'registros' && statusBars.length
                  ? 'Extrato S2 · por status'
                  : kpiId === 'registros' && formaBars.length
                    ? 'Extrato S2 · por forma'
                    : 'Receita · por dia'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {kpiId === 'registros' && (statusBars.length || formaBars.length)
                  ? 'Amostra até 100 lançamentos da coleção pagamentos'
                  : 'Fluxo diário de receita válida · clique nos cards acima'}
              </Typography>
              <Box sx={{ width: '100%', height: { xs: 220, sm: 260 } }}>
                {kpiId === 'registros' && statusBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={statusBars}
                      margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
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
                        width={110}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [Number(value), 'Registos']}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as { full?: string } | undefined
                          return row?.full || ''
                        }}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={22}>
                        {statusBars.map((_, i) => (
                          <Cell key={i} fill={chart.pie[i % chart.pie.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : kpiId === 'registros' && formaBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={formaBars}
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
                        width={120}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value, _n, item) => {
                          const t = (item?.payload as { total?: number } | undefined)?.total
                          return [
                            `${fmtBrl(Number(value))}${t != null ? ` · ${t} reg.` : ''}`,
                            'Valor',
                          ]
                        }}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as { full?: string } | undefined
                          return row?.full || ''
                        }}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar dataKey="valor" fill={chart.pie[1]} radius={[0, 6, 6, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : dailySeries.length ? (
                  <ResponsiveContainer>
                    <AreaChart data={dailySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pagReceita" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chart.line} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={chart.line} stopOpacity={0.02} />
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
                        formatter={(value) => [fmtBrl(Number(value)), 'Receita']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="receita"
                        stroke={chart.line}
                        fill="url(#pagReceita)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty
                    title={
                      kpiId === 'registros'
                        ? 'Sem lançamentos S2 — mostra a série de receita quando houver dados.'
                        : 'Sem série diária no período.'
                    }
                    dense
                  />
                )}
              </Box>
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
                title: `${fmtBrl(vendasValidas)} de receita válida`,
                detail: `Taxas ${fmtBrl(Number(m?.totalTaxas || 0))} · líquido ${
                  metricas?.total_liquido_fmt || '—'
                }.`,
                recommendations: [
                  { title: 'Ver fretes', detail: 'Avaliar impacto logístico no líquido.', to: '/fretes' },
                  { title: 'Ver margens', detail: 'Cruzar taxas, CMV e resultado.', to: '/margens' },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {formaBars.length && kpiId !== 'registros' ? (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Extrato S2 · por forma
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Amostra até 100 lançamentos da coleção pagamentos
                </Typography>
                <Box sx={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={formaBars}
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
                        width={120}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value, _n, item) => {
                          const t = (item?.payload as { total?: number } | undefined)?.total
                          return [
                            `${fmtBrl(Number(value))}${t != null ? ` · ${t} reg.` : ''}`,
                            'Valor',
                          ]
                        }}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as { full?: string } | undefined
                          return row?.full || ''
                        }}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar dataKey="valor" fill={chart.pie[1]} radius={[0, 6, 6, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ) : null}
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Extrato (S2)
          </Typography>
          <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Número</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Forma</TableCell>
                  <TableCell>Pagamento</TableCell>
                  <TableCell align="right">Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p, i) => (
                  <TableRow key={String(p._id || p.numero_pagamento || i)} hover>
                    <TableCell>{cell(p.numero_pagamento || p.codigo_transacao)}</TableCell>
                    <TableCell>{cell(p.status)}</TableCell>
                    <TableCell>{cell(p.forma_pagamento || p.gateway_pagamento)}</TableCell>
                    <TableCell>{dateCell(p.data_pagamento)}</TableCell>
                    <TableCell align="right">{money(p.valor_total ?? p.valor)}</TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <ChartEmpty
                        title="Sem lançamentos de pagamento no S2 — usa os KPIs de líquido acima."
                        hint="Os totais de receita/taxas/líquido nos cards vêm das métricas de pedidos."
                        suggestPeriod={false}
                        dense
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>

          {total > 0 ? (
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button
                size="small"
                disabled={pagina <= 1 || loading}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                size="small"
                disabled={loading || pagina >= (pages || 1)}
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </Button>
            </Stack>
          ) : null}
        </CardContent>
      </Card>
    </DomainPageShell>
  )
}
