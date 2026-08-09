import { Card, CardContent, Stack, Typography, Divider, Chip, Box } from '@mui/material'
import { fmtBrl, type BiOverview } from '../api/bridge'

type Props = {
  data: BiOverview | null
  loading?: boolean
}

function Row({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: string
  tone?: 'muted' | 'strong' | 'warn'
  hint?: string
}) {
  const color =
    tone === 'strong' ? 'text.primary' : tone === 'warn' ? 'warning.main' : 'text.secondary'
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {hint}
          </Typography>
        ) : null}
      </Box>
      <Typography
        variant="body2"
        fontWeight={tone === 'strong' ? 700 : 600}
        color={color}
        sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
      >
        {value}
      </Typography>
    </Stack>
  )
}

/** Mini P&L do período — honesto com cobertura NF parcial. */
export function MiniPnlCard({ data, loading }: Props) {
  const partial =
    !!data && data.pedidos > 0 && data.totalMargens > 0 && data.totalMargens < data.pedidos
  const semMargem = !!data && data.pedidos > 0 && data.totalMargens === 0
  const inconsistente = !!data?.cmvInconsistente

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
          <Typography variant="h6">Resultado do período</Typography>
          {inconsistente ? (
            <Chip size="small" color="warning" variant="outlined" label="CMV inconsistente" />
          ) : partial || semMargem ? (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={
                partial
                  ? `CMV amostra ${data!.totalMargens}/${data!.pedidos}`
                  : 'Sem cobertura NF'
              }
            />
          ) : (
            <Chip size="small" color="success" variant="outlined" label="CMV completo" />
          )}
        </Stack>

        <Stack spacing={1}>
          <Row
            label="Vendas brutas"
            value={loading || !data ? '…' : data.vendasFmt}
            tone="strong"
          />
          <Row
            label="Taxas marketplace"
            value={loading || !data ? '…' : `− ${data.taxasFmt}`}
          />
          <Row
            label="Frete (líquido)"
            value={
              loading || !data
                ? '…'
                : data.frete >= 0
                  ? `− ${data.freteFmt}`
                  : `+ ${fmtBrl(Math.abs(data.frete))}`
            }
            hint="Negativo = crédito / subsidio no período"
          />
          <Row
            label="Líquido / a receber"
            value={loading || !data ? '…' : data.liquidoFmt}
            tone="strong"
          />
          <Divider sx={{ my: 0.5 }} />
          <Row
            label="CMV (amostra NF)"
            value={loading || !data ? '…' : inconsistente ? 'Rever cadastro' : data.cmvFmt}
            tone={partial || semMargem || inconsistente ? 'warn' : 'muted'}
            hint={
              inconsistente
                ? 'Custos unitários fora de escala face às vendas'
                : data?.coberturaPct != null
                  ? `Cobertura ${data.coberturaPct}% dos pedidos`
                  : undefined
            }
          />
          <Row
            label="Margem CMV"
            value={
              loading || !data ? '…' : inconsistente ? 'Inconsistente' : data.margemFmt
            }
            tone={partial || semMargem || inconsistente ? 'warn' : 'strong'}
            hint={
              inconsistente
                ? 'Não usar como P&L — corrigir CMV no Financial'
                : partial || semMargem
                  ? 'Não é P&L completo — só pedidos com NF'
                  : `Média ${data?.margemMediaFmt ?? ''}`
            }
          />
        </Stack>
      </CardContent>
    </Card>
  )
}
