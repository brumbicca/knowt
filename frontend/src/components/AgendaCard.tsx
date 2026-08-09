import { useCallback, useEffect, useState } from 'react'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { bridgeGet } from '../api/bridge'
import { BI_AGENDA_REFRESH } from '../utils/biRefresh'

export type AgendaEvent = {
  id: string
  title: string
  start: string
  end?: string
  kind?: string
  source?: string
}

type AgendaResponse = {
  events?: AgendaEvent[]
  count?: number
  google?: {
    google_connected?: boolean
    credentials_configured?: boolean
    auth_available?: boolean
    mode?: string
    message?: string
  }
  periodo?: { inicio: string; fim: string; label: string }
}

type AuthUrlResponse = {
  ok?: boolean
  auth_url?: string
  error?: string
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** Card Agenda — store Fiesta local + Google Calendar OAuth. */
export function AgendaCard() {
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState<string | null>(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [authAvailable, setAuthAvailable] = useState(false)
  const [linking, setLinking] = useState(false)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    bridgeGet<AgendaResponse>('/agenda/periodo', { periodo: 'proximos' })
      .then((data) => {
        setEvents(data.events || [])
        setNote(data.google?.message || null)
        setGoogleConnected(Boolean(data.google?.google_connected))
        setAuthAvailable(Boolean(data.google?.auth_available || data.google?.credentials_configured))
      })
      .catch(() => {
        setEvents([])
        setNote('Agenda indisponível no momento.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onRefresh = () => load(true)
    window.addEventListener(BI_AGENDA_REFRESH, onRefresh)
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    // Telegram/Google não notificam o BI — poll curto enquanto o dashboard está aberto
    const timer = window.setInterval(() => load(true), 20_000)
    return () => {
      window.removeEventListener(BI_AGENDA_REFRESH, onRefresh)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [load])

  async function linkGoogle() {
    setLinking(true)
    try {
      const data = await bridgeGet<AuthUrlResponse>('/agenda/google/auth-url')
      if (data.auth_url) {
        window.open(data.auth_url, '_blank', 'noopener,noreferrer')
      } else {
        setNote(data.error || 'Não foi possível iniciar o OAuth Google.')
      }
    } catch {
      setNote('Credenciais Google ainda não configuradas no servidor.')
    } finally {
      setLinking(false)
    }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="h6">Agenda</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip
            size="small"
            label={googleConnected ? 'Google · 7 dias' : '7 dias'}
            color={googleConnected ? 'success' : 'default'}
            variant="outlined"
          />
          <Button size="small" onClick={() => load()} sx={{ minWidth: 0, px: 1 }} disabled={loading}>
            Atualizar
          </Button>
        </Stack>
      </Stack>
      {loading ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          A carregar…
        </Typography>
      ) : events.length ? (
        <Stack spacing={1} sx={{ mt: 1.5, maxHeight: 360, overflowY: 'auto', pr: 0.5 }}>
          {events.map((ev) => (
            <Box
              key={ev.id}
              sx={{
                p: 1.25,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {ev.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {fmtTime(ev.start)}
                {ev.source === 'google_calendar' ? ' · Google' : ''}
              </Typography>
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Sem compromissos nos próximos dias. Pergunta à Rica IA: «o que tenho na agenda?»
        </Typography>
      )}
      {!googleConnected && authAvailable ? (
        <Button size="small" variant="outlined" sx={{ mt: 1.5 }} onClick={() => void linkGoogle()} disabled={linking}>
          Ligar Google Calendar
        </Button>
      ) : null}
      {note ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
          {note}
        </Typography>
      ) : null}
    </Box>
  )
}
