import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import {
  addDays,
  addWeeks,
  differenceInMinutes,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AiInsightPanel } from '../components/AiInsightPanel'
import { DomainPageShell } from '../components/DomainPageShell'
import { KpiCard } from '../components/KpiCard'
import { TasksCard } from '../components/TasksCard'
import { type AgendaEvent } from '../components/AgendaCard'
import { bridgeGet } from '../api/bridge'
import { BI_AGENDA_REFRESH } from '../utils/biRefresh'
import { nowSP, parseIsoSP } from '../utils/spTime'

type AgendaResponse = {
  events?: AgendaEvent[]
  count?: number
  google?: {
    google_connected?: boolean
    credentials_configured?: boolean
    auth_available?: boolean
    message?: string
  }
  periodo?: { inicio: string; fim: string; label: string }
}

type TasksResponse = {
  tasks?: Array<{ id: string; title: string; status: string; priority?: string; due?: string }>
  google?: { google_tasks_connected?: boolean; auth_available?: boolean; credentials_configured?: boolean }
}

type AuthUrlResponse = { auth_url?: string; error?: string }

const DAY_START_H = 8
const DAY_END_H = 19
const PX_PER_HOUR = 52

function parseEv(iso: string): Date | null {
  try {
    return parseIsoSP(iso)
  } catch {
    return null
  }
}

function greetingForHour(h: number): string {
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function fmtHm(d: Date): string {
  return format(d, 'HH:mm')
}

function isMeeting(ev: AgendaEvent): boolean {
  const k = (ev.kind || '').toLowerCase()
  const t = (ev.title || '').toLowerCase()
  return k.includes('reun') || t.includes('reuni') || t.includes('call') || t.includes('meeting')
}

function eventColor(ev: AgendaEvent, palette: string[]): string {
  if (isMeeting(ev)) return palette[0]
  const k = (ev.kind || ev.source || ev.title || '').toLowerCase()
  let h = 0
  for (let i = 0; i < k.length; i++) h = (h + k.charCodeAt(i) * (i + 1)) % palette.length
  return palette[h] || palette[0]
}

function freeBlocksToday(events: AgendaEvent[], day: Date): number {
  const slots: Array<[number, number]> = []
  for (const ev of events) {
    const s = parseEv(ev.start)
    if (!s || !isSameDay(s, day)) continue
    const e = ev.end ? parseEv(ev.end) : new Date(s.getTime() + 60 * 60 * 1000)
    if (!e) continue
    const a = Math.max(DAY_START_H * 60, s.getHours() * 60 + s.getMinutes())
    const b = Math.min(DAY_END_H * 60, e.getHours() * 60 + e.getMinutes())
    if (b > a) slots.push([a, b])
  }
  slots.sort((x, y) => x[0] - y[0])
  let cursor = DAY_START_H * 60
  let blocks = 0
  for (const [a, b] of slots) {
    if (a - cursor >= 45) blocks += 1
    cursor = Math.max(cursor, b)
  }
  if (DAY_END_H * 60 - cursor >= 45) blocks += 1
  return blocks
}

function isoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function AgendaPage() {
  const theme = useTheme()
  const pie = theme.chart.pie
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(nowSP(), { weekStartsOn: 1 }))
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [openTasks, setOpenTasks] = useState(0)
  const [highPriority, setHighPriority] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [googleCal, setGoogleCal] = useState(false)
  const [googleTasks, setGoogleTasks] = useState(false)
  const [authAvailable, setAuthAvailable] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor],
  )
  const weekEnd = weekDays[6]
  const todayKey = format(nowSP(), 'yyyy-MM-dd')
  const today = useMemo(() => parseISO(`${todayKey}T12:00:00`), [todayKey])
  const hourNow = nowSP().getHours()
  const weekChipLabel = useMemo(() => {
    if (isSameDay(weekAnchor, startOfWeek(nowSP(), { weekStartsOn: 1 }))) return 'Esta semana'
    return `${format(weekAnchor, 'd MMM', { locale: ptBR })} – ${format(weekEnd, 'd MMM', {
      locale: ptBR,
    })}`
  }, [weekAnchor, weekEnd])

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      const d0 = isoDate(weekAnchor)
      const d1 = isoDate(addDays(weekAnchor, 6))
      Promise.all([
        bridgeGet<AgendaResponse>('/agenda/periodo', {
          data_inicio: d0,
          data_fim: d1,
        }),
        bridgeGet<TasksResponse>('/tarefas', { status: 'open' }).catch(() => null),
      ])
        .then(([agenda, tasks]) => {
          setEvents(agenda.events || [])
          setGoogleCal(Boolean(agenda.google?.google_connected))
          setAuthAvailable(
            Boolean(agenda.google?.auth_available || agenda.google?.credentials_configured),
          )
          setNote(agenda.google?.message || null)
          const list = tasks?.tasks || []
          setOpenTasks(list.length)
          setHighPriority(list.filter((t) => t.priority === 'high').length)
          setGoogleTasks(Boolean(tasks?.google?.google_tasks_connected))
        })
        .catch((err: unknown) => {
          setEvents([])
          setError(err instanceof Error ? err.message : 'Falha ao carregar agenda')
        })
        .finally(() => setLoading(false))
    },
    [weekAnchor],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onRefresh = () => load(true)
    window.addEventListener(BI_AGENDA_REFRESH, onRefresh)
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => load(true), 20_000)
    return () => {
      window.removeEventListener(BI_AGENDA_REFRESH, onRefresh)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [load])

  const todayEvents = useMemo(() => {
    return events
      .map((ev) => ({ ev, start: parseEv(ev.start) }))
      .filter((x): x is { ev: AgendaEvent; start: Date } => Boolean(x.start && isSameDay(x.start, today)))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [events, today])

  const meetingsToday = todayEvents.filter(({ ev }) => isMeeting(ev)).length

  const focusedMinutes = useMemo(() => {
    let m = 0
    for (const { ev, start } of todayEvents) {
      const end = ev.end ? parseEv(ev.end) : null
      const mins = end ? Math.max(0, differenceInMinutes(end, start)) : 60
      m += mins
    }
    return m
  }, [todayEvents])

  const focusedLabel =
    focusedMinutes <= 0
      ? '—'
      : focusedMinutes < 60
        ? `~${focusedMinutes} min`
        : `~${Math.floor(focusedMinutes / 60)}h ${focusedMinutes % 60}m`

  const upcoming = useMemo(() => {
    const t = nowSP().getTime()
    return events
      .map((ev) => ({ ev, start: parseEv(ev.start) }))
      .filter((x): x is { ev: AgendaEvent; start: Date } => Boolean(x.start && x.start.getTime() >= t))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5)
  }, [events])

  const freeBlocks = freeBlocksToday(
    todayEvents.map((x) => x.ev),
    today,
  )

  const tip =
    freeBlocks >= 2
      ? `Você tem ${freeBlocks} blocos de tempo livre hoje. Considere reservar para trabalho estratégico.`
      : highPriority > 0
        ? `Há ${highPriority} prioridade${highPriority > 1 ? 's' : ''} em aberto — vale fechar antes das reuniões.`
        : openTasks > 0
          ? `${openTasks} tarefa${openTasks > 1 ? 's' : ''} aberta${openTasks > 1 ? 's' : ''}. Peça à Rica IA para criar ou concluir.`
          : 'Agenda em dia. Use a Rica IA para marcar compromissos ou criar tarefas.'

  const hours = useMemo(
    () => Array.from({ length: DAY_END_H - DAY_START_H }, (_, i) => DAY_START_H + i),
    [],
  )

  async function linkGoogle() {
    setLinking(true)
    try {
      const data = await bridgeGet<AuthUrlResponse>('/agenda/google/auth-url')
      if (data.auth_url) window.open(data.auth_url, '_blank', 'noopener,noreferrer')
      else setNote(data.error || 'Não foi possível iniciar o OAuth Google.')
    } catch {
      setNote('Credenciais Google ainda não configuradas no servidor.')
    } finally {
      setLinking(false)
    }
  }

  const integrations = [
    {
      id: 'gcal',
      name: 'Google Agenda',
      connected: googleCal,
      detail: googleCal ? 'Sincronizado' : authAvailable ? 'Ligar OAuth' : 'Aguardando credenciais',
    },
    {
      id: 'gtasks',
      name: 'Google Tasks',
      connected: googleTasks || googleCal,
      detail: googleTasks || googleCal ? 'Mesmo OAuth' : 'Ligar com Calendar',
    },
    {
      id: 'local',
      name: 'Agenda Fiesta',
      connected: true,
      detail: 'Store local + Rica IA',
    },
  ]

  return (
    <DomainPageShell
      title="Agenda & Tarefas"
      subtitle="Visão integrada · mesma fonte da Rica IA e do Telegram"
      loading={loading}
      error={error}
      onRetry={() => load()}
    >
      {/* Saudação */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'flex-end' }}
        spacing={1.5}
        sx={{ mb: 0.5 }}
      >
        <Box>
          <Typography
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 700,
              fontSize: { xs: '1.45rem', sm: '1.75rem' },
              lineHeight: 1.2,
            }}
          >
            {greetingForHour(hourNow)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aqui está o que mais importa na agenda Fiesta hoje.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            variant="outlined"
            label={format(today, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          />
          <Button size="small" onClick={() => load()} disabled={loading} sx={{ textTransform: 'none' }}>
            Atualizar
          </Button>
        </Stack>
      </Stack>

      {/* KPIs */}
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: 1.1, fontWeight: 700, display: 'block', mb: 1 }}
      >
        Agenda integrada
      </Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1.25, sm: 1.5 }}
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: 2 }}
      >
        {(
          [
            {
              label: 'Compromissos hoje',
              value: String(todayEvents.length),
              hint: todayEvents.length ? 'agendados' : 'nenhum ainda',
            },
            {
              label: 'Reuniões hoje',
              value: String(meetingsToday),
              hint: 'calls / reuniões',
            },
            {
              label: 'Tempo focado',
              value: focusedLabel,
              hint: 'reservado na agenda',
            },
            {
              label: 'Prioridades',
              value: String(highPriority || openTasks),
              hint: highPriority ? 'alta prioridade' : 'tarefas abertas',
            },
            {
              label: 'Tarefas abertas',
              value: String(openTasks),
              hint: 'Google Tasks + Fiesta',
            },
          ] as const
        ).map((k) => (
          <Box
            key={k.label}
            sx={{
              flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 0' },
              minWidth: { md: 140 },
            }}
          >
            <KpiCard label={k.label} value={k.value} hint={k.hint} loading={loading} />
          </Box>
        ))}
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* Agenda do dia — mais espaço */}
        <Grid size={{ xs: 12, md: 5, lg: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Agenda do dia</Typography>
                <Typography variant="caption" color="text.secondary">
                  {format(today, "EEEE, d/MM", { locale: ptBR })}
                </Typography>
              </Stack>
              <Box
                sx={{
                  position: 'relative',
                  height: (DAY_END_H - DAY_START_H) * PX_PER_HOUR,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.03),
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                }}
              >
                {hours.map((h) => (
                  <Box
                    key={h}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: (h - DAY_START_H) * PX_PER_HOUR,
                      borderTop: '1px dashed',
                      borderColor: 'divider',
                      pl: 1,
                      display: 'flex',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ width: 40, fontVariantNumeric: 'tabular-nums', mt: '-0.55em' }}
                    >
                      {String(h).padStart(2, '0')}:00
                    </Typography>
                  </Box>
                ))}
                {todayEvents.map(({ ev, start }) => {
                  const end = ev.end ? parseEv(ev.end) : new Date(start.getTime() + 60 * 60 * 1000)
                  if (!end) return null
                  const startMin = start.getHours() * 60 + start.getMinutes()
                  const endMin = end.getHours() * 60 + end.getMinutes()
                  const top = ((startMin - DAY_START_H * 60) / 60) * PX_PER_HOUR
                  const height = Math.max(28, ((endMin - startMin) / 60) * PX_PER_HOUR - 4)
                  if (endMin <= DAY_START_H * 60 || startMin >= DAY_END_H * 60) return null
                  const color = eventColor(ev, pie)
                  return (
                    <Box
                      key={ev.id}
                      sx={{
                        position: 'absolute',
                        left: 48,
                        right: 8,
                        top: Math.max(2, top),
                        height,
                        borderRadius: 1.5,
                        bgcolor: alpha(color, 0.16),
                        borderLeft: `3px solid ${color}`,
                        px: 1,
                        py: 0.5,
                        overflow: 'hidden',
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} noWrap display="block">
                        {ev.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {fmtHm(start)}–{fmtHm(end)}
                        {ev.source === 'google_calendar' ? ' · Google' : ''}
                      </Typography>
                    </Box>
                  )
                })}
                {!loading && todayEvents.length === 0 ? (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      px: 2,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      Sem compromissos hoje. Peça à Rica IA: «agenda call amanhã às 15h».
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Visão da semana */}
        <Grid size={{ xs: 12, md: 7, lg: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1.25 }}
                spacing={1}
              >
                <Typography variant="h6">Visão da semana</Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Chip size="small" label={weekChipLabel} variant="outlined" />
                  <IconButton
                    size="small"
                    aria-label="Semana anterior"
                    onClick={() => setWeekAnchor((w) => addWeeks(w, -1))}
                  >
                    <Typography component="span" sx={{ fontSize: 18, lineHeight: 1 }}>
                      ‹
                    </Typography>
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Próxima semana"
                    onClick={() => setWeekAnchor((w) => addWeeks(w, 1))}
                  >
                    <Typography component="span" sx={{ fontSize: 18, lineHeight: 1 }}>
                      ›
                    </Typography>
                  </IconButton>
                  {!isSameDay(weekAnchor, startOfWeek(nowSP(), { weekStartsOn: 1 })) ? (
                    <Button
                      size="small"
                      sx={{ textTransform: 'none', minWidth: 0 }}
                      onClick={() => setWeekAnchor(startOfWeek(nowSP(), { weekStartsOn: 1 }))}
                    >
                      Hoje
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {format(weekAnchor, 'd MMM', { locale: ptBR })} →{' '}
                {format(weekEnd, 'd MMM yyyy', { locale: ptBR })}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="stretch" sx={{ overflowX: 'auto', pb: 0.5 }}>
                {weekDays.map((day) => {
                  const dayEvs = events
                    .map((ev) => ({ ev, start: parseEv(ev.start) }))
                    .filter(
                      (x): x is { ev: AgendaEvent; start: Date } =>
                        Boolean(x.start && isSameDay(x.start, day)),
                    )
                    .sort((a, b) => a.start.getTime() - b.start.getTime())
                  const active = isSameDay(day, today)
                  return (
                    <Box
                      key={isoDate(day)}
                      sx={{
                        flex: '1 1 0',
                        minWidth: 88,
                        minHeight: 200,
                        p: 0.75,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: active ? 'primary.main' : 'divider',
                        bgcolor: active
                          ? alpha(theme.palette.primary.main, 0.06)
                          : 'background.default',
                      }}
                    >
                      <Stack alignItems="center" spacing={0.35} sx={{ mb: 0.75 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ textTransform: 'uppercase', fontSize: '0.65rem' }}
                        >
                          {format(day, 'EEE', { locale: ptBR })}
                        </Typography>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: active ? 'primary.main' : 'transparent',
                            color: active ? 'primary.contrastText' : 'text.primary',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            fontFamily: '"Outfit", sans-serif',
                          }}
                        >
                          {format(day, 'd')}
                        </Box>
                      </Stack>
                      <Stack spacing={0.4}>
                        {dayEvs.slice(0, 5).map(({ ev, start }) => (
                          <Box
                            key={ev.id}
                            sx={{
                              px: 0.5,
                              py: 0.35,
                              borderRadius: 1,
                              bgcolor: alpha(eventColor(ev, pie), 0.18),
                              borderLeft: `2px solid ${eventColor(ev, pie)}`,
                            }}
                          >
                            <Typography
                              variant="caption"
                              display="block"
                              noWrap
                              sx={{ fontSize: '0.65rem', fontWeight: 600, lineHeight: 1.2 }}
                            >
                              {fmtHm(start)}
                            </Typography>
                            <Typography
                              variant="caption"
                              display="block"
                              noWrap
                              sx={{ fontSize: '0.62rem', lineHeight: 1.2 }}
                            >
                              {ev.title}
                            </Typography>
                          </Box>
                        ))}
                        {dayEvs.length > 5 ? (
                          <Typography variant="caption" color="text.secondary">
                            +{dayEvs.length - 5}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Box>
                  )
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dica do dia */}
      <Card
        sx={{
          mb: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.22),
        }}
      >
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            spacing={1}
          >
            <Box>
              <Typography
                variant="caption"
                fontWeight={700}
                color="primary.main"
                sx={{ letterSpacing: 0.6 }}
              >
                DICA DO DIA
              </Typography>
              <Typography variant="body2">{tip}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              Rica IA · chat ou Telegram
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <TasksCard />
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
              dominio="agenda"
              ctaTo="/agenda"
              ctaLabel="Ver tarefas da semana"
              fallback={{
                title: openTasks
                  ? `${openTasks} tarefa(s) aberta(s) e ${todayEvents.length} compromisso(s) hoje`
                  : 'Agenda sob controlo',
                detail: tip,
                recommendations: [
                  {
                    title: 'Rever prioridades da semana',
                    detail: 'Tarefas e alertas priorizados pela IA num só lugar.',
                    to: '/insights/prioridades',
                  },
                  {
                    title: 'Abrir Command Center',
                    detail: 'Contexto de vendas antes de decidir a agenda.',
                    to: '/',
                  },
                ],
              }}
            />
          </Box>
        </Grid>
      </Grid>

      {/* Próximos + Integrações (largura total) */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                  Próximos compromissos
                </Typography>
                {upcoming.length ? (
                  <Stack spacing={1}>
                    {upcoming.map(({ ev, start }) => (
                      <Stack
                        key={ev.id}
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
                            bgcolor: eventColor(ev, pie),
                            mt: 0.7,
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {ev.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {isSameDay(start, today)
                              ? `${fmtHm(start)} · hoje`
                              : format(start, "HH:mm · EEE d/MM", { locale: ptBR })}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Nada agendado à frente nesta semana.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Typography variant="h6">Integrações</Typography>
                  {!googleCal && authAvailable ? (
                    <Button
                      size="small"
                      sx={{ textTransform: 'none' }}
                      onClick={() => void linkGoogle()}
                      disabled={linking}
                    >
                      Ligar Google
                    </Button>
                  ) : null}
                </Stack>
                <Stack spacing={1}>
                  {integrations.map((it) => (
                    <Stack
                      key={it.id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      spacing={1}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {it.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {it.detail}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={it.connected ? 'success' : 'default'}
                        variant="outlined"
                        label={it.connected ? 'Conectado' : 'Off'}
                      />
                    </Stack>
                  ))}
                </Stack>
                {note ? (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    {note}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
        </Grid>
      </Grid>
    </DomainPageShell>
  )
}
