import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import { AiInsightPanel } from '../components/AiInsightPanel'
import { OpsAlertsCard } from '../components/OpsAlertsCard'
import { SyncOpsCard } from '../components/SyncOpsCard'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchBridgeHealth,
  fetchLojas,
  fetchOpsAlerts,
  fetchOrigemPedidos,
  fetchOrigemStats,
  fetchSyncStatus,
  fmtBrl,
  S1_APP_URL,
  S2_APP_URL,
  type BridgeHealth,
  type LojasPayload,
  type OpsAlertsPayload,
  type OrigemPedidos,
  type OrigemStats,
  type SyncStatusPayload,
} from '../api/bridge'

function fmtTs(raw?: string | null) {
  if (!raw) return '—'
  try {
    return new Date(raw).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  } catch {
    return raw
  }
}

export function OperacoesPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { periodQuery, marketplace } = useBiData()
  const { activeSourceId } = useBiSource()
  const [origem, setOrigem] = useState<OrigemStats | null>(null)
  const [recent, setRecent] = useState<OrigemPedidos | null>(null)
  const [sync, setSync] = useState<SyncStatusPayload | null>(null)
  const [lojas, setLojas] = useState<LojasPayload | null>(null)
  const [health, setHealth] = useState<BridgeHealth | null>(null)
  const [ops, setOps] = useState<OpsAlertsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const range =
    'dataInicio' in periodQuery && periodQuery.dataInicio
      ? { dataInicio: periodQuery.dataInicio, dataFim: periodQuery.dataFim! }
      : undefined

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchOrigemStats().catch(() => null),
      fetchOrigemPedidos({
        per_page: 12,
        marketplace: marketplace || undefined,
        dataInicio: range?.dataInicio,
        dataFim: range?.dataFim,
      }).catch(() => null),
      fetchSyncStatus().catch(() => null),
      fetchLojas().catch(() => null),
      fetchBridgeHealth().catch(() => null),
      fetchOpsAlerts(periodQuery, marketplace || undefined).catch(() => null),
    ])
      .then(([o, r, s, l, h, a]) => {
        setOrigem(o)
        setRecent(r)
        setSync(s)
        setLojas(l)
        setHealth(h)
        setOps(a)
        if (!o && !r && !s && !l) setError('Operações indisponíveis no momento')
      })
      .finally(() => setLoading(false))
  }, [marketplace, range?.dataInicio, range?.dataFim, periodQuery, activeSourceId])

  useEffect(() => {
    load()
  }, [load])

  const porMp = (origem?.origem?.por_marketplace || []).slice(0, 8)
  const totalOrigem = porMp.reduce((s, x) => s + Number(x.total || 0), 0)
  const platforms = lojas?.s2_platform_stores || []
  const storeCount = platforms.reduce((s, p) => s + (p.stores?.length || 0), 0)

  const recentRows = useMemo(() => {
    const raw = recent?.pedidos
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object' && Array.isArray(raw.data)) return raw.data
    return []
  }, [recent])

  const canalBars = useMemo(
    () =>
      porMp
        .map((row, i) => ({
          name: String(row.marketplace || '—'),
          total: Number(row.total || 0),
          fill: chart.pie[i % chart.pie.length],
        }))
        .filter((r) => r.total > 0),
    [porMp, chart],
  )

  const alertBars = useMemo(() => {
    const counts = { error: 0, warning: 0, info: 0 }
    for (const a of ops?.alerts || []) {
      const sev = a.severity || 'info'
      if (sev === 'error') counts.error += 1
      else if (sev === 'warning') counts.warning += 1
      else counts.info += 1
    }
    return [
      { name: 'Erro', total: counts.error, fill: theme.palette.error.main },
      { name: 'Aviso', total: counts.warning, fill: theme.palette.warning.main },
      { name: 'Info', total: counts.info, fill: chart.line },
    ].filter((x) => x.total > 0)
  }, [ops?.alerts, theme.palette.error.main, theme.palette.warning.main, chart.line])

  const recentDaily = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of recentRows) {
      const r = row as { data_venda?: string }
      const raw = String(r.data_venda || '').slice(0, 10)
      if (!raw) continue
      const key = raw.length >= 10 ? raw.slice(5) : raw
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()]
      .map(([dia, total]) => ({ dia, total }))
      .sort((a, b) => a.dia.localeCompare(b.dia))
  }, [recentRows])

  const kpis = [
    {
      label: 'Pedidos S1 (hist.)',
      value: totalOrigem ? totalOrigem.toLocaleString('pt-BR') : '—',
      hint: `Hoje: ${origem?.origem?.hoje ?? '—'}`,
    },
    {
      label: 'Canais / lojas',
      value: `${platforms.length} · ${storeCount}`,
    },
    {
      label: 'Última sync',
      value:
        sync?.sync?.last_activity_marketplace ||
        sync?.sync?.last_sync_marketplace ||
        (sync?.sync?.last_sync_efetiva ? 'Automática' : '—'),
      hint: `${fmtTs(sync?.sync?.last_sync_efetiva || sync?.sync?.last_sync)}${
        sync?.sync?.last_sync_efetiva_origem === 'automatico' ? ' · job agendado' : ''
      }`,
    },
    {
      label: 'Estado sync',
      value: sync?.sync?.running ? 'A correr' : 'Idle',
      hint: sync?.ok === false ? 'Degradado' : 'OK',
    },
  ]

  return (
    <DomainPageShell
      title="Operações"
      subtitle="Sync, lojas, origem S1 e alertas — saúde do Sistema"
      loading={loading}
      error={error}
      onRetry={load}
      stats={kpis}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
        <Button
          size="small"
          href={`${S1_APP_URL}/marketplaces`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ textTransform: 'none' }}
        >
          Gerir no API (S1)
        </Button>
        <Button
          size="small"
          href={`${S2_APP_URL}/sistema`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ textTransform: 'none' }}
        >
          Sistema no Financial
        </Button>
      </Stack>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
              >
                <Typography variant="h6">Bridge / Agent Gateway</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    color={health?.ok ? 'success' : 'default'}
                    label={health?.ok ? 'Online' : '—'}
                  />
                  <Chip size="small" variant="outlined" label={`v${health?.version || '—'}`} />
                  <Chip
                    size="small"
                    variant="outlined"
                    color={health?.s1_configured ? 'success' : 'warning'}
                    label={health?.s1_configured ? 'S1 OK' : 'S1 off'}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    color={health?.hermes_bin ? 'success' : 'warning'}
                    label={health?.hermes_bin ? 'Rica IA OK' : 'Rica IA off'}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    color={health?.stt_configured ? 'success' : 'default'}
                    label={health?.stt_configured ? 'STT OK' : 'STT off'}
                  />
                </Stack>
              </Stack>
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
              dominio="operacoes"
              fallback={{
                title:
                  (ops?.alerts || []).length > 0
                    ? `${(ops?.alerts || []).length} alerta(s) operacional(is)`
                    : 'Operação sem alerta crítico no período',
                detail: 'Leitura de sync, cobertura e alertas — a mesma verdade do chat Hermes.',
                recommendations: [
                  {
                    title: 'Ver alertas',
                    detail: 'Priorizar desvios por impacto.',
                    to: '/insights/alertas',
                  },
                  { title: 'Ver fiscal', detail: 'Cobertura NF e margem.', to: '/fiscal' },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <SyncOpsCard />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <OpsAlertsCard />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Origem S1 · por canal
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Donut · pedidos históricos por marketplace
              </Typography>
              <Box sx={{ width: '100%', height: 220 }}>
                {canalBars.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={canalBars}
                        dataKey="total"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {canalBars.map((b) => (
                          <Cell key={b.name} fill={b.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Pedidos']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty
                    title="Sem stats S1."
                    hint="Bridge ou origem de pedidos indisponível — confere sync no API."
                    suggestPeriod={false}
                    dense
                  />
                )}
              </Box>
              {canalBars.length ? (
                <Stack spacing={0.35} sx={{ mt: 0.5, maxHeight: 120, overflow: 'auto' }}>
                  {canalBars.map((b) => (
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
                        {b.total.toLocaleString('pt-BR')}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : null}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {alertBars.length ? 'Alertas · por severidade' : 'Actividade recente · por dia'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {alertBars.length
                  ? 'Donut · alertas operacionais do período'
                  : 'Área · amostra recente da origem S1'}
              </Typography>
              <Box sx={{ width: '100%', height: 240 }}>
                {alertBars.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={alertBars}
                        dataKey="total"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={82}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {alertBars.map((b) => (
                          <Cell key={b.name} fill={b.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [Number(value), 'Alertas']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : recentDaily.length ? (
                  <ResponsiveContainer>
                    <AreaChart data={recentDaily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        formatter={(value) => [Number(value), 'Pedidos']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke={chart.line}
                        fill={chart.line}
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty
                    title="Sem alertas nem actividade recente."
                    hint="Quando houver sync/alertas, o gráfico aparece aqui."
                    suggestPeriod={false}
                    dense
                  />
                )}
              </Box>
              {alertBars.length && recentDaily.length ? (
                <Box sx={{ width: '100%', height: 140, mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Actividade recente · por dia
                  </Typography>
                  <ResponsiveContainer>
                    <AreaChart data={recentDaily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <XAxis
                        dataKey="dia"
                        tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={(value) => [Number(value), 'Pedidos']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke={chart.fill || chart.line}
                        fill={chart.fill || chart.line}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              ) : null}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Lojas configuradas (S2)
              </Typography>
              <Stack spacing={1}>
                {platforms.map((p) => (
                  <Stack key={p.key || p.label} spacing={0.5}>
                    <Typography variant="subtitle2">{p.label || p.key}</Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                      {(p.stores || []).map((s) => (
                        <Chip
                          key={s.id || s.label}
                          size="small"
                          variant="outlined"
                          label={s.label || s.name || 'loja'}
                        />
                      ))}
                    </Stack>
                  </Stack>
                ))}
                {!loading && platforms.length === 0 ? (
                  <ChartEmpty
                    title="Sem lojas."
                    hint="Nenhuma loja configurada no sync — abre Marketplaces no API."
                    suggestPeriod={false}
                    dense
                  />
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Actividade recente (origem S1)
              </Typography>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Canal</TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Produto</TableCell>
                    <TableCell align="right">Valor</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentRows.map((row, i) => {
                    const r = row as {
                      id?: string
                      id_pedido?: string
                      marketplace?: string
                      status_pedido?: string
                      data_venda?: string
                      nome_produto?: string
                      valor?: number
                    }
                    return (
                      <TableRow key={String(r.id || r.id_pedido || i)}>
                        <TableCell>{r.data_venda || '—'}</TableCell>
                        <TableCell>{r.marketplace || '—'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 140 }}>
                            {r.id_pedido || r.id || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={r.status_pedido || '—'} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                            {r.nome_produto || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{fmtBrl(Number(r.valor || 0))}</TableCell>
                      </TableRow>
                    )
                  })}
                  {!loading && recentRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <ChartEmpty
                          title="Sem actividade recente."
                          hint="Sem eventos de sync recentes neste intervalo."
                          suggestPeriod={false}
                          dense
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </DomainPageShell>
  )
}
