import { Button, Stack, Typography } from '@mui/material'
import { useBiData } from '../state/BiDataContext'

/**
 * Empty state for chart/table panels — clear copy + optional period CTA.
 * Global period banner lives in BiLayout; this covers per-panel gaps.
 */
export function ChartEmpty({
  title,
  hint,
  suggestPeriod = true,
  dense = false,
}: {
  title: string
  /** Extra context; default hint appears when suggestPeriod is on. */
  hint?: string
  /** Show «Últimos 7 dias» when current filter is narrow (hoje / esta semana / mês). */
  suggestPeriod?: boolean
  dense?: boolean
}) {
  const { periodo, setPeriodo, customRange } = useBiData()
  const showCta =
    suggestPeriod && !customRange && (periodo === 'hoje' || periodo === 'semana' || periodo === 'mes')
  const resolvedHint =
    hint ??
    (showCta
      ? 'Pode ser o filtro de período — experimenta Últimos 7 dias.'
      : suggestPeriod
        ? 'Alarga o período ou limpa o canal no topo se estiver filtrado.'
        : undefined)

  return (
    <Stack
      spacing={1}
      alignItems="center"
      justifyContent="center"
      sx={{
        pt: dense ? 4 : 8,
        px: 2,
        textAlign: 'center',
        minHeight: dense ? 120 : undefined,
      }}
    >
      <Typography color="text.secondary" sx={{ fontWeight: 600, maxWidth: 360 }}>
        {title}
      </Typography>
      {resolvedHint ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, opacity: 0.9 }}>
          {resolvedHint}
        </Typography>
      ) : null}
      {showCta ? (
        <Button
          size="small"
          variant="outlined"
          onClick={() => setPeriodo('7d')}
          sx={{ textTransform: 'none', fontWeight: 700, mt: 0.5 }}
        >
          Últimos 7 dias
        </Button>
      ) : null}
    </Stack>
  )
}
