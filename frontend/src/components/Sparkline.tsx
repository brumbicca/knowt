import { useId } from 'react'
import { Box, useTheme } from '@mui/material'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

type Props = {
  values: number[]
  /** cor do traço; default primary */
  color?: string
  height?: number
}

/** Mini tendência para KPI cards (só visual — mesmos dados da série diária). */
export function Sparkline({ values, color, height = 28 }: Props) {
  const theme = useTheme()
  const gid = useId().replace(/:/g, '')
  const stroke = color || theme.palette.primary.main
  const data = values.map((v, i) => ({ i, v: Number(v) || 0 }))
  if (data.length < 2) return null

  return (
    <Box sx={{ width: '100%', height, mt: 0.75, pointerEvents: 'none' }} aria-hidden>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`kpiSpark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={stroke}
            fill={`url(#kpiSpark-${gid})`}
            strokeWidth={1.5}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  )
}
