import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material'

const RELATED: Record<string, Array<{ to: string; label: string }>> = {
  Vendas: [
    { to: '/insights/comercial', label: 'Pedidos' },
    { to: '/produtos', label: 'Produtos' },
  ],
  Pedidos: [
    { to: '/insights/financeiro', label: 'Fiscal' },
    { to: '/insights/financeiro', label: 'Margens' },
  ],
  'Margens & CMV': [
    { to: '/insights/financeiro', label: 'Fiscal' },
    { to: '/insights/comercial', label: 'Pedidos' },
  ],
  'Fiscal (NF)': [
    { to: '/insights/financeiro', label: 'Margens' },
    { to: '/insights/comercial', label: 'Pedidos' },
  ],
  Fretes: [{ to: '/insights/comercial', label: 'Pedidos' }],
  Despesas: [],
  Clientes: [{ to: '/insights/comercial', label: 'Pedidos' }],
  Pagamentos: [{ to: '/insights/comercial', label: 'Pedidos' }],
  Produtos: [{ to: '/insights/comercial', label: 'Pedidos' }],
  Operações: [{ to: '/insights/financeiro', label: 'Fiscal' }],
  'Agenda & Tarefas': [{ to: '/insights', label: 'Insights' }],
  Insights: [
    { to: '/insights/alertas', label: 'Alertas' },
    { to: '/insights/prioridades', label: 'Prioridades' },
  ],
  Alertas: [
    { to: '/insights', label: 'Insights' },
    { to: '/insights/prioridades', label: 'Prioridades' },
  ],
  Prioridades: [
    { to: '/insights/alertas', label: 'Alertas' },
    { to: '/insights/comercial', label: 'Comercial' },
  ],
  Comercial: [
    { to: '/insights/produtos', label: 'Mix & SKUs' },
    { to: '/insights/financeiro', label: 'Financeiro' },
  ],
  'Mix & SKUs': [
    { to: '/insights/comercial', label: 'Comercial' },
    { to: '/insights/logistica', label: 'Logística' },
  ],
  Logística: [
    { to: '/insights/produtos', label: 'Mix & SKUs' },
    { to: '/insights/financeiro', label: 'Financeiro' },
  ],
  Financeiro: [
    { to: '/insights/comercial', label: 'Comercial' },
    { to: '/insights', label: 'Insights' },
  ],
}

export function DomainPageShell({
  title,
  subtitle,
  loading,
  error,
  onRetry,
  children,
  stats,
}: {
  title: string
  subtitle?: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  children: ReactNode
  stats?: Array<{ label: string; value: string; hint?: string }>
}) {
  const related = RELATED[title] || [{ to: '/insights', label: 'Insights' }]

  return (
    <Stack spacing={2.5}>
      <Box>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
          <Chip
            component={RouterLink}
            to="/insights"
            clickable
            size="small"
            label="Home"
            variant="outlined"
            sx={{ textDecoration: 'none' }}
          />
          {related.map((r) => (
            <Chip
              key={r.to + r.label}
              component={RouterLink}
              to={r.to}
              clickable
              size="small"
              label={r.label}
              variant="outlined"
              sx={{ textDecoration: 'none' }}
            />
          ))}
        </Stack>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.35rem', sm: '2rem' }, mb: 0.35 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography color="text.secondary" sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>

      {error ? (
        <Alert
          severity="error"
          action={
            onRetry ? (
              <Typography
                component="button"
                onClick={onRetry}
                sx={{
                  border: 0,
                  bgcolor: 'transparent',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontWeight: 700,
                }}
              >
                Tentar de novo
              </Typography>
            ) : null
          }
        >
          {error}
        </Alert>
      ) : null}

      {stats && stats.length > 0 ? (
        <Grid container spacing={1.5}>
          {stats.map((s) => (
            <Grid key={s.label} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    {s.label}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      fontVariantNumeric: 'tabular-nums',
                      fontFamily: '"Outfit", sans-serif',
                      mt: 0.5,
                    }}
                  >
                    {loading ? '…' : s.value}
                  </Typography>
                  {s.hint ? (
                    <Typography variant="caption" color="text.secondary">
                      {s.hint}
                    </Typography>
                  ) : null}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : null}

      {loading && !children ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        children
      )}
    </Stack>
  )
}
