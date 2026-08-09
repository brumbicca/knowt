import { Box, Typography, useTheme } from '@mui/material'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { ChartEmpty } from './ChartEmpty'

type Props = {
  /** 0–100 */
  value: number | null | undefined
  label?: string
  hint?: string
  height?: number
}

/** Anel de cobertura / meta (0–100). */
export function CoverageGauge({
  value,
  label = 'Cobertura',
  hint,
  height = 220,
}: Props) {
  const theme = useTheme()
  const chart = theme.chart
  if (value == null || Number.isNaN(value)) {
    return (
      <Box sx={{ height }}>
        <ChartEmpty title="Sem cobertura neste período." dense />
      </Box>
    )
  }
  const pct = Math.max(0, Math.min(100, value))
  const data = [
    { name: 'ok', value: pct },
    { name: 'rest', value: Math.max(0.01, 100 - pct) },
  ]
  const tone =
    pct >= 80 ? theme.palette.success.main : pct >= 50 ? chart.line : theme.palette.error.main

  return (
    <Box sx={{ width: '100%', height, position: 'relative' }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            innerRadius="68%"
            outerRadius="88%"
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={tone} />
            <Cell fill={theme.palette.action.hover} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'none',
          pb: 1,
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 700,
              fontSize: '1.75rem',
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {pct.toFixed(0)}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          {hint ? (
            <Typography variant="caption" color="text.secondary" display="block">
              {hint}
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Box>
  )
}
