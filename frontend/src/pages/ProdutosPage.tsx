import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
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
  TextField,
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
  fetchDashboard,
  fetchProdutosLista,
  fetchProdutosVendidos,
  fmtBrl,
  S2_APP_URL,
  type ProdutosVendidos,
} from '../api/bridge'

type KpiId = 'catalogo' | 'pagina' | 'tops'

function catName(p: Record<string, unknown>): string {
  const c = p.categoria
  if (c && typeof c === 'object' && 'nome' in c) return String((c as { nome?: string }).nome || '—')
  return '—'
}

function shortLabel(text: string, max = 32): string {
  const t = (text || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function ProdutosPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { periodQuery, marketplace, data: overview } = useBiData()
  const { activeSourceId } = useBiSource()
  const [lista, setLista] = useState<ProdutosVendidos | null>(null)
  const [catalogSample, setCatalogSample] = useState<Record<string, unknown>[]>([])
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [topSkus, setTopSkus] = useState<
    Array<{ descricao: string; receita: number; quantidade: number; sku: string }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [draftQ, setDraftQ] = useState('')
  const [q, setQ] = useState('')
  const [kpiId, setKpiId] = useState<KpiId>('tops')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchProdutosVendidos(periodQuery, marketplace || undefined, {
        pagina,
        limite: 25,
        busca: q || undefined,
      }),
      fetchProdutosLista({ pagina: 1, limite: 1 }).catch(() => null),
      fetchDashboard(periodQuery, marketplace || undefined).catch(() => null),
    ])
      .then(([l, catalog, dash]) => {
        setLista(l)
        setCatalogSample([])
        setCatalogTotal(Number(catalog?.paginacao?.total ?? catalog?.produtos?.length ?? 0))
        const tops = (dash?.dashboard?.topSkus || []).slice(0, 10).map((s) => ({
          sku: String(s.sku || ''),
          descricao: String(s.descricao || s.sku || '—'),
          receita: Number(s.receita || 0),
          quantidade: Number(s.quantidade || 0),
        }))
        setTopSkus(
          tops.length
            ? tops
            : (overview?.topSkus || []).map((s) => ({
                sku: s.sku,
                descricao: s.descricao,
                receita: s.receita,
                quantidade: s.quantidade,
              })),
        )
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar produtos')
      })
      .finally(() => setLoading(false))
  }, [pagina, q, periodQuery, marketplace, overview?.topSkus, activeSourceId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPagina(1)
  }, [periodQuery, marketplace, q, activeSourceId])

  const rows = lista?.produtos || []
  const pag = lista?.paginacao
  const total = Number(lista?.resumo?.total_produtos ?? pag?.total ?? rows.length)
  const pages = pag?.pages ?? 1
  const receitaMix = Number(lista?.resumo?.receita_total ?? 0)

  const topReceitaBars = useMemo(
    () =>
      [...topSkus]
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 8)
        .map((s) => ({
          name: shortLabel(s.descricao),
          receita: s.receita,
          full: s.descricao,
          qtd: s.quantidade,
        })),
    [topSkus],
  )

  const topQtdBars = useMemo(
    () =>
      [...topSkus]
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 8)
        .map((s) => ({
          name: shortLabel(s.descricao),
          qtd: s.quantidade,
          full: s.descricao,
          receita: s.receita,
        })),
    [topSkus],
  )

  const categoriaBars = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of catalogSample) {
      const name = catName(p)
      if (name === '—') continue
      counts.set(name, (counts.get(name) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, total]) => ({ name: shortLabel(name, 22), total, full: name }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }, [catalogSample])

  const custoBars = useMemo(
    () =>
      [...catalogSample]
        .map((p) => ({
          name: shortLabel(String(p.description || p.descricao || p.sku || '—'), 22),
          full: String(p.description || p.descricao || p.sku || '—'),
          custo: Number(p.product_cost || 0),
        }))
        .filter((p) => p.custo > 0)
        .sort((a, b) => b.custo - a.custo)
        .slice(0, 8),
    [catalogSample],
  )

  /** Curva ABC / Pareto sobre receita dos top SKUs (A ≤80%, B ≤95%, C resto). */
  const abcBars = useMemo(() => {
    const sorted = [...topSkus].sort((a, b) => b.receita - a.receita)
    const total = sorted.reduce((s, x) => s + x.receita, 0)
    if (total <= 0) return [] as Array<{ name: string; valor: number; fill: string; skus: number }>
    let acc = 0
    let a = 0
    let b = 0
    let c = 0
    let na = 0
    let nb = 0
    let nc = 0
    for (const s of sorted) {
      const beforePct = (100 * acc) / total
      if (beforePct < 80) {
        a += s.receita
        na += 1
      } else if (beforePct < 95) {
        b += s.receita
        nb += 1
      } else {
        c += s.receita
        nc += 1
      }
      acc += s.receita
    }
    return [
      { name: 'A · ≤80%', valor: a, fill: chart.pie[0], skus: na },
      { name: 'B · ≤95%', valor: b, fill: chart.pie[1] || chart.line, skus: nb },
      { name: 'C · resto', valor: c, fill: chart.pie[2] || theme.palette.warning.main, skus: nc },
    ].filter((x) => x.valor > 0)
  }, [topSkus, chart, theme.palette.warning.main])

  /** Histograma de ticket médio (receita/qtd) nos top SKUs. */
  const ticketHistBars = useMemo(() => {
    const buckets = [
      { name: '< R$20', min: 0, max: 20, total: 0 },
      { name: '20–50', min: 20, max: 50, total: 0 },
      { name: '50–100', min: 50, max: 100, total: 0 },
      { name: '100–200', min: 100, max: 200, total: 0 },
      { name: '≥200', min: 200, max: Infinity, total: 0 },
    ]
    for (const s of topSkus) {
      if (!s.quantidade) continue
      const ticket = s.receita / s.quantidade
      const b = buckets.find((x) => ticket >= x.min && ticket < x.max)
      if (b) b.total += 1
    }
    return buckets.filter((b) => b.total > 0).map(({ name, total }) => ({ name, total }))
  }, [topSkus])

  // Cadastro Financial vazio → o card "Produtos vendidos" mostra o ranking do mix, não charts de catálogo.
  const leftIsCatalogo = kpiId === 'catalogo' && catalogSample.length > 0
  const leftIsPagina = kpiId === 'pagina'

  return (
    <DomainPageShell
      title="Produtos"
      subtitle={
        lista?.periodo
          ? `${lista.periodo.inicio} → ${lista.periodo.fim} · produtos vendidos no período · clique num card`
          : 'Produtos vendidos no período · clique num card para mudar os gráficos'
      }
      loading={loading}
      error={error}
      onRetry={load}
    >
      <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Produtos vendidos"
            value={String(total)}
            hint={
              catalogTotal > 0
                ? `Cadastro Financial: ${catalogTotal}`
                : 'Cadastro Financial vazio · mix vem dos pedidos'
            }
            selected={kpiId === 'catalogo'}
            loading={loading}
            onClick={() => setKpiId('catalogo')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Receita do mix"
            value={fmtBrl(receitaMix)}
            hint={`Página ${pag?.pagina ?? pagina}/${pages || 1}`}
            selected={kpiId === 'pagina'}
            loading={loading}
            onClick={() => setKpiId('pagina')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Top SKUs (período)"
            value={String(topSkus.length || overview?.topSkus?.length || 0)}
            hint={overview?.rangeLabel}
            selected={kpiId === 'tops'}
            loading={loading}
            onClick={() => setKpiId('tops')}
          />
        </Grid>
      </Grid>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        sx={{ mb: 1 }}
      >
        <TextField
          size="small"
          label="Buscar"
          placeholder="Nome do produto"
          value={draftQ}
          onChange={(e) => setDraftQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPagina(1)
              setQ(draftQ.trim())
            }
          }}
          sx={{ minWidth: { sm: 260 } }}
        />
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            setPagina(1)
            setQ(draftQ.trim())
          }}
        >
          Buscar
        </Button>
        <Button
          component="a"
          href={`${S2_APP_URL}/produtos`}
          target="_blank"
          rel="noreferrer"
          size="small"
          variant="outlined"
        >
          Abrir no Financial
        </Button>
      </Stack>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {leftIsCatalogo
                  ? 'Catálogo · por categoria'
                  : leftIsPagina
                    ? 'Top produtos · quantidade'
                    : 'Top produtos · receita'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {leftIsCatalogo
                  ? 'Donut · contagem na amostra do catálogo (até 100)'
                  : leftIsPagina
                    ? 'Ranking do período por unidades vendidas'
                    : 'Ranking do período (barras horizontais)'}
              </Typography>
              <Box sx={{ width: '100%', height: { xs: 260, sm: 300 } }}>
                {leftIsCatalogo ? (
                  categoriaBars.length ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={categoriaBars}
                          dataKey="total"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={90}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {categoriaBars.map((_, i) => (
                            <Cell key={i} fill={chart.pie[i % chart.pie.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, _n, item) => {
                            const full = (item?.payload as { full?: string } | undefined)?.full
                            return [Number(value), full || 'Produtos']
                          }}
                          contentStyle={{
                            borderRadius: 8,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty
                      title="Sem categorias no catálogo (ou amostra vazia)."
                      hint="Categorias vêm do catálogo S2 — não dependem só do período de vendas."
                      suggestPeriod={false}
                      dense
                    />
                  )
                ) : leftIsPagina ? (
                  topQtdBars.length ? (
                    <ResponsiveContainer>
                      <BarChart
                        layout="vertical"
                        data={topQtdBars}
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
                          width={150}
                          tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value, _n, item) => {
                            const receita = (item?.payload as { receita?: number } | undefined)?.receita
                            return [
                              `${Number(value)} un${receita != null ? ` · ${fmtBrl(receita)}` : ''}`,
                              'Qtd',
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
                        <Bar dataKey="qtd" fill={chart.pie[1] || chart.line} radius={[0, 6, 6, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty title="Sem top SKUs no período." dense />
                  )
                ) : topReceitaBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={topReceitaBars}
                      margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.palette.divider}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(n) => {
                          const abs = Math.abs(Number(n))
                          if (abs >= 1000) return `${(Number(n) / 1000).toFixed(0)}k`
                          return String(Math.round(Number(n)))
                        }}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(value, _n, item) => {
                          const qtd = (item?.payload as { qtd?: number } | undefined)?.qtd
                          return [
                            `${fmtBrl(Number(value))}${qtd != null ? ` · ${qtd} un` : ''}`,
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
              {leftIsCatalogo && categoriaBars.length ? (
                <Stack spacing={0.35} sx={{ mt: 1, maxHeight: 120, overflow: 'auto' }}>
                  {categoriaBars.slice(0, 6).map((b, i) => (
                    <Stack
                      key={b.full}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: chart.pie[i % chart.pie.length],
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {b.name}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight={600}>
                        {b.total}
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
                {leftIsCatalogo
                  ? custoBars.length
                    ? 'Catálogo · custo'
                    : 'Top produtos · receita'
                  : leftIsPagina
                    ? 'Ticket médio · faixas'
                    : `Curva ABC · top ${topSkus.length} SKUs`}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {leftIsCatalogo
                  ? custoBars.length
                    ? 'Top custos na amostra do catálogo'
                    : 'Ranking do período do filtro'
                  : leftIsPagina
                    ? 'Histograma · receita ÷ qtd nos top SKUs'
                    : `A/B/C dentro do ranking exibido (${topSkus.length} SKUs), não do mix completo do período`}
              </Typography>
              <Box sx={{ width: '100%', height: { xs: 260, sm: 300 } }}>
                {leftIsCatalogo && custoBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={custoBars}
                      margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.palette.divider}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(n) => {
                          const abs = Math.abs(Number(n))
                          if (abs >= 1000) return `${(Number(n) / 1000).toFixed(0)}k`
                          return String(Math.round(Number(n)))
                        }}
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
                      <Bar dataKey="custo" fill={chart.pie[2]} radius={[0, 6, 6, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : leftIsCatalogo ? (
                  topReceitaBars.length ? (
                    <ResponsiveContainer>
                      <BarChart
                        layout="vertical"
                        data={topReceitaBars}
                        margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={theme.palette.divider}
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tickFormatter={(n) => {
                            const abs = Math.abs(Number(n))
                            if (abs >= 1000) return `${(Number(n) / 1000).toFixed(0)}k`
                            return String(Math.round(Number(n)))
                          }}
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
                          formatter={(value) => [fmtBrl(Number(value)), 'Receita']}
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
                  )
                ) : leftIsPagina ? (
                  ticketHistBars.length ? (
                    <ResponsiveContainer>
                      <BarChart data={ticketHistBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                          formatter={(value) => [Number(value), 'SKUs']}
                          contentStyle={{
                            borderRadius: 8,
                            border: `1px solid ${theme.palette.divider}`,
                          }}
                        />
                        <Bar dataKey="total" fill={chart.pie[0]} radius={[6, 6, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty title="Sem ticket médio calculável." dense />
                  )
                ) : abcBars.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={abcBars}
                        dataKey="valor"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {abcBars.map((b) => (
                          <Cell key={b.name} fill={b.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _n, item) => {
                          const skus = (item?.payload as { skus?: number } | undefined)?.skus
                          return [
                            `${fmtBrl(Number(value))}${skus != null ? ` · ${skus} SKU` : ''}`,
                            'Receita',
                          ]
                        }}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem receita nos top SKUs para ABC." dense />
                )}
              </Box>
              {!leftIsCatalogo && !leftIsPagina && abcBars.length ? (
                <Stack spacing={0.35} sx={{ mt: 1 }}>
                  {abcBars.map((b) => (
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
                        {fmtBrl(b.valor)} · {b.skus}
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
              dominio="mix"
              fallback={{
                title: `${total} produtos vendidos · ${fmtBrl(receitaMix)}`,
                detail: 'Leitura do mix e concentração de SKUs — a mesma verdade do chat Hermes.',
                recommendations: [
                  { title: 'Ver margens', detail: 'Validar CMV dos itens prioritários.', to: '/margens' },
                  { title: 'Ver vendas', detail: 'Comparar mix, canal e ticket.', to: '/vendas' },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Produtos vendidos no período
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Identificador = id do anúncio no canal · o cadastro Financial de SKU ainda está vazio
          </Typography>
          <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Produto</TableCell>
                  <TableCell>Canal</TableCell>
                  <TableCell>ID anúncio</TableCell>
                  <TableCell align="right">Qtd</TableCell>
                  <TableCell align="right">Pedidos</TableCell>
                  <TableCell align="right">Receita</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p, i) => {
                  const pid = String(p.product_id || '')
                  const canais = (p.canais || []).filter(Boolean).join(', ') || '—'
                  return (
                    <TableRow key={`${pid}-${i}`} hover>
                      <TableCell>
                        {pid ? (
                          <Link
                            component={RouterLink}
                            to={`/produtos/${encodeURIComponent(pid)}`}
                            state={{
                              descricao: p.descricao,
                              receita: p.receita,
                              quantidade: p.quantidade,
                            }}
                            underline="hover"
                            fontWeight={600}
                            sx={{ display: 'block', maxWidth: 360 }}
                            noWrap
                          >
                            {String(p.descricao || pid || '—')}
                          </Link>
                        ) : (
                          <Typography variant="body2" sx={{ maxWidth: 360 }} noWrap>
                            {String(p.descricao || '—')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{canais}</TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {pid || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{Number(p.quantidade || 0)}</TableCell>
                      <TableCell align="right">{Number(p.pedidos || 0)}</TableCell>
                      <TableCell align="right">{fmtBrl(Number(p.receita || 0))}</TableCell>
                    </TableRow>
                  )
                })}
                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <ChartEmpty
                        title="Nenhum produto vendido no período (ou busca sem resultados)."
                        hint="Ajusta o período/canal ou limpa a busca."
                        suggestPeriod
                        dense
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Box>
          <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {total} produtos · receita do mix {fmtBrl(receitaMix)}
            </Typography>
            <Stack direction="row" spacing={1}>
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
          </Stack>
        </CardContent>
      </Card>
    </DomainPageShell>
  )
}
