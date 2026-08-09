import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
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
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
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
import { channelNameToId, fmtBrl } from '../api/bridge'

type CardId = 'vendas' | 'liquido' | 'pedidos' | 'ticket'

function fmtAxis(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

function shortLabel(text: string, max = 32): string {
  const t = (text || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function deltaLabel(pct: number | null | undefined): string | undefined {
  if (pct == null || !Number.isFinite(pct)) return undefined
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}% vs período anterior`
}

export function VendasPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { data, loading, error, refresh, marketplace, marketplaceOptions, setMarketplace } =
    useBiData()
  const [selected, setSelected] = useState<CardId>('vendas')

  const canalLabel =
    marketplaceOptions.find((o) => o.id === marketplace)?.label || 'Todos os canais'

  const selectCanal = (name: string) => {
    const id = channelNameToId(name)
    if (!id) return
    setMarketplace(marketplace === id ? '' : id)
  }

  const ticketMedio = data && data.pedidos > 0 ? data.vendas / data.pedidos : 0
  const ticketAnterior =
    data?.prevVendas != null && data.prevPedidos && data.prevPedidos > 0
      ? data.prevVendas / data.prevPedidos
      : null

  const series = useMemo(() => {
    const daily = data?.daily?.length ? data.daily : []
    return daily.map((d) => ({
      ...d,
      ticket: d.pedidos > 0 ? d.valor / d.pedidos : 0,
    }))
  }, [data?.daily])

  const liquidoComposicao = useMemo(() => {
    if (!data) return []
    return [
      { name: 'Receita', valor: data.vendas, fill: chart.pie[0] },
      { name: 'Taxas', valor: data.taxas, fill: chart.pie[3] || '#c2410c' },
      { name: 'Frete', valor: data.frete, fill: chart.pie[2] },
      { name: 'Líquido', valor: data.liquido, fill: chart.line },
    ]
  }, [data, chart])

  const trendMeta = useMemo(() => {
    const map: Record<
      CardId,
      { title: string; caption: string; dataKey: 'valor' | 'pedidos' | 'ticket'; mode: 'area' | 'composicao' }
    > = {
      vendas: {
        title: 'Tendência · vendas brutas',
        caption: 'Receita válida por dia (sem cancelados) · clique nos cards acima',
        dataKey: 'valor',
        mode: 'area',
      },
      liquido: {
        title: 'Composição · líquido',
        caption: 'Receita − taxas − frete (sem série diária de líquido) · clique nos cards acima',
        dataKey: 'valor',
        mode: 'composicao',
      },
      pedidos: {
        title: 'Tendência · pedidos',
        caption: 'Pedidos válidos por dia · clique nos cards acima',
        dataKey: 'pedidos',
        mode: 'area',
      },
      ticket: {
        title: 'Tendência · ticket médio',
        caption: 'Vendas ÷ pedidos por dia · clique nos cards acima',
        dataKey: 'ticket',
        mode: 'area',
      },
    }
    return map[selected]
  }, [selected])

  const comparacaoBars = useMemo(() => {
    if (!data) return []
    if (selected === 'vendas') {
      if (data.prevVendas == null && data.vendas === 0) return []
      return [
        { name: 'Actual', valor: data.vendas, fill: chart.line },
        { name: 'Anterior', valor: Number(data.prevVendas || 0), fill: chart.pie[2] },
      ]
    }
    if (selected === 'pedidos') {
      if (data.prevPedidos == null && data.pedidos === 0) return []
      return [
        { name: 'Actual', valor: data.pedidos, fill: chart.line },
        { name: 'Anterior', valor: Number(data.prevPedidos || 0), fill: chart.pie[2] },
      ]
    }
    if (selected === 'ticket') {
      if (ticketAnterior == null && ticketMedio === 0) return []
      return [
        { name: 'Actual', valor: ticketMedio, fill: chart.line },
        { name: 'Anterior', valor: Number(ticketAnterior || 0), fill: chart.pie[2] },
      ]
    }
    // líquido — sem período anterior dedicado: mostra taxas vs frete vs líquido
    return [
      { name: 'Taxas', valor: data.taxas, fill: chart.pie[3] || '#c2410c' },
      { name: 'Frete', valor: data.frete, fill: chart.pie[2] },
      { name: 'Líquido', valor: data.liquido, fill: chart.line },
    ]
  }, [data, selected, chart, ticketMedio, ticketAnterior])

  const comparacaoMeta = useMemo(() => {
    if (selected === 'vendas') {
      return {
        title: 'Comparação · vendas',
        caption: deltaLabel(data?.deltaVendasPct) || 'Actual vs período anterior',
        money: true,
      }
    }
    if (selected === 'pedidos') {
      return {
        title: 'Comparação · pedidos',
        caption: deltaLabel(data?.deltaPedidosPct) || 'Actual vs período anterior',
        money: false,
      }
    }
    if (selected === 'ticket') {
      return {
        title: 'Comparação · ticket',
        caption: 'Ticket actual vs anterior (vendas ÷ pedidos)',
        money: true,
      }
    }
    return {
      title: 'Composição · custos no líquido',
      caption: 'Taxas, frete e líquido do período',
      money: true,
    }
  }, [selected, data?.deltaVendasPct, data?.deltaPedidosPct])

  const canalBars = useMemo(() => {
    const rows = data?.canais || []
    return [...rows]
      .sort((a, b) => {
        if (selected === 'pedidos') return b.pedidos - a.pedidos
        if (selected === 'ticket') {
          const ta = a.pedidos > 0 ? a.value / a.pedidos : 0
          const tb = b.pedidos > 0 ? b.value / b.pedidos : 0
          return tb - ta
        }
        return b.value - a.value
      })
      .map((c) => {
        const ticket = c.pedidos > 0 ? c.value / c.pedidos : 0
        const metric =
          selected === 'pedidos' ? c.pedidos : selected === 'ticket' ? ticket : c.value
        return {
          name: shortLabel(c.name, 18),
          full: c.name,
          metric,
          receita: c.value,
          pedidos: c.pedidos,
          ticket,
        }
      })
  }, [data?.canais, selected])

  const canalMeta = useMemo(() => {
    if (selected === 'pedidos') {
      return { title: 'Por canal · pedidos', caption: 'Clique para filtrar o painel', money: false }
    }
    if (selected === 'ticket') {
      return { title: 'Por canal · ticket médio', caption: 'Clique para filtrar o painel', money: true }
    }
    if (selected === 'liquido') {
      return {
        title: 'Por canal · receita',
        caption: 'Líquido sem breakdown diário por canal — mostra receita · clique para filtrar',
        money: true,
      }
    }
    return { title: 'Por canal · receita', caption: 'Clique para filtrar o painel', money: true }
  }, [selected])

  const topSkuBars = useMemo(
    () =>
      [...(data?.topSkus || [])]
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 8)
        .map((s) => ({
          name: shortLabel(s.descricao || s.sku),
          full: s.descricao || s.sku,
          receita: s.receita,
          qtd: s.quantidade,
          sku: s.sku,
        })),
    [data?.topSkus],
  )

  const formatTrendTooltip = (value: number) => {
    if (selected === 'pedidos') return [Number(value), 'Pedidos'] as const
    return [fmtBrl(Number(value)), selected === 'ticket' ? 'Ticket' : 'Vendas'] as const
  }

  return (
    <DomainPageShell
      title="Vendas"
      subtitle={
        data?.rangeLabel
          ? `${data.rangeLabel} · clique num card para mudar os gráficos`
          : 'Tendência, canais, comparação e top produtos'
      }
      loading={loading && !data}
      error={error}
      onRetry={refresh}
    >
      <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 1 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Vendas brutas"
            value={data?.vendasFmt ?? '—'}
            hint="Pedidos válidos (sem cancelados)"
            deltaPct={data?.deltaVendasPct}
            selected={selected === 'vendas'}
            loading={loading}
            onClick={() => setSelected('vendas')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Líquido"
            value={data?.liquidoFmt ?? '—'}
            hint={data ? `Taxas ${data.taxasFmt}` : undefined}
            selected={selected === 'liquido'}
            loading={loading}
            onClick={() => setSelected('liquido')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Pedidos"
            value={data ? String(data.pedidos) : '—'}
            hint={marketplace ? canalLabel : 'Todos os canais'}
            deltaPct={data?.deltaPedidosPct}
            selected={selected === 'pedidos'}
            loading={loading}
            onClick={() => setSelected('pedidos')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Ticket médio"
            value={data ? fmtBrl(ticketMedio) : '—'}
            hint={marketplace ? canalLabel : 'Todos os canais'}
            selected={selected === 'ticket'}
            loading={loading}
            onClick={() => setSelected('ticket')}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 0.5 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {trendMeta.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {trendMeta.caption}
                  </Typography>
                  <Box sx={{ width: '100%', height: { xs: 240, sm: 300 } }}>
                    {trendMeta.mode === 'composicao' ? (
                      liquidoComposicao.some((b) => b.valor !== 0) ? (
                        <ResponsiveContainer>
                          <BarChart
                            data={liquidoComposicao}
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
                              {liquidoComposicao.map((b) => (
                                <Cell key={b.name} fill={b.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ChartEmpty title="Sem composição de líquido no período." />
                      )
                    ) : series.length ? (
                      <ResponsiveContainer>
                        <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="vendasFill" x1="0" y1="0" x2="0" y2="1">
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
                            formatter={(value) => [...formatTrendTooltip(Number(value))]}
                            contentStyle={{
                              borderRadius: 8,
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey={trendMeta.dataKey}
                            stroke={chart.line}
                            fill="url(#vendasFill)"
                            strokeWidth={2.5}
                            activeDot={{ r: 5, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmpty title="Sem série diária no período." />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {comparacaoMeta.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {comparacaoMeta.caption}
                  </Typography>
                  <Box sx={{ width: '100%', height: { xs: 200, sm: 240 } }}>
                    {comparacaoBars.some((b) => b.valor !== 0) ? (
                      <ResponsiveContainer>
                        <ComposedChart
                          data={comparacaoBars}
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
                            formatter={(value) => [
                              comparacaoMeta.money ? fmtBrl(Number(value)) : Number(value),
                              selected === 'pedidos' ? 'Pedidos' : 'R$',
                            ]}
                            contentStyle={{
                              borderRadius: 8,
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          />
                          <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={56}>
                            {comparacaoBars.map((b) => (
                              <Cell key={b.name} fill={b.fill} />
                            ))}
                          </Bar>
                          {comparacaoBars.length >= 2 && selected !== 'liquido' ? (
                            <Line
                              type="monotone"
                              dataKey="valor"
                              stroke={theme.palette.secondary.main}
                              strokeWidth={2}
                              dot={{ r: 4 }}
                            />
                          ) : null}
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmpty title="Sem comparação disponível." dense />
                    )}
                  </Box>
                  {selected === 'vendas' && data?.prevVendasFmt ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Anterior: {data.prevVendasFmt}
                      {data.prevPedidos != null ? ` · ${data.prevPedidos} pedidos` : ''}
                    </Typography>
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
                title: data
                  ? `${data.vendasFmt} em ${data.pedidos} pedidos`
                  : 'Insight comercial do período',
                detail: 'Leitura de vendas, canais e ticket — a mesma verdade do chat Hermes.',
                recommendations: [
                  { title: 'Ver pedidos', detail: 'Funil e pedidos do período.', to: '/pedidos' },
                  { title: 'Ver produtos', detail: 'Mix e SKUs que puxam a receita.', to: '/produtos' },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {selected === 'vendas' || selected === 'liquido'
                  ? 'Por canal · donut'
                  : canalMeta.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {canalMeta.caption}
                {marketplace ? ` · activo: ${canalLabel}` : ''}
              </Typography>
              <Box sx={{ width: '100%', height: { xs: 240, sm: 280 } }}>
                {canalBars.length ? (
                  selected === 'vendas' || selected === 'liquido' ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={canalBars}
                          dataKey="metric"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={2}
                          stroke="none"
                          cursor="pointer"
                          onClick={(_, index) => {
                            const full = canalBars[index]?.full
                            if (full) selectCanal(full)
                          }}
                        >
                          {canalBars.map((c, i) => {
                            const id = channelNameToId(c.full)
                            const dim = marketplace && id !== marketplace
                            return (
                              <Cell
                                key={c.full}
                                fill={chart.pie[i % chart.pie.length]}
                                opacity={dim ? 0.35 : 1}
                              />
                            )
                          })}
                        </Pie>
                        <Tooltip
                          formatter={(value, _n, item) => {
                            const p = item?.payload as
                              | { pedidos?: number; full?: string }
                              | undefined
                            const extra = p?.pedidos != null ? ` · ${p.pedidos} ped.` : ''
                            return [`${fmtBrl(Number(value))}${extra}`, p?.full || 'Receita']
                          }}
                          contentStyle={{
                            borderRadius: 8,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer>
                      <BarChart
                        layout="vertical"
                        data={canalBars}
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
                          formatter={(value, _n, item) => {
                            const p = item?.payload as
                              | { pedidos?: number; receita?: number }
                              | undefined
                            if (selected === 'pedidos') {
                              return [Number(value), 'Pedidos']
                            }
                            const extra =
                              p?.pedidos != null ? ` · ${p.pedidos} ped.` : ''
                            return [
                              `${canalMeta.money ? fmtBrl(Number(value)) : Number(value)}${extra}`,
                              selected === 'ticket' ? 'Ticket' : 'Receita',
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
                        <Bar
                          dataKey="metric"
                          radius={[0, 6, 6, 0]}
                          maxBarSize={22}
                          cursor="pointer"
                          onClick={(row) => {
                            const full = (row as { full?: string } | undefined)?.full
                            if (full) selectCanal(full)
                          }}
                        >
                          {canalBars.map((c, i) => {
                            const id = channelNameToId(c.full)
                            const dim = marketplace && id !== marketplace
                            return (
                              <Cell
                                key={c.full}
                                fill={chart.pie[i % chart.pie.length]}
                                opacity={dim ? 0.35 : 1}
                              />
                            )
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
                ) : (
                  <ChartEmpty title="Sem dados por canal neste período." dense />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top produtos · receita
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Ranking do período · clique na tabela para detalhe do SKU
              </Typography>
              <Box sx={{ width: '100%', height: { xs: 220, sm: 260 } }}>
                {topSkuBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={topSkuBars}
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
                        width={140}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value, _n, item) => {
                          const q = (item?.payload as { qtd?: number } | undefined)?.qtd
                          return [
                            `${fmtBrl(Number(value))}${q != null ? ` · ${q} un` : ''}`,
                            'Receita',
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
                      <Bar dataKey="receita" fill={chart.line} radius={[0, 6, 6, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem top SKUs no período." dense />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
            <Typography variant="h6">Lista · top produtos</Typography>
            <Link
              component={RouterLink}
              to="/produtos"
              underline="hover"
              variant="body2"
              fontWeight={600}
            >
              Catálogo
            </Link>
          </Stack>
          <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table size="small" sx={{ minWidth: 360 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Produto</TableCell>
                  <TableCell align="right">Qtd</TableCell>
                  <TableCell align="right">Receita</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data?.topSkus || []).map((s) => (
                  <TableRow key={s.sku} hover>
                    <TableCell>
                      {s.sku ? (
                        <Link
                          component={RouterLink}
                          to={`/produtos/${encodeURIComponent(s.sku)}`}
                          state={{
                            descricao: s.descricao,
                            receita: s.receita,
                            quantidade: s.quantidade,
                          }}
                          underline="hover"
                          fontWeight={600}
                        >
                          {s.descricao}
                        </Link>
                      ) : (
                        s.descricao
                      )}
                    </TableCell>
                    <TableCell align="right">{s.quantidade}</TableCell>
                    <TableCell align="right">{fmtBrl(s.receita)}</TableCell>
                  </TableRow>
                ))}
                {!loading && !(data?.topSkus || []).length ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <ChartEmpty
                        title="Sem top SKUs no período."
                        dense
                        suggestPeriod
                      />
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
