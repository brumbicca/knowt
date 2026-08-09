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
import { AiInsightPanel } from '../components/AiInsightPanel'
import { ChartEmpty } from '../components/ChartEmpty'
import { DomainPageShell } from '../components/DomainPageShell'
import { Hicon, type HiconName } from '../components/Hicon'
import { Sparkline } from '../components/Sparkline'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchDespesasPeriodo,
  fetchDespesasRelatorio,
  fetchMargensEstatisticas,
  fetchPagamentos,
  fmtBrl,
  fmtIsoDate,
  type DespesasPeriodo,
  type DespesasRelatorio,
  type MargensEstatisticas,
  type PagamentosLista,
} from '../api/bridge'

function deltaLabel(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return 'vs período anterior'
  const sign = pct > 0 ? '↑' : pct < 0 ? '↓' : '→'
  return `${sign} ${Math.abs(pct).toFixed(1)}% vs período anterior`
}

function shortLabel(text: string, max = 26): string {
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

function moneyCell(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? fmtBrl(n) : '—'
}

type KpiSparkProps = {
  label: string
  value: string
  hint: string
  spark: number[]
  icon: HiconName
  color: string
}

function FinanceiroKpi({ label, value, hint, spark, icon, color }: KpiSparkProps) {
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

/** Insights · Financeiro inteligente (pág.21) — receita × taxas × despesas × margem. */
export function InsightsFinanceiroPage() {
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

  const [despesasRel, setDespesasRel] = useState<DespesasRelatorio | null>(null)
  const [despesasLista, setDespesasLista] = useState<DespesasPeriodo | null>(null)
  const [margens, setMargens] = useState<MargensEstatisticas | null>(null)
  const [pagamentos, setPagamentos] = useState<PagamentosLista | null>(null)
  const [extraLoading, setExtraLoading] = useState(true)
  const [extraError, setExtraError] = useState<string | null>(null)

  const loadExtra = useCallback(() => {
    setExtraLoading(true)
    setExtraError(null)
    Promise.all([
      fetchDespesasRelatorio(periodQuery).catch(() => null),
      fetchDespesasPeriodo(periodQuery).catch(() => null),
      fetchMargensEstatisticas(periodQuery, marketplace || undefined).catch(() => null),
      fetchPagamentos(periodQuery, { pagina: 1, limite: 12 }).catch(() => null),
    ])
      .then(([dRel, dLista, m, pag]) => {
        setDespesasRel(dRel)
        setDespesasLista(dLista)
        setMargens(m)
        setPagamentos(pag)
        if (!dRel && !dLista && !m && !pag && !data) {
          setExtraError('Falha ao carregar financeiro.')
        }
      })
      .finally(() => setExtraLoading(false))
    // `data` fica fora das deps de propósito: entra só no fallback de erro e
    // recarregava a página inteira a cada patch do overview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodQuery, marketplace, activeSourceId])

  useEffect(() => {
    loadExtra()
  }, [loadExtra])

  const receita = data?.vendas || 0
  const taxas = data?.taxas || 0
  const frete = data?.frete || 0
  const liquido = data?.liquido || 0
  const despesasTotal = Number(
    despesasRel?.relatorio?.totalValor ??
      despesasRel?.relatorio?.totalDespesas ??
      0,
  )
  const margemTotal =
    Number(margens?.estatisticas?.margemTotal ?? data?.margemTotal ?? 0) || 0
  const cmvTotal = Number(margens?.estatisticas?.totalCMV ?? data?.cmvTotal ?? 0) || 0
  const resultado = liquido - despesasTotal
  const margemPct = receita > 0 ? Math.round((1000 * liquido) / receita) / 10 : null
  const margemBrutaPct = receita > 0 ? Math.round((1000 * margemTotal) / receita) / 10 : null
  const despPct = receita > 0 ? Math.round((1000 * despesasTotal) / receita) / 10 : null
  const taxasPct = receita > 0 ? Math.round((1000 * taxas) / receita) / 10 : null
  const fretePct = receita > 0 ? Math.round((1000 * frete) / receita) / 10 : null

  const sparkReceita = useMemo(() => (data?.daily || []).map((d) => d.valor), [data?.daily])
  const sparkLiquido = useMemo(() => {
    if (!data?.daily?.length || !data.vendas) return []
    const ratio = liquido / data.vendas
    return data.daily.map((d) => d.valor * ratio)
  }, [data, liquido])
  const sparkDespesas = useMemo(() => {
    if (!data?.daily?.length || !data.vendas || despesasTotal <= 0) return sparkReceita.map((v) => v * 0.15)
    const ratio = despesasTotal / data.vendas
    return data.daily.map((d) => d.valor * ratio)
  }, [data, despesasTotal, sparkReceita])

  const fluxoSerie = useMemo(() => {
    const daily = data?.daily || []
    if (!daily.length || !data) return []
    const vendasBase = data.vendas || 0
    const despRatio = vendasBase > 0 && despesasTotal > 0 ? despesasTotal / vendasBase : 0
    const taxaRatio = vendasBase > 0 ? (taxas + frete) / vendasBase : 0
    let saldo = 0
    return daily.map((d) => {
      const entrada = d.valor
      const saida = d.valor * (despRatio + taxaRatio)
      saldo += entrada - saida
      return {
        dia: d.dia,
        entrada,
        saida,
        saldo,
      }
    })
  }, [data, despesasTotal, taxas, frete])

  const receitaCanal = useMemo(() => {
    const list = [...(data?.canais || [])]
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
    return list.map((c, i) => ({
      name: c.name,
      valor: c.value,
      fill: chart.pie[i % chart.pie.length] || chart.line,
    }))
  }, [data?.canais, chart])

  const receitaCanalTotal = receitaCanal.reduce((s, c) => s + c.valor, 0) || 1

  const despesasCat = useMemo(() => {
    return [...(despesasRel?.relatorio?.despesasPorCategoria || [])]
      .map((c, i) => ({
        name: shortLabel(String(c._id || '—'), 18),
        full: String(c._id || '—'),
        valor: Number(c.valor || 0),
        fill: chart.pie[i % chart.pie.length] || theme.palette.warning.main,
      }))
      .filter((c) => c.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6)
  }, [despesasRel, chart, theme])

  const despesasCatTotal = despesasCat.reduce((s, c) => s + c.valor, 0) || 1

  const dreRows = useMemo(
    () =>
      [
        { label: 'Receita bruta', valor: receita, tone: 'neutral' as const },
        { label: '(−) Taxas marketplace', valor: -taxas, tone: 'neg' as const },
        { label: '(−) Frete', valor: -frete, tone: 'neg' as const },
        { label: 'Líquido marketplace', valor: liquido, tone: 'pos' as const },
        { label: '(−) CMV', valor: -cmvTotal, tone: 'neg' as const },
        { label: 'Margem (pedido)', valor: margemTotal, tone: 'pos' as const },
        { label: '(−) Despesas', valor: -despesasTotal, tone: 'neg' as const },
        { label: 'Resultado estimado', valor: resultado, tone: resultado >= 0 ? ('pos' as const) : ('neg' as const) },
      ] as const,
    [receita, taxas, frete, liquido, cmvTotal, margemTotal, despesasTotal, resultado],
  )

  const receberRows = useMemo(() => {
    return (pagamentos?.pagamentos || []).slice(0, 5).map((p, i) => {
      const id = String(p.marketplace_id || p._id || p.id || `pag-${i}`)
      const valor = Number(p.order_revenue ?? p.amount ?? p.valor ?? p.paid_value ?? 0)
      const status = String(p.status || p.order_status || p.payment_status || '—')
      const ok = /paid|pago|aprov|complete|liquid/i.test(status)
      return {
        nome: shortLabel(String(p.marketplace_name || p.client_name || id), 22),
        data: fmtIsoDate(String(p.order_date || p.date || p.created_at || '').slice(0, 10) || null),
        valor,
        status: ok ? 'Ok' : status === '—' ? '—' : shortLabel(status, 12),
        ok,
      }
    })
  }, [pagamentos])

  const pagarRows = useMemo(() => {
    return (despesasLista?.despesas || []).slice(0, 5).map((d, i) => {
      const nome = String(d.fornecedor || d.supplier || d.categoria || d.description || d.descricao || `Desp. ${i + 1}`)
      const valor = Number(d.valor || d.value || d.amount || 0)
      const dataStr = String(d.data || d.date || d.vencimento || d.created_at || '').slice(0, 10)
      const status = String(d.status || 'Aberto')
      const ok = /pago|paid|quitad|baixad/i.test(status)
      return {
        nome: shortLabel(nome, 22),
        data: dataStr ? fmtIsoDate(dataStr) : '—',
        valor,
        status: ok ? 'Pago' : shortLabel(status, 12),
        ok,
      }
    })
  }, [despesasLista])

  const indicadores = useMemo(
    () =>
      [
        {
          label: 'Margem líquida (líq./receita)',
          value: margemPct != null ? `${margemPct}%` : '—',
          good: margemPct != null ? margemPct >= 20 : null,
        },
        {
          label: 'Margem bruta (pedido)',
          value: margemBrutaPct != null ? `${margemBrutaPct}%` : '—',
          good: margemBrutaPct != null ? margemBrutaPct >= 15 : null,
        },
        {
          label: 'Despesas / receita',
          value: despPct != null ? `${despPct}%` : '—',
          good: despPct != null ? despPct <= 25 : null,
        },
        {
          label: 'Taxas / receita',
          value: taxasPct != null ? `${taxasPct}%` : '—',
          good: taxasPct != null ? taxasPct <= 20 : null,
        },
        {
          label: 'Frete / receita',
          value: fretePct != null ? `${fretePct}%` : '—',
          good: fretePct != null ? fretePct <= 12 : null,
        },
        {
          label: 'Cobertura CMV/NF',
          value: data?.coberturaPct != null ? `${data.coberturaPct}%` : '—',
          good: data?.coberturaPct != null ? data.coberturaPct >= 85 : null,
        },
      ] as const,
    [margemPct, margemBrutaPct, despPct, taxasPct, fretePct, data?.coberturaPct],
  )

  const topDespesaCat = despesasCat[0]

  const insightPrincipal = useMemo(() => {
    if (data?.deltaVendasPct != null && margemPct != null) {
      const dir = data.deltaVendasPct >= 0 ? 'subiu' : 'caiu'
      return {
        title: `Receita ${dir} ${Math.abs(data.deltaVendasPct).toFixed(1)}% vs referência`,
        detail:
          topDespesaCat && despesasTotal > 0
            ? `Margem líquida ${margemPct}%. Maior despesa: ${topDespesaCat.full} (${fmtBrl(topDespesaCat.valor)}).`
            : `Margem líquida ${margemPct}% · resultado estimado ${fmtBrl(resultado)}.`,
      }
    }
    if (despPct != null && despPct >= 30) {
      return {
        title: `Despesas em ${despPct}% da receita`,
        detail: topDespesaCat
          ? `Atenção à categoria ${topDespesaCat.full} — revisar corte ou renegociação.`
          : 'Revisar categorias de despesa nos Insights.',
      }
    }
    if (resultado < 0) {
      return {
        title: 'Resultado estimado negativo no período',
        detail: 'Líquido marketplace não cobre despesas registradas — priorizar corte e CMV.',
      }
    }
    return {
      title: 'Saúde financeira estável neste snapshot',
      detail: 'Manter acompanhamento de taxas, frete e despesas vs receita.',
    }
  }, [data?.deltaVendasPct, margemPct, topDespesaCat, despesasTotal, resultado, despPct])

  const recommendations = useMemo(
    () =>
      [
        {
          title: topDespesaCat ? `Reduzir despesas · ${shortLabel(topDespesaCat.full, 20)}` : 'Reduzir despesas',
          detail: topDespesaCat
            ? `${fmtBrl(topDespesaCat.valor)} na maior categoria.`
            : 'Revisar categorias acima da média.',
          to: '/despesas',
        },
        {
          title: 'Acelerar liquidação',
          detail: 'Cruzar pagamentos e status de pedidos nos Insights.',
          to: '/pagamentos',
        },
        {
          title: 'Blindar margem/CMV',
          detail:
            data?.coberturaPct != null && data.coberturaPct < 90
              ? `Cobertura ${data.coberturaPct}% — completar NF/CMV.`
              : 'Auditar CMV e impostos dos pedidos.',
          to: '/insights/financeiro',
        },
        {
          title: 'Projetar fluxo 30 dias',
          detail: 'Usar série diária de receita × taxas × despesas como base.',
          to: '/insights/prioridades',
        },
      ] as const,
    [topDespesaCat, data?.coberturaPct],
  )

  const loading = (dataLoading || extraLoading) && !data
  const error = dataError || extraError
  const onRetry = () => {
    refresh()
    loadExtra()
  }

  return (
    <DomainPageShell
      title="Financeiro"
      subtitle="Financeiro inteligente · receita, despesas, margem e fluxo"
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
            Financeiro inteligente
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Visão da saúde financeira marketplace — mesmo motor do knowt (sem ERP de caixa bancário).
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" onClick={onRetry} disabled={dataLoading || extraLoading} sx={{ textTransform: 'none' }}>
            Atualizar
          </Button>
          <Link
            component={RouterLink}
            to="/despesas"
            underline="hover"
            fontWeight={600}
            sx={{ fontSize: '0.85rem' }}
          >
            Ver detalhes →
          </Link>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
        {(
          [
            {
              label: 'Receita total',
              value: fmtBrl(receita),
              hint: deltaLabel(data?.deltaVendasPct),
              spark: sparkReceita,
              icon: 'graph' as const,
              color: theme.palette.primary.main,
            },
            {
              label: 'Despesas totais',
              value: despesasTotal > 0 ? fmtBrl(despesasTotal) : '—',
              hint:
                despesasTotal > 0
                  ? `${despPct ?? 0}% da receita`
                  : 'Sem lançamentos no Financial',
              spark: sparkDespesas,
              icon: 'wallet' as const,
              color: theme.palette.error.main,
            },
            {
              label: 'Resultado estimado',
              value: fmtBrl(resultado),
              hint: 'Líquido − despesas',
              spark: sparkLiquido,
              icon: 'activity' as const,
              color: resultado >= 0 ? theme.palette.success.main : theme.palette.error.main,
            },
            {
              label: 'Margem líquida',
              value: margemPct != null ? `${margemPct}%` : '—',
              hint: `Líquido ${fmtBrl(liquido)}`,
              spark: sparkLiquido,
              icon: 'percent' as const,
              color: chart.line,
            },
            {
              label: 'Saldo do fluxo*',
              value: fluxoSerie.length ? fmtBrl(fluxoSerie[fluxoSerie.length - 1]?.saldo || 0) : '—',
              hint: '*Acumulado receita − (taxas/frete + desp. rateadas)',
              spark: fluxoSerie.map((d) => d.saldo),
              icon: 'payment' as const,
              color: theme.palette.success.main,
            },
          ] as const
        ).map((k) => (
          <Box
            key={k.label}
            sx={{ flex: { xs: '1 1 calc(50% - 10px)', md: '1 1 0' }, minWidth: { md: 130 } }}
          >
            <FinanceiroKpi {...k} />
          </Box>
        ))}
      </Stack>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Fluxo do período
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Entrada (receita) · saída (taxas/frete + despesas rateadas) · saldo acumulado
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                {fluxoSerie.length > 1 ? (
                  <ResponsiveContainer>
                    <ComposedChart data={fluxoSerie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                        formatter={(v, name) => [fmtBrl(Number(v)), String(name)]}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Bar
                        dataKey="entrada"
                        name="Entrada"
                        fill={theme.palette.primary.main}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={22}
                      />
                      <Bar
                        dataKey="saida"
                        name="Saída"
                        fill={theme.palette.error.light}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={22}
                      />
                      <Line
                        type="monotone"
                        dataKey="saldo"
                        name="Saldo"
                        stroke={theme.palette.success.main}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem série diária para o fluxo." dense />
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
              dominio="financeiro"
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
                Receita por canal
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Em vez de “categoria ERP” — marketplaces
              </Typography>
              <Box sx={{ width: '100%', height: 200 }}>
                {receitaCanal.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={receitaCanal}
                        dataKey="valor"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {receitaCanal.map((b) => (
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
                  <ChartEmpty title="Sem canais neste período." dense />
                )}
              </Box>
              <Stack spacing={0.4}>
                {receitaCanal.map((b) => (
                  <Stack key={b.name} direction="row" justifyContent="space-between">
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: b.fill }} />
                      <Typography variant="caption" color="text.secondary">
                        {shortLabel(b.name, 16)}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" fontWeight={600}>
                      {Math.round((100 * b.valor) / receitaCanalTotal)}%
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Despesas por categoria
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Relatório S2 do período
              </Typography>
              <Box sx={{ width: '100%', height: 200 }}>
                {despesasCat.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={despesasCat}
                        dataKey="valor"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {despesasCat.map((b) => (
                          <Cell key={b.name} fill={b.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [fmtBrl(Number(v)), 'Despesa']}
                        labelFormatter={(_, payload) =>
                          (payload?.[0]?.payload as { full?: string } | undefined)?.full || ''
                        }
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty
                    title="Sem despesas categorizadas."
                    hint="Nenhuma despesa lançada no Financial neste período."
                    suggestPeriod={false}
                    dense
                  />
                )}
              </Box>
              <Stack spacing={0.4}>
                {despesasCat.map((b) => (
                  <Stack key={b.name} direction="row" justifyContent="space-between">
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: b.fill }} />
                      <Typography variant="caption" color="text.secondary">
                        {b.name}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" fontWeight={600}>
                      {Math.round((100 * b.valor) / despesasCatTotal)}%
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                DRE resumido
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Visão marketplace + despesas
              </Typography>
              <Stack spacing={0.65}>
                {dreRows.map((r) => (
                  <Stack key={r.label} direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      {r.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{
                        fontVariantNumeric: 'tabular-nums',
                        color:
                          r.tone === 'pos'
                            ? theme.palette.success.main
                            : r.tone === 'neg'
                              ? theme.palette.error.main
                              : 'text.primary',
                      }}
                    >
                      {fmtBrl(r.valor)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Contas a receber*
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                *Amostra de pagamentos/pedidos S2
              </Typography>
              {receberRows.length ? (
                <Stack spacing={0.85}>
                  {receberRows.map((r, i) => (
                    <Stack key={`${r.nome}-${i}`} direction="row" spacing={0.75} alignItems="center">
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" fontWeight={700} noWrap display="block">
                          {r.nome}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.data}
                        </Typography>
                      </Box>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {moneyCell(r.valor)}
                      </Typography>
                      <Chip
                        size="small"
                        label={r.status}
                        color={r.ok ? 'success' : 'default'}
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.65rem' }}
                      />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <ChartEmpty
                  title="Sem pagamentos lançados no período."
                  hint="O módulo de pagamentos do Financial é alimentado manualmente — a receita validada continua nos KPIs acima."
                  suggestPeriod={false}
                  dense
                />
              )}
              <Box sx={{ mt: 1 }}>
                <Link
                  component={RouterLink}
                  to="/pagamentos"
                  underline="hover"
                  fontWeight={600}
                  sx={{ fontSize: '0.8rem' }}
                >
                  Ver pagamentos →
                </Link>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Contas a pagar*
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                *Amostra de despesas do período
              </Typography>
              {pagarRows.length ? (
                <Stack spacing={0.85}>
                  {pagarRows.map((r, i) => (
                    <Stack key={`${r.nome}-${i}`} direction="row" spacing={0.75} alignItems="center">
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" fontWeight={700} noWrap display="block">
                          {r.nome}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.data}
                        </Typography>
                      </Box>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {moneyCell(r.valor)}
                      </Typography>
                      <Chip
                        size="small"
                        label={r.status}
                        color={r.ok ? 'success' : 'warning'}
                        variant="outlined"
                        sx={{ height: 22, fontSize: '0.65rem' }}
                      />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <ChartEmpty
                  title="Sem despesas lançadas no período."
                  hint="Despesas dependem de lançamento manual no Financial; sem elas o resultado estimado é igual ao líquido."
                  suggestPeriod={false}
                  dense
                />
              )}
              <Box sx={{ mt: 1 }}>
                <Link
                  component={RouterLink}
                  to="/despesas"
                  underline="hover"
                  fontWeight={600}
                  sx={{ fontSize: '0.8rem' }}
                >
                  Ver despesas →
                </Link>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Indicadores
              </Typography>
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {indicadores.map((ind) => (
                  <Stack key={ind.label} direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                      {ind.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontWeight={800}
                      sx={{
                        color:
                          ind.good == null
                            ? 'text.primary'
                            : ind.good
                              ? theme.palette.success.main
                              : theme.palette.error.main,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {ind.value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </DomainPageShell>
  )
}
