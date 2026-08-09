import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Grid,
  Link,
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
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchClientesRelatorio,
  S2_APP_URL,
  type ClientesRelatorio,
} from '../api/bridge'

type KpiId = 'total' | 'estados' | 'tipos'

function entriesOf(obj?: Record<string, number>) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1])
}

export function ClientesPage() {
  const { activeSourceId } = useBiSource()
  const theme = useTheme()
  const chart = theme.chart
  const [payload, setPayload] = useState<ClientesRelatorio | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpiId, setKpiId] = useState<KpiId>('estados')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchClientesRelatorio()
      .then(setPayload)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar clientes')
      })
      .finally(() => setLoading(false))
  }, [activeSourceId])

  useEffect(() => {
    load()
  }, [load])

  const r = payload?.relatorio
  const porEstado = entriesOf(r?.clientesPorEstado)
  const porTipo = entriesOf(r?.clientesPorTipo)
  const totalClientes = Number(r?.totalClientes || 0)

  const estadoBars = useMemo(
    () =>
      porEstado.slice(0, 10).map(([uf, n]) => ({
        name: uf || '—',
        total: n,
      })),
    [porEstado],
  )

  const tipoBars = useMemo(
    () =>
      porTipo.map(([tipo, n]) => ({
        name: tipo || '—',
        total: n,
      })),
    [porTipo],
  )

  const resumoBars = useMemo(
    () => [
      { name: 'Clientes', total: totalClientes, fill: chart.line },
      { name: 'Estados', total: porEstado.length, fill: chart.pie[0] },
      { name: 'Tipos', total: porTipo.length, fill: chart.pie[1] || chart.pie[0] },
    ],
    [totalClientes, porEstado.length, porTipo.length, chart],
  )

  const empty = !loading && totalClientes === 0

  const showResumoLeft = kpiId === 'total'
  const showTipoLeft = kpiId === 'tipos'
  const showEstadoLeft = kpiId === 'estados'

  return (
    <DomainPageShell
      title="Clientes"
      subtitle="Relatório agregado do Financial · clique num card para mudar os gráficos"
      loading={loading}
      error={error}
      onRetry={load}
    >
      <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Total clientes"
            value={String(totalClientes)}
            selected={kpiId === 'total'}
            loading={loading}
            onClick={() => setKpiId('total')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Estados"
            value={String(porEstado.length)}
            selected={kpiId === 'estados'}
            loading={loading}
            onClick={() => setKpiId('estados')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Tipos"
            value={String(porTipo.length)}
            selected={kpiId === 'tipos'}
            loading={loading}
            onClick={() => setKpiId('tipos')}
          />
        </Grid>
      </Grid>

      {empty ? (
        <Grid container spacing={2} alignItems="flex-start">
          <Grid size={{ xs: 12, lg: 8 }}>
            <Alert severity="info" variant="outlined">
              A base de clientes do Financial está vazia ou ainda não sincronizada. Pedidos e NFs
              continuam a operar independentemente. Cadastro completo no{' '}
              <Link
                component="a"
                href={`${S2_APP_URL}/clientes`}
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
                dominio="clientes"
                fallback={{
                  title: 'Sem clientes no Financial',
                  detail:
                    'Quando a base sincronizar, a leitura por estado e tipo aparece aqui ao lado dos gráficos.',
                  recommendations: [
                    {
                      title: 'Ver pedidos',
                      detail: 'Pedidos continuam a operar sem o cadastro.',
                      to: '/pedidos',
                    },
                    {
                      title: 'Ver vendas',
                      detail: 'Receita e canais do período.',
                      to: '/vendas',
                    },
                  ],
                }}
              />
            </Box>
          </Grid>
        </Grid>
      ) : (
        <>
          <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: showResumoLeft || showTipoLeft ? 5 : 7 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {showResumoLeft
                      ? 'Resumo da base'
                      : showTipoLeft
                        ? 'Por tipo'
                        : 'Por estado (UF)'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {showResumoLeft
                      ? 'Totais · estados · tipos'
                      : showTipoLeft
                        ? 'Barras verticais (poucas categorias)'
                        : 'Top 10 UFs por quantidade de clientes'}
                  </Typography>
                  <Box sx={{ width: '100%', height: { xs: 260, sm: 300 } }}>
                    {showResumoLeft ? (
                      <ResponsiveContainer>
                        <BarChart data={resumoBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                            width={40}
                          />
                          <Tooltip
                            formatter={(value) => [Number(value), 'Total']}
                            contentStyle={{
                              borderRadius: 8,
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          />
                          <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={56}>
                            {resumoBars.map((b) => (
                              <Cell key={b.name} fill={b.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : showTipoLeft ? (
                      tipoBars.length ? (
                        <ResponsiveContainer>
                          <BarChart data={tipoBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                              width={40}
                            />
                            <Tooltip
                              formatter={(value) => [Number(value), 'Clientes']}
                              contentStyle={{
                                borderRadius: 8,
                                border: `1px solid ${theme.palette.divider}`,
                              }}
                            />
                            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={56}>
                              {tipoBars.map((_, i) => (
                                <Cell key={i} fill={chart.pie[i % chart.pie.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ChartEmpty
                          title="Sem tipos cadastrados."
                          hint="Tipos vêm do cadastro de clientes no Financial."
                          suggestPeriod={false}
                          dense
                        />
                      )
                    ) : estadoBars.length ? (
                      <ResponsiveContainer>
                        <BarChart
                          layout="vertical"
                          data={estadoBars}
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
                            width={40}
                            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            formatter={(value) => [Number(value), 'Clientes']}
                            contentStyle={{
                              borderRadius: 8,
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          />
                          <Bar dataKey="total" fill={chart.line} radius={[0, 6, 6, 0]} maxBarSize={22} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmpty
                        title="Sem dados por estado."
                        hint="Distribuição por UF do cadastro de clientes no Financial."
                        suggestPeriod={false}
                        dense
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: showResumoLeft || showTipoLeft ? 7 : 5 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {showEstadoLeft || showResumoLeft ? 'Por tipo' : 'Por estado (UF)'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {showEstadoLeft || showResumoLeft
                      ? 'Barras verticais (poucas categorias)'
                      : 'Top 10 UFs por quantidade de clientes'}
                  </Typography>
                  <Box sx={{ width: '100%', height: { xs: 260, sm: 300 } }}>
                    {showEstadoLeft || showResumoLeft ? (
                      tipoBars.length ? (
                        <ResponsiveContainer>
                          <BarChart data={tipoBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                              width={40}
                            />
                            <Tooltip
                              formatter={(value) => [Number(value), 'Clientes']}
                              contentStyle={{
                                borderRadius: 8,
                                border: `1px solid ${theme.palette.divider}`,
                              }}
                            />
                            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={56}>
                              {tipoBars.map((_, i) => (
                                <Cell key={i} fill={chart.pie[i % chart.pie.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ChartEmpty
                          title="Sem tipos cadastrados."
                          hint="Tipos vêm do cadastro de clientes no Financial."
                          suggestPeriod={false}
                          dense
                        />
                      )
                    ) : estadoBars.length ? (
                      <ResponsiveContainer>
                        <BarChart
                          layout="vertical"
                          data={estadoBars}
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
                            width={40}
                            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            formatter={(value) => [Number(value), 'Clientes']}
                            contentStyle={{
                              borderRadius: 8,
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          />
                          <Bar dataKey="total" fill={chart.line} radius={[0, 6, 6, 0]} maxBarSize={22} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ChartEmpty
                        title="Sem dados por estado."
                        hint="Distribuição por UF do cadastro de clientes no Financial."
                        suggestPeriod={false}
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
                  dominio="clientes"
                  fallback={{
                    title: `${totalClientes} clientes na base`,
                    detail: `${porEstado.length} estados · ${porTipo.length} tipos no cadastro do Financial.`,
                    recommendations: [
                      {
                        title: 'Ver pedidos',
                        detail: 'Cruzar base com movimento do período.',
                        to: '/pedidos',
                      },
                      {
                        title: 'Ver vendas',
                        detail: 'Receita e canais do período.',
                        to: '/vendas',
                      },
                    ],
                  }}
                />
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Por estado
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>UF</TableCell>
                        <TableCell align="right">Clientes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {porEstado.map(([uf, n]) => (
                        <TableRow key={uf}>
                          <TableCell>{uf || '—'}</TableCell>
                          <TableCell align="right">{n}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Por tipo
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Tipo</TableCell>
                        <TableCell align="right">Clientes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {porTipo.map(([tipo, n]) => (
                        <TableRow key={tipo}>
                          <TableCell>{tipo || '—'}</TableCell>
                          <TableCell align="right">{n}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </DomainPageShell>
  )
}
