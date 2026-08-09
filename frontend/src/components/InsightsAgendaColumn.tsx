import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Link,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import { format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { bridgeGet, bridgePost } from '../api/bridge'
import { type AgendaEvent } from './AgendaCard'
import { nowSP, parseIsoSP } from '../utils/spTime'
import { Hicon } from './Hicon'
import { BI_AGENDA_REFRESH, BI_TASKS_REFRESH } from '../utils/biRefresh'

type AgendaResponse = { events?: AgendaEvent[] }

type BiTask = {
  id: string
  title: string
  status: string
  priority?: string
}

type TasksResponse = { tasks?: BiTask[] }

function parseEv(iso: string): Date | null {
  try {
    return parseIsoSP(iso)
  } catch {
    return null
  }
}

function fmtHm(d: Date): string {
  return format(d, 'HH:mm')
}

const PRIORITY_CHIP: Record<string, { label: string; color: 'error' | 'warning' | 'default' }> = {
  high: { label: 'Alta', color: 'error' },
  medium: { label: 'Média', color: 'warning' },
  low: { label: 'Baixa', color: 'default' },
}

/** Coluna compacta estilo PDF pág.12 — diferente da Agenda Business completa. */
export function InsightsAgendaColumn() {
  const theme = useTheme()
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [tasks, setTasks] = useState<BiTask[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    Promise.all([
      bridgeGet<AgendaResponse>('/agenda/periodo', { periodo: 'proximos' }).catch(() => null),
      bridgeGet<TasksResponse>('/tarefas', { status: 'open' }).catch(() => null),
    ])
      .then(([agenda, tarefas]) => {
        setEvents(agenda?.events || [])
        setTasks(tarefas?.tasks || [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const refresh = () => load(true)
    window.addEventListener(BI_AGENDA_REFRESH, refresh)
    window.addEventListener(BI_TASKS_REFRESH, refresh)
    const timer = window.setInterval(refresh, 20_000)
    return () => {
      window.removeEventListener(BI_AGENDA_REFRESH, refresh)
      window.removeEventListener(BI_TASKS_REFRESH, refresh)
      window.clearInterval(timer)
    }
  }, [load])

  const today = useMemo(() => nowSP(), [])

  const todayEvents = useMemo(() => {
    return events
      .map((ev) => ({ ev, start: parseEv(ev.start) }))
      .filter((x): x is { ev: AgendaEvent; start: Date } => Boolean(x.start && isSameDay(x.start, today)))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5)
  }, [events, today])

  const upcoming = useMemo(() => {
    const t = nowSP().getTime()
    return events
      .map((ev) => ({ ev, start: parseEv(ev.start) }))
      .filter(
        (x): x is { ev: AgendaEvent; start: Date } =>
          Boolean(x.start && x.start.getTime() >= t && !isSameDay(x.start, today)),
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 4)
  }, [events, today])

  const openTasks = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => {
          const rank = (p?: string) => (p === 'high' ? 0 : p === 'medium' ? 1 : 2)
          return rank(a.priority) - rank(b.priority)
        })
        .slice(0, 5),
    [tasks],
  )

  async function completeTask(id: string) {
    try {
      await bridgePost('/tarefas/concluir', { id })
      setTasks((prev) => prev.filter((t) => t.id !== id))
      window.dispatchEvent(new Event(BI_TASKS_REFRESH))
    } catch {
      /* ignore */
    }
  }

  const cardSx = {
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: 'background.paper',
  } as const

  return (
    <Stack spacing={1.5}>
      <Card sx={cardSx}>
        <CardContent sx={{ '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.25 }}>
            <Hicon name="clock" sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
            <Typography
              variant="overline"
              fontWeight={700}
              letterSpacing={0.08}
              sx={{ lineHeight: 1.2 }}
            >
              Agenda de hoje
            </Typography>
          </Stack>
          {loading && !todayEvents.length ? (
            <Typography variant="body2" color="text.secondary">
              A carregar…
            </Typography>
          ) : todayEvents.length ? (
            <Stack spacing={1}>
              {todayEvents.map(({ ev, start }) => (
                <Stack key={ev.id} direction="row" spacing={1.25} alignItems="flex-start">
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ width: 44, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmtHm(start)}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {ev.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {ev.kind || (ev.source === 'google_calendar' ? 'Google' : 'Compromisso')}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      mt: 0.7,
                      flexShrink: 0,
                    }}
                  />
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Sem compromissos hoje.
            </Typography>
          )}
          <Box sx={{ textAlign: 'center', mt: 1.5 }}>
            <Link
              component={RouterLink}
              to="/agenda"
              underline="hover"
              fontWeight={600}
              sx={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              Ver agenda completa
              <Hicon name="chevron-right" sx={{ fontSize: '0.9rem' }} />
            </Link>
          </Box>
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent sx={{ '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.25 }}>
            <Hicon name="group" sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
            <Typography
              variant="overline"
              fontWeight={700}
              letterSpacing={0.08}
              sx={{ lineHeight: 1.2 }}
            >
              Próximos encontros
            </Typography>
          </Stack>
          {upcoming.length ? (
            <Stack spacing={1}>
              {upcoming.map(({ ev, start }) => (
                <Stack key={ev.id} direction="row" spacing={1} alignItems="flex-start">
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{ width: 42, flexShrink: 0, pt: 0.2 }}
                  >
                    {format(start, 'd/MMM', { locale: ptBR })}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {ev.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {ev.kind || 'Encontro'}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmtHm(start)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nada nos próximos dias.
            </Typography>
          )}
          <Box sx={{ textAlign: 'center', mt: 1.5 }}>
            <Link
              component={RouterLink}
              to="/agenda"
              underline="hover"
              fontWeight={600}
              sx={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              Ver todos os encontros
              <Hicon name="chevron-right" sx={{ fontSize: '0.9rem' }} />
            </Link>
          </Box>
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent sx={{ '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.25 }}>
            <Hicon name="document" sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
            <Typography
              variant="overline"
              fontWeight={700}
              letterSpacing={0.08}
              sx={{ lineHeight: 1.2 }}
            >
              Minhas tarefas
            </Typography>
          </Stack>
          {openTasks.length ? (
            <Stack spacing={0.75}>
              {openTasks.map((t) => {
                const p = PRIORITY_CHIP[t.priority || 'medium'] || PRIORITY_CHIP.medium
                return (
                  <Stack key={t.id} direction="row" spacing={0.5} alignItems="flex-start">
                    <Checkbox
                      size="small"
                      sx={{ pt: 0.15, color: alpha(theme.palette.text.secondary, 0.5) }}
                      onChange={() => void completeTask(t.id)}
                      inputProps={{ 'aria-label': `Concluir ${t.title}` }}
                    />
                    <Typography variant="body2" sx={{ flex: 1, pt: 0.5, minWidth: 0 }} noWrap>
                      {t.title}
                    </Typography>
                    <Chip size="small" label={p.label} color={p.color} variant="outlined" />
                  </Stack>
                )
              })}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Sem tarefas abertas.
            </Typography>
          )}
          <Box sx={{ textAlign: 'center', mt: 1.5 }}>
            <Link
              component={RouterLink}
              to="/agenda"
              underline="hover"
              fontWeight={600}
              sx={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              Ver todas as tarefas
              <Hicon name="chevron-right" sx={{ fontSize: '0.9rem' }} />
            </Link>
          </Box>
        </CardContent>
      </Card>

      <Button
        component={RouterLink}
        to="/agenda"
        variant="outlined"
        size="small"
        fullWidth
        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
      >
        Abrir Agenda no Business
      </Button>
    </Stack>
  )
}
