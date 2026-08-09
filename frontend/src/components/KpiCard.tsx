import { Link as RouterLink } from 'react-router-dom'
import {
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import { Sparkline } from './Sparkline'

export type KpiCardProps = {
  label: string
  value: string
  hint?: string
  badge?: string | null
  /** caveat = número incompleto / amostra (não ler como P&L do período) */
  valueTone?: 'default' | 'caveat'
  deltaPct?: number | null
  /** Série mini (ex. daily) — só visual */
  sparkline?: number[]
  selected?: boolean
  loading?: boolean
  onClick?: () => void
  /** Navega para rota (Command Center → domínio) */
  to?: string
}

function deltaLabel(deltaPct: number | null | undefined): string | null {
  if (deltaPct == null || Number.isNaN(deltaPct)) return null
  const sign = deltaPct > 0 ? '+' : ''
  return `${sign}${deltaPct.toFixed(1)}% vs ant.`
}

export function KpiCard({
  label,
  value,
  hint,
  badge,
  valueTone = 'default',
  deltaPct,
  sparkline,
  selected,
  loading,
  onClick,
  to,
}: KpiCardProps) {
  const theme = useTheme()
  const primary = theme.palette.primary.main
  const delta = deltaLabel(deltaPct)
  const positive = (deltaPct ?? 0) > 0
  const negative = (deltaPct ?? 0) < 0
  const caveat = valueTone === 'caveat'
  const interactive = Boolean(onClick || to)

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        outline: selected ? '2px solid' : '1px solid',
        outlineColor: selected ? 'primary.main' : 'transparent',
        bgcolor: selected ? alpha(primary, 0.04) : 'background.paper',
        opacity: loading ? 0.72 : 1,
        transition: 'outline-color 160ms ease, background-color 160ms ease, transform 160ms ease',
        '&:hover': interactive
          ? {
              transform: 'translateY(-1px)',
              outlineColor: selected ? 'primary.main' : alpha(primary, 0.35),
            }
          : undefined,
        '&::before': selected
          ? {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              bgcolor: 'primary.main',
            }
          : undefined,
      }}
    >
      <CardActionArea
        {...(to
          ? { component: RouterLink, to }
          : { onClick, disabled: !interactive })}
        sx={{ height: '100%' }}
      >
        <CardContent sx={{ pl: selected ? 2.25 : 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {label}
          </Typography>
          <Typography
            variant="h4"
            sx={{
              mb: 0.75,
              fontVariantNumeric: 'tabular-nums',
              fontFamily: '"Outfit", "IBM Plex Sans", sans-serif',
              fontSize: { xs: '1.4rem', sm: '1.85rem', md: '2rem' },
              lineHeight: 1.15,
              wordBreak: 'break-word',
              color: caveat ? 'warning.main' : 'text.primary',
            }}
          >
            {loading ? '…' : value}
          </Typography>
          {(badge || delta) && (
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mb: 0.5 }}>
              {badge ? (
                <Chip size="small" label={badge} color="warning" variant="outlined" sx={{ maxWidth: '100%' }} />
              ) : null}
              {delta ? (
                <Chip
                  size="small"
                  label={delta}
                  color={positive ? 'success' : negative ? 'warning' : 'default'}
                  variant="outlined"
                  sx={{ maxWidth: '100%' }}
                />
              ) : null}
            </Stack>
          )}
          {hint ? (
            <Typography variant="caption" color="text.secondary" display="block">
              {hint}
            </Typography>
          ) : null}
          {sparkline && sparkline.length >= 2 && !loading ? (
            <Sparkline values={sparkline} color={selected ? primary : undefined} />
          ) : null}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
