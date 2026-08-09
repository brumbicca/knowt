import { Box, useTheme } from '@mui/material'
import { Cell, Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartEmpty } from './ChartEmpty'

export type FunnelStage = {
  name: string
  total: number
}

type Props = {
  data: FunnelStage[]
  height?: number
}

/** Funil de status (maior → menor). Dados = contagens já agregadas. */
export function StatusFunnel({ data, height = 260 }: Props) {
  const theme = useTheme()
  const colors = theme.chart.pie
  const rows = [...data].filter((d) => d.total > 0).sort((a, b) => b.total - a.total)

  if (!rows.length) {
    return (
      <Box sx={{ height }}>
        <ChartEmpty title="Sem dados de status neste período." dense />
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer>
        <FunnelChart>
          <Tooltip
            formatter={(value) => [Number(value), 'Pedidos']}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${theme.palette.divider}`,
            }}
          />
          <Funnel dataKey="total" data={rows} isAnimationActive={false}>
            <LabelList
              position="right"
              fill={theme.palette.text.secondary}
              stroke="none"
              dataKey="name"
              fontSize={11}
            />
            {rows.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </Box>
  )
}
