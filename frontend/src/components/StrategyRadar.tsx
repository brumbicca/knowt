import { Box, Typography, useTheme } from '@mui/material'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { ChartEmpty } from './ChartEmpty'

export type RadarAxisPoint = {
  eixo: string
  score: number
  hint?: string
}

type Props = {
  data: RadarAxisPoint[]
  height?: number
}

/** Radar 0–100 · eixos estratégicos a partir de métricas já existentes. */
export function StrategyRadar({ data, height = 220 }: Props) {
  const theme = useTheme()
  const chart = theme.chart
  const ready = data.some((d) => d.score > 0)

  if (!ready) {
    return (
      <Box sx={{ height }}>
        <ChartEmpty title="Sem base para o radar neste período." dense />
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke={theme.palette.divider} />
          <PolarAngleAxis
            dataKey="eixo"
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: theme.palette.text.disabled }}
            axisLine={false}
          />
          <Tooltip
            formatter={(value, _n, item) => {
              const hint = (item?.payload as RadarAxisPoint | undefined)?.hint
              return [hint ? `${Number(value).toFixed(0)} · ${hint}` : Number(value).toFixed(0), 'Score']
            }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${theme.palette.divider}`,
            }}
          />
          <Radar
            name="Actual"
            dataKey="score"
            stroke={chart.line}
            fill={chart.fill}
            fillOpacity={0.35}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 0.5 }}>
        Escala 0–100 · normalizado a partir dos KPIs do período
      </Typography>
    </Box>
  )
}
