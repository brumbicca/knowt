import { useCallback, useEffect, useState } from 'react'
import { Box, Chip, CircularProgress, Stack, Tooltip, Typography } from '@mui/material'
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
  if (!raw) return '—'
  try {
    return new Date(raw).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  } catch {
    return raw
  }
}

function healthColor(
  health: string | undefined,
): 'success' | 'warning' | 'error' | 'default' | 'info' {
  if (health === 'ok') return 'success'
  if (health === 'warning') return 'warning'
  if (health === 'error' || health === 'suspended') return 'error'
  return 'default'
}

function freshnessLabel(st: SourceStatusPayload | null): string {
  const f = st?.freshness
  if (!f) return 'Freshness —'
  if (f.state === 'suspended') return 'Suspensa'
  if (f.state === 'fresh') return `Fresh · ${fmtAge(f.age_minutes)}`
  if (f.state === 'stale') return `Stale · ${fmtAge(f.age_minutes)}`
  if (f.state === 'critical') return `Crítico · ${fmtAge(f.age_minutes)}`
  return 'Freshness desconhecido'
}

/** Faixa compacta: fonte · freshness · cobertura · drift (Fase 8). */
export function SourceProvenanceStrip() {
  const { activeSourceId, activeSource } = useBiSource()
  const [status, setStatus] = useState<SourceStatusPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetchSourceStatus(activeSourceId)
      .then((res) => setStatus(res?.ok === false ? null : res))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [activeSourceId])

  useEffect(() => {
    load()
    const t = window.setInterval(load, 60_000)
    return () => window.clearInterval(t)
  }, [load])

  const name = status?.source?.name || activeSource?.name || activeSourceId
  const drift = status?.drift?.last
  const caps = status?.coverage?.capabilities_count ?? 0
  const pedidos = status?.coverage?.pedidos_count ?? status?.freshness?.pedidos_count ?? 0
  const quality = status?.coverage?.quality_suggestion

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1400,
        mx: 'auto',
        px: { xs: 1.5, sm: 2 },
        pb: 0.75,
        boxSizing: 'border-box',
      }}
    >
      <Stack
        direction="row"
        spacing={0.75}
        useFlexGap
        flexWrap="wrap"
        alignItems="center"
        sx={{
          px: { xs: 1.25, sm: 1.5 },
          py: 0.85,
          borderRadius: '8px',
          border: '1px solid',
          borderColor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15, 118, 110, 0.14)',
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(15, 118, 110, 0.03)',
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={700}
          letterSpacing={0.04}
          sx={{ mr: 0.25 }}
        >
          PROVENIÊNCIA
        </Typography>
        {loading && !status ? <CircularProgress size={12} /> : null}

        <Chip
          size="small"
          color={healthColor(status?.health)}
          variant={status?.health === 'ok' ? 'filled' : 'outlined'}
          label={`Fonte · ${name}`}
          sx={{ fontWeight: 700 }}
        />

        <Tooltip
          title={
            status?.freshness?.at
              ? `Último pedido (${status.freshness.field || 'data'}): ${fmtAt(status.freshness.at)} · SLA ${status.freshness.sla_minutes} min`
              : 'Sem data de pedido no espelho'
          }
        >
          <Chip size="small" variant="outlined" label={freshnessLabel(status)} />
        </Tooltip>

        <Tooltip
          title={
            quality
              ? `Qualidade semântica: ${quality}${status?.semantics?.recon_ok === false ? ' · reconciliação fora da tolerância' : ''}`
              : `${pedidos.toLocaleString('pt-BR')} pedidos · ${caps} capabilities`
          }
        >
          <Chip
            size="small"
            variant="outlined"
            label={`Cobertura · ${pedidos.toLocaleString('pt-BR')} ped. · ${caps} cap.`}
          />
        </Tooltip>

        <Tooltip
          title={
            drift
              ? `Último drift: ${drift.severity || 'info'} · ${(drift.codes || []).join(', ') || 'sem códigos'} · ${fmtAt(drift.at)}`
              : 'Sem alertas de drift registados'
          }
        >
          <Chip
            size="small"
            color={
              drift?.severity === 'error' || drift?.severity === 'critical'
                ? 'error'
                : drift?.severity === 'warning'
                  ? 'warning'
                  : 'default'
            }
            variant="outlined"
            label={
              drift
                ? `Drift · ${drift.severity || 'info'}${drift.alert_count ? ` (${drift.alert_count})` : ''}`
                : 'Drift · ok'
            }
          />
        </Tooltip>

        {status?.provenance?.contract_hint ? (
          <Chip size="small" variant="outlined" label={status.provenance.contract_hint} />
        ) : null}

        {status?.identity?.names?.org || status?.identity?.org_id ? (
          <Chip
            size="small"
            variant="outlined"
            label={`Org · ${status.identity.names?.org || status.identity.org_id}`}
          />
        ) : null}

        {status?.authorization?.status ? (
          <Chip
            size="small"
            color={status.authorization.status === 'approved' ? 'success' : 'warning'}
            variant="outlined"
            label={`Authz · ${status.authorization.status}`}
          />
        ) : null}

        {status?.kill_switch?.suspended ? (
          <Chip
            size="small"
            color="error"
            label={`Kill switch · ${status.kill_switch.reason || 'activo'}`}
          />
        ) : null}

        {status?.shadow ? <Chip size="small" color="info" variant="outlined" label="Shadow" /> : null}
      </Stack>
    </Box>
  )
}
