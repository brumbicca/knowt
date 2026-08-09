import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Link,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { format, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChartEmpty } from '../components/ChartEmpty'
import { DomainPageShell } from '../components/DomainPageShell'
import { AiInsightPanel } from '../components/AiInsightPanel'
import { Hicon, type HiconName } from '../components/Hicon'
import { Sparkline } from '../components/Sparkline'
import { nowSP, parseIsoSP } from '../utils/spTime'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  bridgeGet,
  bridgePost,
  fetchInsightPlano,
  fetchOpsAlerts,
  fmtBrl,
  type InsightDominio,
  type InsightPlano,
  type OpsAlert,
  type OpsAlertsPayload,
} from '../api/bridge'

type BiTask = {
  id: string
  title: string
  status: string
  priority?: string
  due?: string
  created_at?: string
  updated_at?: string
  source?: string
}

type TasksResponse = { tasks?: BiTask[]; count?: number }

type PriorityArea =
  | 'Comercial'
  | 'Fiscal'
  | 'Margem'
  | 'Sync'
  | 'Operações'
  | 'Agenda'
  | 'Financeiro'

type PriorityStatus = 'concluida' | 'andamento' | 'pendente' | 'atrasada'

type PriorityRow = {
  id: string
  title: string
  detail?: string
  area: PriorityArea
  impact: 'Alto' | 'Médio' | 'Baixo'
  score: number
  prazoLabel: string
  prazoDate: Date | null
  status: PriorityStatus
  source: 'tarefa' | 'alerta' | 'gap' | 'insight'
  href: string
}

function areaFromDomain(dominio: InsightDominio): PriorityArea {
  if (dominio === 'comercial' || dominio === 'mix') return 'Comercial'
  if (dominio === 'logistica') return 'Operações'
  if (dominio === 'financeiro') return 'Financeiro'
  if (dominio === 'fiscal') return 'Fiscal'
  return 'Operações'
}

function categorizeAlert(alert: OpsAlert): PriorityArea {
  const blob = `${alert.code} ${alert.title} ${alert.detail}`.toLowerCase()
  if (/nf|fiscal|nota|invoice/.test(blob)) return 'Fiscal'
  if (/margem|cmv|cobertura|margin/.test(blob)) return 'Margem'
  if (/sync|upseller|token|oauth|beat/.test(blob)) return 'Sync'
  if (/taxa|pagamento|receita|financeiro|despesa/.test(blob)) return 'Financeiro'
  if (/venda|canal|marketplace|pedido|comercial/.test(blob)) return 'Comercial'
  return 'Operações'
}

function categorizeTask(title: string): PriorityArea {
  const t = title.toLowerCase()
  if (/nf|fiscal|nota/.test(t)) return 'Fiscal'
  if (/margem|cmv|cobertura/.test(t)) return 'Margem'
  if (/sync|upseller|token|oauth/.test(t)) return 'Sync'
  if (/venda|canal|comercial|pedido|marketplace/.test(t)) return 'Comercial'
  if (/pag|despesa|financeiro|taxa|receita/.test(t)) return 'Financeiro'
  if (/agenda|reuni|call|demo/.test(t)) return 'Agenda'
  return 'Agenda'
}

function parseDue(iso?: string): Date | null {
  if (!iso) return null
  try {
    return parseIsoSP(iso)
  } catch {
    return null
  }
}

function fmtPrazo(d: Date | null): string {
  if (!d) return '—'
  return format(d, 'dd/MMM', { locale: ptBR })
}

function statusLabel(s: PriorityStatus): string {
  if (s === 'concluida') return 'Concluída'
  if (s === 'andamento') return 'Em andamento'
  if (s === 'atrasada') return 'Atrasada'
  return 'Pendente'
}

function statusColor(
  s: PriorityStatus,
  theme: { palette: { success: { main: string }; warning: { main: string }; error: { main: string }; info: { main: string } } },
): string {
  if (s === 'concluida') return theme.palette.success.main
  if (s === 'andamento') return theme.palette.warning.main
  if (s === 'atrasada') return theme.palette.error.main
  return theme.palette.info.main
}

type MetaKpiProps = {
  label: string
  value: string
  hint: string
  progress: number
  icon: HiconName
  color: string
  extra?: ReactNode
}

function MetaKpi({ label, value, hint, progress, icon, color, extra }: MetaKpiProps) {
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
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(color, 0.18),
              color,
            }}
          >
            <Hicon name={icon} sx={{ fontSize: '1rem' }} />
          </Box>
          <Typography
            variant="caption"
            fontWeight={700}
            letterSpacing={0.06}
            sx={{ textTransform: 'uppercase', color }}
          >
            {label}
          </Typography>
        </Stack>
        <Typography
          sx={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
            fontSize: '1.35rem',
            lineHeight: 1.15,
            fontVariantNumeric: 'tabular-nums',
            mb: 0.35,
          }}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {hint}
        </Typography>
        {extra ?? (
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, progress))}
            sx={{
              height: 7,
              borderRadius: 999,
              bgcolor: alpha(color, 0.12),
              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 999 },
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}

/** Insights · Prioridades da semana (pág.14) — tarefas + ops/alerts. */
export function InsightsPrioridadesPage() {
  const theme = useTheme()
  const chart = theme.chart
  const { periodQuery, marketplace, data, loading: dataLoading } = useBiData()
  const { activeSourceId } = useBiSource()
  const [ops, setOps] = useState<OpsAlertsPayload | null>(null)
  const [tasks, setTasks] = useState<BiTask[]>([])
  const [plan, setPlan] = useState<InsightPlano | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingTask, setCreatingTask] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchOpsAlerts(periodQuery, marketplace || undefined).catch(() => null),
      bridgeGet<TasksResponse>('/tarefas', { status: 'all' }).catch(() => null),
      fetchInsightPlano(periodQuery, marketplace || undefined).catch(() => null),
    ])
      .then(([alerts, tarefas, plano]) => {
        setOps(alerts)
        setTasks(tarefas?.tasks || [])
        setPlan(plano)
        if (!alerts && !tarefas && !plano) setError('Não foi possível carregar prioridades.')
      })
      .finally(() => setLoading(false))
  }, [periodQuery, marketplace, activeSourceId])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 45_000)
    return () => window.clearInterval(timer)
  }, [load])

  const today = useMemo(() => startOfDay(nowSP()), [])
  const trackInsight = useCallback(
    async (row: PriorityRow) => {
      setCreatingTask(row.id)
      setError(null)
      try {
        await bridgePost('/tarefas', {
          title: row.title,
          priority: row.impact === 'Alto' ? 'high' : row.impact === 'Médio' ? 'medium' : 'low',
          due: format(today, 'yyyy-MM-dd'),
          notes: `${row.detail || 'Ação sugerida pelo Insight da IA.'}\nDestino no BI: ${row.href}`,
        })
        load()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível criar a tarefa.')
      } finally {
        setCreatingTask(null)
      }
    },
    [load, today],
  )
  const ticketMedio = data && data.pedidos > 0 ? data.vendas / data.pedidos : 0
  const gapSemNf = Number(ops?.margin_gap?.sem_nf || 0)
  const cobertura = ops?.margin_coverage?.cobertura_pct ?? data?.coberturaPct

  const rows = useMemo(() => {
    const out: PriorityRow[] = []

    for (const t of tasks) {
      const due = parseDue(t.due)
      const done = t.status === 'done'
      const overdue = !done && due != null && isBefore(startOfDay(due), today)
      let status: PriorityStatus = 'pendente'
      if (done) status = 'concluida'
      else if (overdue) status = 'atrasada'
      else if (t.priority === 'high') status = 'andamento'
      else if (t.priority === 'medium') status = 'andamento'
      else status = 'pendente'

      const impact: PriorityRow['impact'] =
        t.priority === 'high' || overdue ? 'Alto' : t.priority === 'low' ? 'Baixo' : 'Médio'
      const score =
        (t.priority === 'high' ? 85 : t.priority === 'medium' ? 55 : 30) + (overdue ? 15 : 0)

      out.push({
        id: `task-${t.id}`,
        title: t.title,
        area: categorizeTask(t.title),
        impact,
        score: Math.min(100, score),
        prazoLabel: fmtPrazo(due),
        prazoDate: due,
        status,
        source: 'tarefa',
        href: '/insights/agenda',
      })
    }

    for (const a of ops?.alerts || []) {
      const area = categorizeAlert(a)
      const status: PriorityStatus =
        a.severity === 'error' ? 'atrasada' : a.severity === 'warning' ? 'andamento' : 'pendente'
      const impact: PriorityRow['impact'] =
        a.severity === 'error' ? 'Alto' : a.severity === 'warning' ? 'Médio' : 'Baixo'
      const score = a.severity === 'error' ? 92 : a.severity === 'warning' ? 62 : 28
      out.push({
        id: `alert-${a.code}-${a.at || a.title}`,
        title: a.title,
        area,
        impact,
        score,
        prazoLabel: 'Hoje',
        prazoDate: today,
        status,
        source: 'alerta',
        href: area === 'Fiscal' ? '/insights/financeiro' : area === 'Margem' ? '/insights/financeiro' : '/insights/prioridades',
      })
    }

    if (gapSemNf > 0) {
      out.push({
        id: 'gap-sem-nf',
        title: `Fechar ${gapSemNf} pedidos sem NF`,
        area: 'Fiscal',
        impact: gapSemNf >= 10 ? 'Alto' : 'Médio',
        score: Math.min(100, 70 + Math.min(25, gapSemNf)),
        prazoLabel: 'Semana',
        prazoDate: null,
        status: 'andamento',
        source: 'gap',
        href: '/insights/financeiro',
      })
    }

    if (cobertura != null && cobertura < 90) {
      out.push({
        id: 'gap-cobertura',
        title: `Subir cobertura CMV/NF (${cobertura}%)`,
        area: 'Margem',
        impact: cobertura < 70 ? 'Alto' : 'Médio',
        score: cobertura < 70 ? 88 : 68,
        prazoLabel: 'Semana',
        prazoDate: null,
        status: 'andamento',
        source: 'gap',
        href: '/insights/financeiro',
      })
    }

    for (const action of plan?.acoes || []) {
      const normalizedTitle = action.titulo.trim().toLocaleLowerCase('pt-BR')
      if (out.some((row) => row.title.trim().toLocaleLowerCase('pt-BR') === normalizedTitle)) {
        continue
      }
      const impact: PriorityRow['impact'] =
        action.impacto === 'alto' ? 'Alto' : action.impacto === 'medio' ? 'Médio' : 'Baixo'
      out.push({
        id: `insight-${action.dominio}-${normalizedTitle}`,
        title: action.titulo,
        detail: action.detalhe,
        area: areaFromDomain(action.dominio),
        impact,
        score: Math.min(100, Math.max(0, action.score)),
        prazoLabel: action.impacto === 'alto' ? 'Hoje' : 'Semana',
        prazoDate: action.impacto === 'alto' ? today : null,
        status: action.impacto === 'alto' ? 'andamento' : 'pendente',
        source: 'insight',
        href: action.destino || '/insights/alertas',
      })
    }

    out.sort((a, b) => {
      const rank = (s: PriorityStatus) =>
        s === 'atrasada' ? 0 : s === 'andamento' ? 1 : s === 'pendente' ? 2 : 3
      return rank(a.status) - rank(b.status) || b.score - a.score
    })
    return out
  }, [tasks, ops, gapSemNf, cobertura, plan, today])

  const counts = useMemo(() => {
    const total = rows.length
    const concluida = rows.filter((r) => r.status === 'concluida').length
    const andamento = rows.filter((r) => r.status === 'andamento').length
    const atrasada = rows.filter((r) => r.status === 'atrasada').length
    const pendente = rows.filter((r) => r.status === 'pendente').length
    const alto = rows.filter((r) => r.impact === 'Alto' && r.status !== 'concluida').length
    return { total, concluida, andamento, atrasada, pendente, alto }
  }, [rows])

  const areaBars = useMemo(() => {
    const map = new Map<PriorityArea, number>()
    for (const r of rows) {
      if (r.status === 'concluida') continue
      map.set(r.area, (map.get(r.area) || 0) + 1)
    }
    const colors: Record<PriorityArea, string> = {
      Comercial: chart.pie[0] || theme.palette.primary.main,
      Fiscal: theme.palette.error.main,
      Margem: theme.palette.warning.main,
      Sync: chart.pie[1] || chart.line,
      Operações: chart.pie[2] || chart.fill,
      Agenda: chart.pie[3] || theme.palette.info.main,
      Financeiro: chart.pie[4] || theme.palette.success.main,
    }
    return [...map.entries()]
      .map(([name, total]) => ({ name, total, fill: colors[name] }))
      .sort((a, b) => b.total - a.total)
  }, [rows, chart, theme])

  const areaTotal = areaBars.reduce((s, c) => s + c.total, 0)
  const top5 = rows.filter((r) => r.status !== 'concluida').slice(0, 5)

  const impactoStars = Math.max(
    1,
    Math.min(5, counts.alto >= 4 ? 5 : counts.alto >= 3 ? 4 : counts.alto >= 1 ? 3 : counts.total ? 2 : 1),
  )
  const impactoLabel =
    impactoStars >= 4 ? 'Alto impacto esperado' : impactoStars >= 3 ? 'Impacto médio' : 'Baixo impacto'

  const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0)

  const sparkImpact = useMemo(() => {
    if (data?.daily?.length) return data.daily.map((d) => d.valor)
    return [20, 28, 24, 36, 40, 38, 48]
  }, [data?.daily])

  const focusText =
    plan?.acoes?.[0]
      ? `Comece por “${plan.acoes[0].titulo}”. ${plan.acoes[0].detalhe}`
      : counts.alto > 0
        ? `Concentre-se nas ${Math.min(3, counts.alto)} prioridades de alto impacto para gerar os melhores resultados. Menos tarefas, mais impacto.`
      : counts.atrasada > 0
        ? `Há ${counts.atrasada} item(ns) atrasado(s) — resolva-os antes de abrir novas frentes.`
        : 'Semana estável: mantenha o ritmo nas tarefas em andamento e revise alertas operacionais.'

  return (
    <DomainPageShell
      title="Prioridades"
      subtitle="Prioridades da semana · tarefas + alertas operacionais"
      loading={(loading || dataLoading) && !ops && !tasks.length && !plan}
      error={error}
      onRetry={load}
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
            Prioridades da semana
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Metas, status e distribuição por área — mesmo motor do knowt / Agenda.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" onClick={load} disabled={loading} sx={{ textTransform: 'none' }}>
            Atualizar
          </Button>
          <Link
            component={RouterLink}
            to="/insights/agenda"
            underline="hover"
            fontWeight={600}
            sx={{ fontSize: '0.85rem' }}
          >
            Ver plano completo da semana →
          </Link>
        </Stack>
      </Stack>

      {gapSemNf > 0 || (cobertura != null && cobertura < 95) ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
          {gapSemNf ? `${gapSemNf} sem NF` : null}
          {gapSemNf && ticketMedio > 0 ? ` · impacto est. ${fmtBrl(gapSemNf * ticketMedio)}` : null}
          {cobertura != null ? `${gapSemNf ? ' · ' : ''}Cobertura CMV/NF ${cobertura}%` : null}
        </Typography>
      ) : null}

      <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
        {(
          [
            {
              label: 'Metas da semana',
              value: String(counts.total),
              hint: counts.total ? 'objetivos definidos' : 'ainda sem itens',
              progress: 100,
              icon: 'activity' as const,
              color: theme.palette.primary.main,
            },
            {
              label: 'Concluídas',
              value: String(counts.concluida),
              hint: 'objetivos finalizados',
              progress: pct(counts.concluida, counts.total),
              icon: 'document' as const,
              color: theme.palette.success.main,
            },
            {
              label: 'Em andamento',
              value: String(counts.andamento),
              hint: 'objetivos em progresso',
              progress: pct(counts.andamento, counts.total),
              icon: 'clock' as const,
              color: theme.palette.warning.main,
            },
            {
              label: 'Atrasadas',
              value: String(counts.atrasada),
              hint: counts.atrasada ? 'requerem atenção' : 'nenhuma atrasada',
              progress: pct(counts.atrasada, counts.total || 1),
              icon: 'report' as const,
              color: theme.palette.error.main,
            },
          ] as const
        ).map((k) => (
          <Box
            key={k.label}
            sx={{ flex: { xs: '1 1 calc(50% - 10px)', md: '1 1 0' }, minWidth: { md: 130 } }}
          >
            <MetaKpi {...k} />
          </Box>
        ))}
        <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 0' }, minWidth: { md: 150 } }}>
          <MetaKpi
            label="Impacto estimado"
            value={impactoLabel}
            hint={`${counts.alto} de alto impacto abertas`}
            progress={impactoStars * 20}
            icon="graph"
            color={theme.palette.primary.main}
            extra={
              <Stack direction="row" spacing={0.35} alignItems="center">
                {Array.from({ length: 5 }, (_, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor:
                        i < impactoStars
                          ? theme.palette.primary.main
                          : alpha(theme.palette.primary.main, 0.2),
                    }}
                  />
                ))}
              </Stack>
            }
          />
        </Box>
      </Stack>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={1}
                sx={{ mb: 1.5 }}
              >
                <Box>
                  <Typography variant="h6">Top 5 prioridades da semana</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ordenado por urgência e impacto · IA + tarefas + alertas
                  </Typography>
                </Box>
              </Stack>

              {top5.length ? (
                <Stack spacing={1}>
                  {top5.map((row, i) => {
                    const sc = statusColor(row.status, theme)
                    const impactColor =
                      row.impact === 'Alto'
                        ? theme.palette.success.main
                        : row.impact === 'Médio'
                          ? theme.palette.warning.main
                          : theme.palette.text.secondary
                    return (
                      <Stack
                        key={row.id}
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        alignItems={{ sm: 'center' }}
                        component={RouterLink}
                        to={row.href}
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.default',
                          textDecoration: 'none',
                          color: 'inherit',
                          '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.45) },
                        }}
                      >
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                            color: 'primary.main',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {row.title}
                          </Typography>
                          {row.detail ? (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              display="block"
                            >
                              {row.detail}
                            </Typography>
                          ) : null}
                          <Typography variant="caption" color="text.secondary">
                            {row.source === 'tarefa'
                              ? 'Tarefa'
                              : row.source === 'alerta'
                                ? 'Alerta'
                                : row.source === 'insight'
                                  ? 'Insight da IA'
                                  : 'Gap'}{' '}
                            · {row.area}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={row.area}
                          variant="outlined"
                          sx={{ flexShrink: 0, display: { xs: 'none', md: 'inline-flex' } }}
                        />
                        <Chip
                          size="small"
                          label={row.impact}
                          sx={{
                            flexShrink: 0,
                            bgcolor: alpha(impactColor, 0.12),
                            color: impactColor,
                            fontWeight: 700,
                            minWidth: 64,
                          }}
                        />
                        <Typography
                          variant="caption"
                          fontWeight={600}
                          sx={{ minWidth: 52, textAlign: 'center', flexShrink: 0 }}
                        >
                          {row.prazoLabel}
                        </Typography>
                        <Chip
                          size="small"
                          label={statusLabel(row.status)}
                          sx={{
                            flexShrink: 0,
                            bgcolor: alpha(sc, 0.12),
                            color: sc,
                            fontWeight: 600,
                            minWidth: 100,
                          }}
                        />
                        {row.source === 'insight' ? (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={creatingTask === row.id}
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              void trackInsight(row)
                            }}
                            sx={{ flexShrink: 0, textTransform: 'none', whiteSpace: 'nowrap' }}
                          >
                            {creatingTask === row.id ? 'Criando…' : 'Acompanhar'}
                          </Button>
                        ) : null}
                      </Stack>
                    )
                  })}
                </Stack>
              ) : (
                <ChartEmpty
                  title={
                    loading ? 'A carregar prioridades…' : 'Nenhuma prioridade aberta — boa semana.'
                  }
                  dense
                />
              )}

              <Box sx={{ textAlign: 'center', mt: 1.5 }}>
                <Link
                  component={RouterLink}
                  to="/insights/agenda"
                  underline="hover"
                  fontWeight={600}
                  sx={{ fontSize: '0.85rem' }}
                >
                  Ver todas as prioridades →
                </Link>
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
              dominio="home"
              ctaTo="/insights/agenda"
              ctaLabel="Ver plano completo da semana"
              fallback={{
                title:
                  counts.atrasada > 0
                    ? `${counts.atrasada} prioridade(s) atrasada(s)`
                    : counts.total
                      ? `${counts.andamento} em andamento · ${counts.concluida} concluídas`
                      : 'Sem prioridades abertas na semana',
                detail:
                  gapSemNf > 0
                    ? `Há ${gapSemNf} pedidos sem NF — cruzar com alertas e Agenda.`
                    : 'Plano da semana com tarefas, alertas e leitura da IA — mesmo motor do knowt.',
                recommendations: [
                  {
                    title: 'Ver alertas',
                    detail: 'Severidade e gaps que alimentam o ranking.',
                    to: '/insights/alertas',
                  },
                  {
                    title: 'Abrir Agenda',
                    detail: 'Editar tarefas e prazos da semana.',
                    to: '/agenda',
                  },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      <Card sx={{ height: '100%', borderRadius: 2, mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Distribuição por área
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Prioridades abertas · {areaTotal} itens
          </Typography>
          <Grid container spacing={2} alignItems="flex-start">
            <Grid size={{ xs: 12, md: 5 }}>
              <Box sx={{ width: '100%', height: 180 }}>
                {areaBars.length ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={areaBars}
                        dataKey="total"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {areaBars.map((b) => (
                          <Cell key={b.name} fill={b.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [Number(value), 'Prioridades']}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty title="Sem distribuição neste snapshot." dense />
                )}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              {areaBars.length ? (
                <Stack spacing={0.85}>
                  {areaBars.map((b) => {
                    const share = areaTotal ? Math.round((100 * b.total) / areaTotal) : 0
                    return (
                      <Box key={b.name}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.35 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: b.fill }} />
                            <Typography variant="caption" color="text.secondary">
                              {b.name}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" fontWeight={600}>
                            {b.total} · {share}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={share}
                          sx={{
                            height: 6,
                            borderRadius: 999,
                            bgcolor: alpha(b.fill, 0.12),
                            '& .MuiLinearProgress-bar': { bgcolor: b.fill, borderRadius: 999 },
                          }}
                        />
                      </Box>
                    )
                  })}
                </Stack>
              ) : null}
              <Box sx={{ textAlign: 'center', mt: 1.5 }}>
                <Link
                  component={RouterLink}
                  to="/insights/alertas"
                  underline="hover"
                  fontWeight={600}
                  sx={{ fontSize: '0.85rem' }}
                >
                  Ver análise de alertas →
                </Link>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.22),
          bgcolor: alpha(theme.palette.primary.main, 0.06),
        }}
      >
        <CardContent sx={{ py: 1.75, '&:last-child': { pb: 1.75 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ flex: 1 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.16),
                  color: 'primary.main',
                  flexShrink: 0,
                }}
              >
                <Hicon name="activity" sx={{ fontSize: '1.15rem' }} />
              </Box>
              <Box>
                <Typography variant="overline" fontWeight={800} letterSpacing={0.08} color="primary">
                  Foco da semana
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {focusText}
                </Typography>
              </Box>
            </Stack>
            <Box sx={{ width: { xs: '100%', sm: 140 }, flexShrink: 0 }}>
              <Sparkline values={sparkImpact} height={36} />
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </DomainPageShell>
  )
}
