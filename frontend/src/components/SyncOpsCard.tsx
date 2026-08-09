import { useCallback, useEffect, useState } from 'react'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { bridgeGet, type LojasPayload, type SyncStatusPayload } from '../api/bridge'

type OpsState = {
  running: boolean
  progress: number
  message: string
  lastSync: string | null
  lastSyncSource: string | null
  lastAuto: string | null
  lastAutoCanal: string | null
  errors: number
  platforms: number
  stores: number
  storeLabels: string[]
  extraLabels: number
}

function fmtLastSync(raw: string | null): string {
  if (!raw) return 'sem registo'
  try {
    return new Date(raw).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  } catch {
    return raw
  }
}

function countStores(platforms: NonNullable<LojasPayload['s2_platform_stores']>): {
  stores: number
  storeLabels: string[]
  extraLabels: number
} {
  const priority = ['tray', 'shopee', 'mercadolibre', 'mercadolivre', 'shein', 'amazon', 'tiktok']
  const scored = platforms.flatMap((p) => {
    const key = String(p.key || '').toLowerCase()
    const pri = priority.findIndex((x) => key.includes(x))
    const score = pri >= 0 ? pri : 50
    return (p.stores || []).map((s) => ({
      label: s.label || s.name || p.label || p.key || 'loja',
      score,
    }))
  })
  scored.sort((a, b) => a.score - b.score)
  const all = scored.map((s) => s.label)
  const limit = 10
  return {
    stores: all.length,
    storeLabels: all.slice(0, limit),
    extraLabels: Math.max(0, all.length - limit),
  }
}

/** Saúde ops — sync S1 + lojas configuradas (S2). Degrada se um dos lados falhar. */
export function SyncOpsCard() {
  const [ops, setOps] = useState<OpsState | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    Promise.allSettled([
      bridgeGet<SyncStatusPayload>('/sync/status'),
      bridgeGet<LojasPayload>('/lojas'),
    ])
      .then(([syncSettled, lojasSettled]) => {
        const syncRes = syncSettled.status === 'fulfilled' ? syncSettled.value : null
        const lojasRes = lojasSettled.status === 'fulfilled' ? lojasSettled.value : null
        const sync = syncRes?.sync || {}
        const platforms = lojasRes?.s2_platform_stores || []
        const { stores, storeLabels, extraLabels } = countStores(platforms)

        if (!syncRes && !lojasRes) {
          setOps(null)
          setNote('Sync / lojas indisponíveis no momento.')
          return
        }

        setOps({
          running: Boolean(sync.running),
          progress: Number(sync.progress || 0),
          message: String(sync.message || ''),
          lastSync: sync.last_sync ? String(sync.last_sync) : null,
          lastSyncSource: sync.last_sync_source ? String(sync.last_sync_source) : null,
          lastAuto: sync.last_activity_at ? String(sync.last_activity_at) : null,
          lastAutoCanal: sync.last_activity_marketplace
            ? String(sync.last_activity_marketplace)
            : null,
          errors: Array.isArray(sync.errors) ? sync.errors.length : 0,
          platforms: platforms.length,
          stores,
          storeLabels,
          extraLabels,
        })

        const notes: string[] = []
        if (syncSettled.status === 'rejected') notes.push('Status de sync indisponível.')
        if (lojasSettled.status === 'rejected') notes.push('Lista de lojas indisponível.')
        if (lojasRes?.s1_error) notes.push(String(lojasRes.s1_error))
        else if (lojasRes?.s1_note) notes.push(String(lojasRes.s1_note))
        if (lojasRes?.s2_error) notes.push(String(lojasRes.s2_error))
        setNote(notes.length ? notes.join(' ') : null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => load(true), 30_000)
    return () => window.clearInterval(timer)
  }, [load])

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="h6">Sync & lojas</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip
            size="small"
            label={ops?.running ? 'A sincronizar' : 'Idle'}
            color={ops?.running ? 'warning' : 'success'}
            variant="outlined"
          />
          <Button size="small" onClick={() => load()} sx={{ minWidth: 0, px: 1 }} disabled={loading}>
            Atualizar
          </Button>
        </Stack>
      </Stack>

      {loading && !ops ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          A carregar…
        </Typography>
      ) : ops ? (
        <Stack spacing={1.25} sx={{ mt: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Lojas configuradas
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {ops.stores} · {ops.platforms} canais
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Última sync automática
            </Typography>
            <Typography variant="body2" sx={{ textAlign: 'right' }}>
              {fmtLastSync(ops.lastAuto)}
              {ops.lastAutoCanal ? ` · ${ops.lastAutoCanal}` : ''}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Última sync manual
            </Typography>
            <Typography variant="body2" sx={{ textAlign: 'right' }}>
              {fmtLastSync(ops.lastSync)}
              {ops.lastSyncSource === 'sync_activity' ? ' · actividade' : ''}
            </Typography>
          </Stack>
          {ops.running ? (
            <Typography variant="caption" color="warning.main">
              Progresso {ops.progress}%
              {ops.message ? ` · ${ops.message}` : ''}
            </Typography>
          ) : null}
          {ops.errors > 0 ? (
            <Typography variant="caption" color="error.main">
              {ops.errors} erro(s) na última sessão de sync
            </Typography>
          ) : null}
          <Stack spacing={0.35}>
            {ops.storeLabels.map((label, idx) => (
              <Typography key={`${idx}-${label}`} variant="caption" color="text.secondary">
                · {label}
              </Typography>
            ))}
            {ops.extraLabels > 0 ? (
              <Typography variant="caption" color="text.secondary">
                · +{ops.extraLabels} loja(s)
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Sem dados de sync/lojas.
        </Typography>
      )}
      {note ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
          {note}
        </Typography>
      ) : null}
    </Box>
  )
}
