import { useCallback, useEffect, useState } from 'react'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { fetchSourceStatus, type SourceStatusPayload } from '../api/bridge'
import { useBiSource } from '../state/BiSourceContext'

function fmtAge(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  if (h < 48) return `${h} h`
  return `${Math.floor(h / 24)} d`
}

function fmtAt(raw: string | null | undefined): string {
  if (!raw) return 'sem registo'
  try {
    return new Date(raw).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  } catch {
    return raw
  }
}

function healthChip(
  health: string | undefined,
): { label: string; color: 'success' | 'warning' | 'error' | 'default' } {
  if (health === 'ok') return { label: 'Saudável', color: 'success' }
  if (health === 'warning') return { label: 'Atenção', color: 'warning' }
  if (health === 'error') return { label: 'Erro', color: 'error' }
  if (health === 'suspended') return { label: 'Suspensa', color: 'error' }
  return { label: '—', color: 'default' }
}

/** Card dashboard — saúde / freshness / drift da fonte activa (Fase 8). */
export function SourceHealthCard() {
  const { activeSourceId, activeSource, isFiestaActive } = useBiSource()
  const [status, setStatus] = useState<SourceStatusPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true)
      fetchSourceStatus(activeSourceId)
        .then((res) => {
          if (!res?.ok) {
            setStatus(null)
            setNote(res?.error || 'Status indisponível')
            return
          }
          setStatus(res)
          setNote(null)
        })
        .catch((e: unknown) => {
          setStatus(null)
          setNote(e instanceof Error ? e.message : 'Falha ao carregar status')
        })
        .finally(() => setLoading(false))
    },
    [activeSourceId],
  )

  useEffect(() => {
    load()
  }, [load])

  const chip = healthChip(status?.health)
  const name = status?.source?.name || activeSource?.name || activeSourceId
  const fresh = status?.freshness
  const drift = status?.drift?.last
  const caps = status?.coverage?.capabilities || []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="h6">Saúde da fonte</Typography>
        <Chip size="small" label="Proveniência" variant="outlined" />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        {isFiestaActive
          ? 'Freshness e cobertura da fonte Fiesta — mesma verdade que a Rica IA.'
          : `Espelho «${name}» — origem explícita, sem misturar com Fiesta.`}
      </Typography>

      {note && !status ? (
        <Typography variant="body2" color="text.secondary">
          {note}
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <Chip size="small" color={chip.color} label={chip.label} sx={{ fontWeight: 700 }} />
            <Chip
              size="small"
              variant="outlined"
              label={status?.source?.status || activeSource?.status || 'active'}
            />
            {status?.source?.is_mirror ? (
              <Chip size="small" variant="outlined" label="Espelho bi_*" color="info" />
            ) : null}
          </Stack>

          <Box
            sx={{
              p: 1.5,
              borderRadius: '10px',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              IDENTIDADE · AUTORIZAÇÃO (§14.2)
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.35 }}>
              {status?.identity?.names?.org || status?.identity?.org_id || '—'}
              {' · '}
              {status?.identity?.names?.unit || status?.identity?.unit_id || '—'}
              {' · '}
              {status?.identity?.names?.origin_product ||
                status?.identity?.origin_product_id ||
                '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Authz:{' '}
              {status?.authorization?.status ||
                (status?.authorization?.missing ? 'missing' : '—')}
              {status?.authorization?.scope_mode
                ? ` · ${status.authorization.scope_mode}`
                : ''}
              {status?.shadow ? ' · shadow' : ''}
              {status?.kill_switch?.suspended
                ? ` · kill switch: ${status.kill_switch.reason || 'activo'}`
                : ''}
            </Typography>
            {(status?.connections || []).length ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Conexões:{' '}
                {(status?.connections || [])
                  .map((c) => c.label || c.id)
                  .filter(Boolean)
                  .join(', ')}
              </Typography>
            ) : null}
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: '10px',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'rgba(15, 23, 42, 0.02)',
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              FRESHNESS
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.35 }}>
              {fresh?.at
                ? `Último pedido há ${fmtAge(fresh.age_minutes)} (${fresh.field || 'data'})`
                : loading
                  ? 'A carregar…'
                  : 'Sem data de pedido'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {fresh?.at ? fmtAt(fresh.at) : '—'} · SLA {fresh?.sla_minutes ?? 1440} min
            </Typography>
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: '10px',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              COBERTURA
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.35 }}>
              {(status?.coverage?.pedidos_count ?? 0).toLocaleString('pt-BR')} pedidos ·{' '}
              {caps.length} capabilities
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {status?.coverage?.quality_suggestion
                ? `Qualidade: ${status.coverage.quality_suggestion}`
                : 'Sem run semântico ainda'}
              {status?.semantics?.recon_ok === false ? ' · reconciliação fora' : ''}
            </Typography>
            {caps.length ? (
              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                {caps.slice(0, 8).map((c) => (
                  <Chip key={c} size="small" label={c} variant="outlined" />
                ))}
              </Stack>
            ) : null}
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: '10px',
              border: '1px solid',
              borderColor:
                drift?.severity === 'error' || drift?.severity === 'critical'
                  ? 'error.light'
                  : 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              DRIFT
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.35 }}>
              {drift
                ? `${drift.severity || 'info'} · ${drift.alert_count || 0} alerta(s)`
                : 'Sem alertas recentes'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {drift?.codes?.length ? drift.codes.join(', ') : drift ? fmtAt(drift.at) : '—'}
              {drift?.suggest_kill_switch ? ' · sugere kill switch (espelho)' : ''}
            </Typography>
          </Box>

          <Button size="small" variant="text" onClick={() => load()} disabled={loading} sx={{ alignSelf: 'flex-start' }}>
            Actualizar status
          </Button>
        </Stack>
      )}
    </Box>
  )
}
