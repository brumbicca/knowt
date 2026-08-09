import { useCallback, useEffect, useMemo, useState } from 'react'
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
  fetchDespesasPeriodo,
  fetchDespesasRelatorio,
  fmtBrl,
  S2_APP_URL,
  type DespesasPeriodo,
  type DespesasRelatorio,
} from '../api/bridge'

type KpiId = 'qtd' | 'valor' | 'categorias' | 'fornecedores'

function shortLabel(text: string, max = 22): string {
  const t = (text || '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function DespesasPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { periodQuery, periodo, setPeriodo, customRange } = useBiData()
  const { activeSourceId } = useBiSource()
  const [relatorio, setRelatorio] = useState<DespesasRelatorio | null>(null)
  const [lista, setLista] = useState<DespesasPeriodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpiId, setKpiId] = useState<KpiId>('valor')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([fetchDespesasRelatorio(periodQuery), fetchDespesasPeriodo(periodQuery)])
      .then(([r, l]) => {
        setRelatorio(r)
        setLista(l)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar despesas')
      })
      .finally(() => setLoading(false))
  }, [periodQuery, activeSourceId])

  useEffect(() => {
    load()
  }, [load])

  const r = relatorio?.relatorio
  const rows = lista?.despesas || []

  const categoriaBars = useMemo(
    () =>
      [...(r?.despesasPorCategoria || [])]
        .map((c) => ({
          name: shortLabel(String(c._id || '—')),
          full: String(c._id || '—'),
          valor: Number(c.valor || 0),
          qtd: Number(c.total || 0),
        }))
        .sort((a, b) => (kpiId === 'qtd' ? b.qtd - a.qtd : b.valor - a.valor))
        .slice(0, 8),
    [r?.despesasPorCategoria, kpiId],
  )

  const fornecedorBars = useMemo(
    () =>
      [...(r?.despesasPorFornecedor || [])]
        .map((c) => ({
          name: shortLabel(String(c._id || '—')),
          full: String(c._id || '—'),
          valor: Number(c.valor || 0),
          qtd: Number(c.total || 0),
        }))
        .sort((a, b) => (kpiId === 'qtd' ? b.qtd - a.qtd : b.valor - a.valor))
        .slice(0, 8),
    [r?.despesasPorFornecedor, kpiId],
  )

  const byQtd = kpiId === 'qtd'
  const dataKey = byQtd ? 'qtd' : 'valor'
  const leftIsCategoria = kpiId !== 'fornecedores'
  const leftBars = leftIsCategoria ? categoriaBars : fornecedorBars
  const rightBars = leftIsCategoria ? fornecedorBars : categoriaBars

  const leftTitle = leftIsCategoria
    ? `Por categoria · ${byQtd ? 'qtd' : 'valor'}`
    : `Por fornecedor · ${byQtd ? 'qtd' : 'valor'}`
  const rightTitle = leftIsCategoria
    ? `Por fornecedor · ${byQtd ? 'qtd' : 'valor'}`
    : `Por categoria · ${byQtd ? 'qtd' : 'valor'}`

  const empty = !loading && Number(r?.totalDespesas || 0) === 0

  return (
    <DomainPageShell
      title="Despesas"
      subtitle={
        relatorio?.periodo
          ? `${relatorio.periodo.inicio} → ${relatorio.periodo.fim} · clique num card para mudar os gráficos`
          : 'Clique num card para mudar os gráficos'
      }
      loading={loading}
      error={error}
      onRetry={load}
    >
      <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Total despesas"
            value={String(r?.totalDespesas ?? 0)}
            selected={kpiId === 'qtd'}
            loading={loading}
            onClick={() => setKpiId('qtd')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Valor"
            value={fmtBrl(Number(r?.totalValor || 0))}
            selected={kpiId === 'valor'}
            loading={loading}
            onClick={() => setKpiId('valor')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Categorias"
            value={String(r?.despesasPorCategoria?.length ?? 0)}
            selected={kpiId === 'categorias'}
            loading={loading}
            onClick={() => setKpiId('categorias')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Fornecedores"
            value={String(r?.despesasPorFornecedor?.length ?? 0)}
            selected={kpiId === 'fornecedores'}
            loading={loading}
            onClick={() => setKpiId('fornecedores')}
          />
        </Grid>
      </Grid>

      {empty ? (
        <Grid container spacing={2} alignItems="flex-start">
          <Grid size={{ xs: 12, lg: 8 }}>
            <Alert
              severity="info"
              variant="outlined"
              action={
                !customRange && (periodo === 'hoje' || periodo === 'semana' || periodo === 'mes') ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => setPeriodo('7d')}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Últimos 7 dias
                  </Button>
                ) : undefined
              }
            >
              Sem despesas lançadas neste período no Financial. Quando houver, aparecem aqui por
              categoria e fornecedor. Lançamentos operacionais continuam no{' '}
              <Link
                component="a"
                href={`${S2_APP_URL}/despesas`}
                target="_blank"
                rel="noreferrer"
                fontWeight={700}
              >
                Financial
              </Link>
              .
            </Alert>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: { xs: 'stretch', lg: 'flex-end' },
              }}
            >
              <AiInsightPanel
                dominio="despesas"
                fallback={{
                  title: 'Sem despesas no período',
                  detail:
                    'Quando houver lançamentos no Financial, a leitura de categorias e fornecedores aparece aqui.',
                  recommendations: [
                    {
                      title: 'Ver pagamentos',
                      detail: 'Cruzar saídas com taxas e líquido.',
                      to: '/pagamentos',
                    },
                    {
                      title: 'Ver margens',
                      detail: 'Impacto das despesas no resultado.',
                      to: '/margens',
                    },
                  ],
                }}
              />
            </Box>
          </Grid>
        </Grid>
      ) : (
        <Stack spacing={2}>
          <Grid container spacing={2} alignItems="flex-start">
            <Grid size={{ xs: 12, lg: 8 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {leftTitle}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 1 }}
                      >
                        {byQtd
                          ? 'Ranking por quantidade'
                          : 'Barras horizontais · clique nos cards acima'}
                      </Typography>
                      <Box sx={{ width: '100%', height: { xs: 240, sm: 280 } }}>
                        {leftBars.length ? (
                          <ResponsiveContainer>
                            <BarChart
                              layout="vertical"
                              data={leftBars}
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
                                  if (byQtd) return String(Math.round(Number(n)))
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
                                formatter={(value, _n, item) => {
                                  const row = item?.payload as
                                    | { qtd?: number; valor?: number }
                                    | undefined
                                  if (byQtd) {
                                    return [
                                      `${Number(value)}${row?.valor != null ? ` · ${fmtBrl(row.valor)}` : ''}`,
                                      'Qtd',
                                    ]
                                  }
                                  return [
                                    `${fmtBrl(Number(value))}${row?.qtd != null ? ` · ${row.qtd} un` : ''}`,
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
                              <Bar dataKey={dataKey} radius={[0, 6, 6, 0]} maxBarSize={22}>
                                {leftBars.map((_, i) => (
                                  <Cell key={i} fill={chart.pie[i % chart.pie.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <ChartEmpty title="Sem dados neste gráfico." dense />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {rightTitle}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 1 }}
                      >
                        {byQtd ? 'Ranking por quantidade' : 'Ranking dos maiores valores'}
                      </Typography>
                      <Box sx={{ width: '100%', height: { xs: 240, sm: 280 } }}>
                        {rightBars.length ? (
                          <ResponsiveContainer>
                            <BarChart
                              layout="vertical"
                              data={rightBars}
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
                                  if (byQtd) return String(Math.round(Number(n)))
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
                                formatter={(value, _n, item) => {
                                  const row = item?.payload as
                                    | { qtd?: number; valor?: number }
                                    | undefined
                                  if (byQtd) {
                                    return [
                                      `${Number(value)}${row?.valor != null ? ` · ${fmtBrl(row.valor)}` : ''}`,
                                      'Qtd',
                                    ]
                                  }
                                  return [
                                    `${fmtBrl(Number(value))}${row?.qtd != null ? ` · ${row.qtd} un` : ''}`,
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
                              <Bar
                                dataKey={dataKey}
                                fill={chart.line}
                                radius={[0, 6, 6, 0]}
                                maxBarSize={22}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <ChartEmpty title="Sem dados neste gráfico." dense />
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
                  dominio="despesas"
                  fallback={{
                    title: `${fmtBrl(Number(r?.totalValor || 0))} em ${Number(r?.totalDespesas || 0)} lançamentos`,
                    detail:
                      'Leitura de despesas do período — categorias e fornecedores no mesmo recorte dos gráficos.',
                    recommendations: [
                      {
                        title: 'Ver pagamentos',
                        detail: 'Cruzar saídas com taxas e líquido.',
                        to: '/pagamentos',
                      },
                      {
                        title: 'Ver margens',
                        detail: 'Impacto das despesas no resultado.',
                        to: '/margens',
                      },
                    ],
                  }}
                />
              </Box>
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Por categoria (detalhe)
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Categoria</TableCell>
                    <TableCell align="right">Qtd</TableCell>
                    <TableCell align="right">Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(r?.despesasPorCategoria || []).map((c) => (
                    <TableRow key={String(c._id)}>
                      <TableCell>{c._id || '—'}</TableCell>
                      <TableCell align="right">{c.total ?? 0}</TableCell>
                      <TableCell align="right">{fmtBrl(Number(c.valor || 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Lançamentos
              </Typography>
              <Table size="small" sx={{ minWidth: 480 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Natureza</TableCell>
                    <TableCell>Fornecedor</TableCell>
                    <TableCell align="right">Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((d, i) => {
                    const forn = (d.fornecedor as { nome?: string } | undefined)?.nome
                    return (
                      <TableRow key={String(d._id || i)}>
                        <TableCell>{String(d.natureza || '—')}</TableCell>
                        <TableCell>{forn || '—'}</TableCell>
                        <TableCell align="right">{fmtBrl(Number(d.valor || 0))}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Stack>
      )}
    </DomainPageShell>
  )
}
