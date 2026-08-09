import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
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
import { CoverageGauge } from '../components/CoverageGauge'
import { DomainPageShell } from '../components/DomainPageShell'
import { Hicon, type HiconName } from '../components/Hicon'
import { Sparkline } from '../components/Sparkline'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchDashboard,
  fetchMargensLista,
  fetchProdutosVendidos,
  fmtBrl,
} from '../api/bridge'

/** Mix real do período vem de `/produtos/vendidos` (agrega `pedidos.order_products`). */
const MIX_LIMITE = 200

function normKey(text: string): string {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

type TopSku = {
  sku: string
  descricao: string
  receita: number
  quantidade: number
  classe?: 'A' | 'B' | 'C'
}

type MarginSku = {
  name: string
  margem: number
  sku?: string
}

function shortLabel(text: string, max = 28): string {
  const t = (text || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function fmtAxis(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

function assignAbc(skus: TopSku[]): TopSku[] {
  const sorted = [...skus].sort((a, b) => b.receita - a.receita)
  const total = sorted.reduce((s, x) => s + x.receita, 0)
  if (total <= 0) return sorted.map((s) => ({ ...s, classe: 'C' as const }))
  let acc = 0
  return sorted.map((s) => {
    const beforePct = (100 * acc) / total
    const classe: 'A' | 'B' | 'C' = beforePct < 80 ? 'A' : beforePct < 95 ? 'B' : 'C'
    acc += s.receita
    return { ...s, classe }
  })
}

type KpiSparkProps = {
  label: string
  value: string
  hint: string
  spark: number[]
  icon: HiconName
  color: string
}

function MixKpi({ label, value, hint, spark, icon, color }: KpiSparkProps) {
  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(color, 0.28),
        bgcolor: alpha(color, 0.04),
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(color, 0.18),
              color,
            }}
          >
            <Hicon name={icon} sx={{ fontSize: '0.95rem' }} />
          </Box>
          <Typography
            variant="caption"
            fontWeight={700}
            letterSpacing={0.05}
            sx={{ textTransform: 'uppercase', color, lineHeight: 1.2 }}
          >
            {label}
          </Typography>
        </Stack>
        <Typography
          sx={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            fontSize: '1.35rem',
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {hint}
        </Typography>
        <Sparkline values={spark} color={color} height={28} />
      </CardContent>
    </Card>
  )
}

/** Insights · Mix & SKUs (pág.17) — ABC/Pareto e saúde de catálogo, sem WMS. */
export function InsightsProdutosPage() {
  const theme = useTheme()
  const chart = theme.chart
  const {
    data,
    loading: dataLoading,
    error: dataError,
    refresh,
    periodQuery,
    marketplace,
  } = useBiData()
  const { activeSourceId } = useBiSource()

  const [topSkus, setTopSkus] = useState<TopSku[]>([])
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [semCusto, setSemCusto] = useState(0)
  const [topMargem, setTopMargem] = useState<MarginSku[]>([])
  const [extraLoading, setExtraLoading] = useState(true)
  const [extraError, setExtraError] = useState<string | null>(null)

  const loadExtra = useCallback(() => {
    setExtraLoading(true)
    setExtraError(null)
    Promise.all([
      fetchDashboard(periodQuery, marketplace || undefined).catch(() => null),
      fetchProdutosVendidos(periodQuery, marketplace || undefined, {
        pagina: 1,
        limite: MIX_LIMITE,
      }).catch(() => null),
      fetchMargensLista(periodQuery).catch(() => null),
    ])
      .then(([dash, produtos, margens]) => {
        const vendidos = (produtos?.produtos || []).map((p) => ({
          sku: String(p.product_id || ''),
          descricao: String(p.descricao || p.product_id || '—'),
          receita: Number(p.receita || 0),
          quantidade: Number(p.quantidade || 0),
        }))
        const fromDash = (dash?.dashboard?.topSkus || []).map((s) => ({
          sku: String(s.sku || ''),
          descricao: String(s.descricao || s.sku || '—'),
          receita: Number(s.receita || 0),
          quantidade: Number(s.quantidade || 0),
        }))
        const fromOverview = (data?.topSkus || []).map((s) => ({
          sku: s.sku,
          descricao: s.descricao || s.sku,
          receita: s.receita,
          quantidade: s.quantidade,
        }))
        setTopSkus(vendidos.length ? vendidos : fromDash.length ? fromDash : fromOverview)
        setCatalogTotal(produtos?.resumo?.total_produtos ?? produtos?.paginacao?.total ?? vendidos.length)

        const byDesc = new Map<string, { margem: number; sku?: string }>()
        for (const it of margens?.items || []) {
          // Descrição primeiro: `code` costuma ser o ID do anúncio, ilegível no gráfico.
          const key = String(it.description || it.ad_description || it.code || '—').trim()
          if (!key || key === '—') continue
          const prev = byDesc.get(key) || { margem: 0, sku: it.code }
          prev.margem += Number(it.calculated_margin || 0)
          if (it.code) prev.sku = String(it.code)
          byDesc.set(key, prev)
        }

        // «Sem margem» = SKU vendido no período que não aparece no cálculo de margem/CMV.
        const margemKeys = new Set<string>()
        for (const it of margens?.items || []) {
          for (const raw of [it.code, it.description, it.ad_description]) {
            const k = normKey(String(raw || ''))
            if (k) margemKeys.add(k)
          }
        }
        setSemCusto(
          margemKeys.size === 0
            ? vendidos.length
            : vendidos.filter(
                (p) => !margemKeys.has(normKey(p.sku)) && !margemKeys.has(normKey(p.descricao)),
              ).length,
        )
        setTopMargem(
          [...byDesc.entries()]
            .map(([name, v]) => ({ name, margem: v.margem, sku: v.sku }))
            .sort((a, b) => b.margem - a.margem)
            .slice(0, 10),
        )

        if (!dash && !produtos && !margens && !(data?.topSkus || []).length) {
          setExtraError('Falha ao carregar mix de SKUs.')
        }
      })
      .finally(() => setExtraLoading(false))
    // `data.topSkus` é só fallback; nas deps recarregava tudo a cada patch do overview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodQuery, marketplace, activeSourceId])

  useEffect(() => {
    loadExtra()
  }, [loadExtra])

  const ranked = useMemo(() => assignAbc(topSkus), [topSkus])

  const abcBars = useMemo(() => {
    const total = ranked.reduce((s, x) => s + x.receita, 0)
    if (total <= 0) return [] as Array<{ name: string; valor: number; fill: string; skus: number; pct: number }>
    const groups: Record<'A' | 'B' | 'C', { valor: number; skus: number }> = {
      A: { valor: 0, skus: 0 },
      B: { valor: 0, skus: 0 },
      C: { valor: 0, skus: 0 },
    }
    for (const s of ranked) {
      const c = s.classe || 'C'
      groups[c].valor += s.receita
      groups[c].skus += 1
    }
    return (
      [
        { name: 'Classe A', key: 'A' as const, fill: chart.pie[0] || theme.palette.primary.main },
        { name: 'Classe B', key: 'B' as const, fill: chart.pie[1] || chart.line },
        { name: 'Classe C', key: 'C' as const, fill: chart.pie[2] || theme.palette.success.main },
      ] as const
    )
      .map((g) => ({
        name: g.name,
        valor: groups[g.key].valor,
        skus: groups[g.key].skus,
        fill: g.fill,
        pct: Math.round((100 * groups[g.key].valor) / total),
      }))
      .filter((x) => x.valor > 0)
  }, [ranked, chart, theme])

  const abcTotal = abcBars.reduce((s, x) => s + x.valor, 0)
  const classeAPct = abcBars.find((x) => x.name === 'Classe A')?.pct ?? 0
  const classeASkus = abcBars.find((x) => x.name === 'Classe A')?.skus ?? 0
  const classeCSkus = abcBars.find((x) => x.name === 'Classe C')?.skus ?? 0

  const topReceitaBars = useMemo(
    () =>
      [...ranked]
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 10)
        .map((s) => ({
          name: shortLabel(s.descricao, 22),
          full: s.descricao,
          receita: s.receita,
          sku: s.sku,
        })),
    [ranked],
  )

  const topBars = useMemo(() => {
    type Row = { name: string; full: string; valor: number; sku: string; metric: string }
    if (topMargem.length) {
      return topMargem.map(
        (s): Row => ({
          name: shortLabel(s.name, 22),
          full: s.name,
          valor: s.margem,
          sku: s.sku || '',
          metric: 'Margem',
        }),
      )
    }
    return topReceitaBars.map(
      (s): Row => ({
        name: s.name,
        full: s.full,
        valor: s.receita,
        sku: s.sku,
        metric: 'Receita',
      }),
    )
  }, [topMargem, topReceitaBars])

  const ticketHistBars = useMemo(() => {
    const buckets = [
      { name: '< R$20', min: 0, max: 20, total: 0 },
      { name: '20–50', min: 20, max: 50, total: 0 },
      { name: '50–100', min: 50, max: 100, total: 0 },
      { name: '100–200', min: 100, max: 200, total: 0 },
      { name: '≥200', min: 200, max: Infinity, total: 0 },
    ]
    for (const s of topSkus) {
      if (!(s.quantidade > 0) || !(s.receita > 0)) continue
      const ticket = s.receita / s.quantidade
      const b = buckets.find((x) => ticket >= x.min && ticket < x.max)
      if (b) b.total += 1
    }
    return buckets.filter((b) => b.total > 0)
  }, [topSkus])

  const alertas = useMemo(() => {
    const rows: Array<{
      produto: string
      sku: string
      tipo: string
      status: 'critico' | 'atencao' | 'info'
      detalhe: string
    }> = []

    const aList = ranked.filter((s) => s.classe === 'A')
    const avgQty =
      aList.length > 0 ? aList.reduce((s, x) => s + x.quantidade, 0) / aList.length : 0

    for (const s of aList.slice(0, 4)) {
      if (avgQty > 0 && s.quantidade < avgQty * 0.5) {
        rows.push({
          produto: s.descricao,
          sku: s.sku,
          tipo: 'Concentração A',
          status: 'critico',
          detalhe: `Qtd ${s.quantidade} · abaixo da média A`,
        })
      }
    }

    if (classeASkus > 0 && classeASkus <= 2 && classeAPct >= 40) {
      const top = aList[0]
      if (top) {
        rows.push({
          produto: top.descricao,
          sku: top.sku,
          tipo: 'Risco de mix',
          status: 'atencao',
          detalhe: `${classeASkus} SKU(s) A = ${classeAPct}% da receita`,
        })
      }
    }

    for (const s of ranked.filter((x) => x.classe === 'C').slice(0, 3)) {
      rows.push({
        produto: s.descricao,
        sku: s.sku,
        tipo: 'Cauda C',
        status: 'info',
        detalhe: `Baixa participação · ${fmtBrl(s.receita)}`,
      })
    }

    if (semCusto > 0) {
      rows.push({
        produto: 'Mix do período',
        sku: '',
        tipo: 'Sem CMV',
        status: 'atencao',
        detalhe: `${semCusto} de ${catalogTotal || semCusto} SKUs vendidos sem margem calculada`,
      })
    }

    return rows.slice(0, 6)
  }, [ranked, classeASkus, classeAPct, semCusto, catalogTotal])

  const quedaShare = useMemo(() => {
    const sorted = [...ranked].sort((a, b) => a.receita - b.receita)
    const total = ranked.reduce((s, x) => s + x.receita, 0) || 1
    const avgShare = 100 / Math.max(ranked.length, 1)
    return sorted
      .filter((s) => (100 * s.receita) / total < avgShare * 0.6)
      .slice(0, 5)
      .map((s) => ({
        ...s,
        share: Math.round((100 * s.receita) / total),
        gap: Math.round(avgShare - (100 * s.receita) / total),
      }))
  }, [ranked])

  const ticketMedio =
    topSkus.length > 0
      ? topSkus.reduce((s, x) => s + (x.quantidade > 0 ? x.receita / x.quantidade : 0), 0) /
        Math.max(topSkus.filter((x) => x.quantidade > 0).length, 1)
      : data && data.pedidos > 0
        ? data.vendas / data.pedidos
        : 0

  const receitaTop = ranked.reduce((s, x) => s + x.receita, 0)

  const saudeMix = useMemo(() => {
    let score = 70
    if (classeAPct > 0 && classeAPct <= 85) score += 8
    if (classeAPct > 90) score -= 12
    if (classeASkus >= 3) score += 6
    if (classeASkus <= 1 && receitaTop > 0) score -= 10
    if (semCusto === 0) score += 6
    else if (semCusto > 20) score -= 10
    if (data?.coberturaPct != null) {
      score = Math.round(score * 0.55 + Math.min(100, data.coberturaPct) * 0.45)
    }
    return Math.max(0, Math.min(100, Math.round(score)))
  }, [classeAPct, classeASkus, receitaTop, semCusto, data?.coberturaPct])

  const sparkReceita = useMemo(() => (data?.daily || []).map((d) => d.valor), [data?.daily])
  const sparkPedidos = useMemo(() => (data?.daily || []).map((d) => d.pedidos), [data?.daily])

  const insightPrincipal = useMemo(() => {
    if (classeASkus > 0 && classeASkus <= 2 && classeAPct >= 35) {
      return {
        title: `${classeASkus} produto(s) concentram ${classeAPct}% da receita`,
        detail: 'Diversificar o mix ou reforçar estoque/CMV desses SKUs críticos.',
      }
    }
    if (semCusto > 10) {
      return {
        title: `${semCusto} SKUs vendidos sem margem calculada`,
        detail: 'Sem CMV/NF nesses itens a margem do período fica cega — completar no catálogo.',
      }
    }
    if (classeCSkus >= 5) {
      return {
        title: `Cauda longa com ${classeCSkus} SKUs classe C`,
        detail: 'Avaliar descontinuar ou empacotar itens de baixa participação.',
      }
    }
    return {
      title: 'Mix relativamente equilibrado neste snapshot',
      detail: 'Manter acompanhamento ABC e ticket por faixa.',
    }
  }, [classeASkus, classeAPct, semCusto, classeCSkus])

  const recommendations = useMemo(
    () =>
      [
        {
          title: 'Revisar SKUs classe A',
          detail: 'Garantir CMV e disponibilidade dos itens que puxam a receita.',
          to: '/produtos',
        },
        {
          title: semCusto > 0 ? `Completar CMV de ${Math.min(semCusto, 20)} SKUs vendidos` : 'Auditar CMV do catálogo',
          detail: 'Sem custo, a saúde de margem e o ABC ficam incompletos.',
          to: '/margens',
        },
        {
          title: 'Explorar faixas de ticket',
          detail: 'Ajustar mix/preço onde a concentração de ticket estiver enviesada.',
          to: '/vendas',
        },
      ] as const,
    [semCusto],
  )

  const loading = (dataLoading || extraLoading) && !topSkus.length && !data
  const error = dataError || extraError
  const onRetry = () => {
    refresh()
    loadExtra()
  }

  const statusColor = (s: 'critico' | 'atencao' | 'info') =>
    s === 'critico'
      ? theme.palette.error.main
      : s === 'atencao'
        ? theme.palette.warning.main
        : theme.palette.info.main

  return (
    <DomainPageShell
      title="Mix & SKUs"
      subtitle="Mix inteligente · ABC/Pareto, ticket e saúde de catálogo (sem WMS)"
      loading={loading}
      error={error}
      onRetry={onRetry}
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
            Produtos e mix inteligente
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Curva ABC por receita · faixas de ticket · alertas de concentração — mesma verdade do Business.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" onClick={onRetry} disabled={dataLoading || extraLoading} sx={{ textTransform: 'none' }}>
            Atualizar
          </Button>
          <Link
            component={RouterLink}
            to="/produtos"
            underline="hover"
            fontWeight={600}
            sx={{ fontSize: '0.85rem' }}
          >
            Ver no Business →
          </Link>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
        {(
          [
            {
              label: 'SKUs no top',
              value: String(topSkus.length),
              hint: 'Itens com venda no período',
              spark: sparkPedidos,
              icon: 'category' as const,
              color: theme.palette.primary.main,
            },
            {
              label: 'Concentração A',
              value: classeAPct ? `${classeAPct}%` : '—',
              hint: `${classeASkus} SKU(s) até 80% da receita`,
              spark: sparkReceita,
              icon: 'graph' as const,
              color: chart.pie[0] || theme.palette.primary.main,
            },
            {
              label: 'Cauda C',
              value: String(classeCSkus),
              hint: 'SKUs de baixa participação',
              spark: sparkPedidos,
              icon: 'archive' as const,
              color: theme.palette.warning.main,
            },
            {
              label: 'Sem CMV',
              value: String(semCusto),
              hint: `SKUs vendidos sem margem · ${catalogTotal || '—'} no mix`,
              spark: sparkReceita,
              icon: 'report' as const,
              color: theme.palette.error.main,
            },
            {
              label: 'Ticket médio mix',
              value: ticketMedio > 0 ? fmtBrl(ticketMedio) : '—',
              hint: receitaTop > 0 ? `Receita top ${fmtBrl(receitaTop)}` : 'Sem receita nos tops',
              spark: sparkReceita,
              icon: 'wallet' as const,
              color: theme.palette.success.main,
            },
          ] as const
        ).map((k) => (
          <Box
            key={k.label}
            sx={{ flex: { xs: '1 1 calc(50% - 10px)', md: '1 1 0' }, minWidth: { md: 130 } }}
          >
            <MixKpi {...k} />
          </Box>
        ))}
      </Stack>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {topBars[0]?.metric === 'Margem' ? 'Top 10 · por margem' : 'Top 10 · por receita'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {topBars[0]?.metric === 'Margem'
                  ? 'Agregado da lista de margens do período'
                  : 'Fallback receita dos top SKUs do dashboard'}
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                {topBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      layout="vertical"
                      data={topBars}
                      margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
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
                        width={110}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v, _n, item) => {
                          const metric =
                            (item?.payload as { metric?: string } | undefined)?.metric || 'Valor'
                          return [fmtBrl(Number(v)), metric]
                        }}
                        labelFormatter={(_, payload) => {
                          const full = (payload?.[0]?.payload as { full?: string } | undefined)?.full
                          return full || ''
                        }}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar
                        dataKey="valor"
                        fill={theme.palette.primary.main}
                        radius={[0, 6, 6, 0]}
                        maxBarSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem top produtos neste período." dense />
                )}
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
              dominio="mix"
              fallback={{
                title: insightPrincipal.title,
                detail: insightPrincipal.detail,
                recommendations: recommendations.map((r) => ({
                  title: r.title,
                  detail: r.detail,
                  to: r.to,
                })),
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Curva ABC · por valor
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Pareto receita · A ≤80% · B ≤95% · C resto
              </Typography>
              <Box sx={{ width: '100%', height: 220 }}>
                {abcBars.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={abcBars}
                        dataKey="valor"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={84}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {abcBars.map((b) => (
                          <Cell key={b.name} fill={b.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [fmtBrl(Number(v)), 'Receita']}
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
              {abcBars.length ? (
                <Stack spacing={0.5}>
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
                        {b.skus} SKU · {b.pct}%
                        {abcTotal ? ` · ${fmtBrl(b.valor)}` : ''}
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
                Mix por faixa de ticket
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Em vez de cobertura em dias (WMS) — distribuição de ticket nos tops
              </Typography>
              <Box sx={{ width: '100%', height: 260 }}>
                {ticketHistBars.length ? (
                  <ResponsiveContainer>
                    <BarChart
                      data={ticketHistBars}
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
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                      />
                      <Tooltip
                        formatter={(v) => [Number(v), 'SKUs']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar
                        dataKey="total"
                        fill={chart.pie[1] || chart.line}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem ticket médio calculável." dense />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Alertas de mix
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                Concentração, cauda e CMV — não ruptura de armazém
              </Typography>
              {alertas.length ? (
                <Stack spacing={1}>
                  {alertas.map((a, i) => (
                    <Stack
                      key={`${a.sku}-${a.tipo}-${i}`}
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
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
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: statusColor(a.status),
                          mt: 0.7,
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {shortLabel(a.produto, 36)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" noWrap>
                          {a.detalhe}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={a.tipo}
                        sx={{
                          flexShrink: 0,
                          bgcolor: alpha(statusColor(a.status), 0.12),
                          color: statusColor(a.status),
                          fontWeight: 600,
                        }}
                      />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <ChartEmpty title="Sem alertas de mix neste snapshot." dense />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                SKUs com menor share
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                Em vez de “queda de giro” (sem série histórica por SKU)
              </Typography>
              {quedaShare.length ? (
                <Stack spacing={1}>
                  {quedaShare.map((s) => (
                    <Stack
                      key={s.sku || s.descricao}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      spacing={1}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {shortLabel(s.descricao, 30)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.share}% da receita top
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={`−${s.gap} pp`}
                        color="error"
                        variant="outlined"
                        sx={{ flexShrink: 0 }}
                      />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <ChartEmpty title="Mix sem cauda clara neste top." dense />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Saúde do mix
              </Typography>
              <CoverageGauge
                value={saudeMix}
                label={`${saudeMix}% saudável`}
                hint={
                  data?.coberturaPct != null
                    ? `Inclui cobertura CMV/NF ${data.coberturaPct}%`
                    : 'ABC + CMV + concentração'
                }
                height={180}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </DomainPageShell>
  )
}
