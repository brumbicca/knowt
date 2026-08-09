import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material'
import { format } from 'date-fns'
import { fetchOpsAlerts, type OpsAlert, type OpsAlertsPayload } from '../api/bridge'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import { parseIsoSP } from '../utils/spTime'

function fmtDateTimeBr(iso?: string): string {
  const d = iso ? parseIsoSP(iso) : null
  return d ? format(d, 'dd/MM HH:mm') : '—'
}

function severityColor(sev: OpsAlert['severity']): 'error' | 'warning' | 'info' {
  if (sev === 'error') return 'error'
  if (sev === 'warning') return 'warning'
  return 'info'
}

/** Alertas operacionais — sync, margem CMV/NF, UpSeller, etc. */
export function OpsAlertsCard() {
  const { periodQuery, marketplace, marketplaceOptions } = useBiData()
  const { isFiestaActive } = useBiSource()
  const [payload, setPayload] = useState<OpsAlertsPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const canalLabel =
    marketplaceOptions.find((o) => o.id === marketplace)?.label || 'Todos os canais'

  const load = useCallback(
    (silent = false) => {
      if (!isFiestaActive) {
        setPayload(null)
        setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      fetchOpsAlerts(periodQuery, marketplace || undefined)
        .then(setPayload)
        .catch(() => setPayload(null))
        .finally(() => setLoading(false))
    },
    [periodQuery, marketplace, isFiestaActive],
  )

  useEffect(() => {
    load()
    if (!isFiestaActive) return
    const timer = window.setInterval(() => load(true), 60_000)
    return () => window.clearInterval(timer)
  }, [load, isFiestaActive])

  const alerts = payload?.alerts || []
  const coverage = payload?.margin_coverage
  const gap = payload?.margin_gap
  const top = alerts.filter((a) => a.severity !== 'info').slice(0, 5)

  if (!isFiestaActive) return null

  if (!loading && top.length === 0 && !coverage?.sem_margem) {
    return null
  }

  const semNfParts = gap?.sem_nf_por_canal
    ? Object.entries(gap.sem_nf_por_canal)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
    : ''

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="h6">Alertas operacionais</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Chip size="small" label={canalLabel} variant="outlined" />
          <Button size="small" onClick={() => load()} sx={{ minWidth: 0, px: 1 }} disabled={loading}>
            Atualizar
          </Button>
        </Stack>
      </Stack>

      {loading && !payload ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          A verificar sync e margens…
        </Typography>
      ) : (
        <Stack spacing={1} sx={{ mt: 1.25 }}>
          {coverage && coverage.pedidos > 0 ? (
            <Typography variant="caption" color="text.secondary">
              Margem CMV/NF: {coverage.margens_registros}/{coverage.pedidos} pedidos
              {coverage.cobertura_pct != null ? ` (${coverage.cobertura_pct}%)` : ''}
              {coverage.margens_registros > 0 ? ` · CMV ${coverage.cmv_total_fmt}` : ''}
              {coverage.cobertura_pct != null && coverage.cobertura_pct < 100
                ? ' · amostra (não é P&L completo do período)'
                : ''}{' '}
              ·{' '}
              <Typography
                component={RouterLink}
                to="/insights/financeiro"
                variant="caption"
                sx={{ color: 'primary.main', fontWeight: 700, textDecoration: 'none' }}
              >
                Fiscal
              </Typography>
              {' · '}
              <Typography
                component={RouterLink}
                to="/insights/financeiro"
                variant="caption"
                sx={{ color: 'primary.main', fontWeight: 700, textDecoration: 'none' }}
              >
                Margens
              </Typography>
            </Typography>
          ) : null}
          {gap && (gap.sem_nf || gap.nf_sem_margem) ? (
            <Typography variant="caption" color="text.secondary">
              Causa: {gap.sem_nf ? `${gap.sem_nf} sem NF` : ''}
              {gap.sem_nf && gap.nf_sem_margem ? ' · ' : ''}
              {gap.nf_sem_margem ? `${gap.nf_sem_margem} NF sem margem` : ''}
              {semNfParts ? ` (${semNfParts})` : ''}
              {gap.upseller_stalled ? ' · UpSeller parado' : ''}{' '}
              ·{' '}
              <Typography
                component={RouterLink}
                to="/insights/financeiro"
                variant="caption"
                sx={{ color: 'primary.main', fontWeight: 700, textDecoration: 'none' }}
              >
                Ver Fiscal
              </Typography>
            </Typography>
          ) : null}
          {top.map((alert) => (
            <Alert
              key={`${alert.code}-${alert.at || alert.title}`}
              severity={severityColor(alert.severity)}
              action={
                alert.code?.includes('nf') ||
                alert.code?.includes('margin') ||
                alert.title?.toLowerCase().includes('nf') ? (
                  <Button component={RouterLink} to="/insights/financeiro" color="inherit" size="small">
                    Fiscal
                  </Button>
                ) : undefined
              }
            >
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2" fontWeight={700}>
                  {alert.title}
                </Typography>
                {Number(alert.ocorrencias || 1) > 1 ? (
                  <Chip size="small" variant="outlined" label={`${alert.ocorrencias}×`} />
                ) : null}
              </Stack>
              <Typography variant="body2">{alert.detail}</Typography>
              {alert.at ? (
                <Typography variant="caption" color="text.secondary">
                  {Number(alert.ocorrencias || 1) > 1
                    ? `${alert.ocorrencias} ocorrências · última ${fmtDateTimeBr(alert.at)} · primeira ${fmtDateTimeBr(alert.desde)}`
                    : `Ocorreu em ${fmtDateTimeBr(alert.at)}`}
                </Typography>
              ) : null}
            </Alert>
          ))}
        </Stack>
      )}
    </Box>
  )
}
