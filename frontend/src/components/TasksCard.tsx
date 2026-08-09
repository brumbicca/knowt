import { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { bridgeGet, bridgePost } from '../api/bridge'
import { BI_TASKS_REFRESH } from '../utils/biRefresh'

export type BiTask = {
  id: string
  title: string
  status: string
  priority?: string
  created_at?: string
  due?: string
  source?: string
}

type TasksResponse = {
  tasks?: BiTask[]
  count?: number
  google?: {
    google_tasks_connected?: boolean
    credentials_configured?: boolean
    auth_available?: boolean
    message?: string
  }
}

type AuthUrlResponse = {
  auth_url?: string
  error?: string
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'alta',
  medium: 'média',
  low: 'baixa',
}

/** Card Tarefas — store Fiesta + Google Tasks via o mesmo OAuth do Calendar. */
export function TasksCard() {
  const [tasks, setTasks] = useState<BiTask[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [authAvailable, setAuthAvailable] = useState(false)
  const [linking, setLinking] = useState(false)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    bridgeGet<TasksResponse>('/tarefas', { status: 'open' })
      .then((data) => {
        setTasks(data.tasks || [])
        setGoogleConnected(Boolean(data.google?.google_tasks_connected))
        setAuthAvailable(Boolean(data.google?.auth_available || data.google?.credentials_configured))
        setNote(data.google?.message || null)
      })
      .catch(() => {
        setTasks([])
        setNote('Tarefas indisponíveis no momento.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onRefresh = () => load(true)
    window.addEventListener(BI_TASKS_REFRESH, onRefresh)
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => load(true), 20_000)
    return () => {
      window.removeEventListener(BI_TASKS_REFRESH, onRefresh)
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [load])

  async function linkGoogleTasks() {
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

  async function addTask() {
    const title = draft.trim()
    if (!title || saving) return
    setSaving(true)
    try {
      await bridgePost<{ ok?: boolean; task?: BiTask }>('/tarefas', { title, priority: 'medium' })
      setDraft('')
      load()
    } catch {
      setNote('Não foi possível criar a tarefa.')
    } finally {
      setSaving(false)
    }
  }

  async function completeTask(id: string) {
    try {
      await bridgePost('/tarefas/concluir', { id })
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch {
      setNote('Não foi possível concluir a tarefa.')
    }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="h6">Tarefas</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip
            size="small"
            label={googleConnected ? 'Google · abertas' : 'abertas'}
            color={googleConnected ? 'success' : 'default'}
            variant="outlined"
          />
          <Button size="small" onClick={() => load()} sx={{ minWidth: 0, px: 1 }}>
            Atualizar
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Nova tarefa…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addTask()
          }}
          disabled={saving}
        />
        <Button size="small" variant="contained" onClick={() => void addTask()} disabled={saving || !draft.trim()}>
          Criar
        </Button>
      </Stack>

      {loading ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          A carregar…
        </Typography>
      ) : tasks.length ? (
        <Stack spacing={0.75} sx={{ mt: 1.5 }}>
          {tasks.map((t) => (
            <Stack
              key={t.id}
              direction="row"
              alignItems="flex-start"
              spacing={0.5}
              sx={{
                p: 1,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
              }}
            >
              <Checkbox
                size="small"
                sx={{ pt: 0.25 }}
                onChange={() => void completeTask(t.id)}
                inputProps={{ 'aria-label': `Concluir ${t.title}` }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  {t.title}
                </Typography>
                {t.source === 'google_tasks' ? (
                  <Typography variant="caption" color="text.secondary">
                    Google Tasks
                  </Typography>
                ) : null}
                {t.priority && t.priority !== 'medium' ? (
                  <Typography variant="caption" color="text.secondary">
                    Prioridade {PRIORITY_LABEL[t.priority] || t.priority}
                  </Typography>
                ) : null}
              </Box>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Sem tarefas abertas. Pede à Rica IA: «cria uma tarefa para rever a Shein».
        </Typography>
      )}
      {!googleConnected && authAvailable ? (
        <Button
          size="small"
          variant="outlined"
          sx={{ mt: 1.5 }}
          onClick={() => void linkGoogleTasks()}
          disabled={linking}
        >
          Ligar Google Tasks
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
