import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import activitySvg from '../assets/hicons-outline/activity.svg?raw'
import archiveSvg from '../assets/hicons-outline/archive.svg?raw'
import bagSvg from '../assets/hicons-outline/bag.svg?raw'
import buySvg from '../assets/hicons-outline/buy.svg?raw'
import categorySvg from '../assets/hicons-outline/category.svg?raw'
import chevronDownSvg from '../assets/hicons-outline/chevron-down.svg?raw'
import chevronLeftSvg from '../assets/hicons-outline/chevron-left.svg?raw'
import chevronRightSvg from '../assets/hicons-outline/chevron-right.svg?raw'
import clockSvg from '../assets/hicons-outline/clock.svg?raw'
import documentSvg from '../assets/hicons-outline/document.svg?raw'
import graphSvg from '../assets/hicons-outline/graph.svg?raw'
import groupSvg from '../assets/hicons-outline/group.svg?raw'
import homeSvg from '../assets/hicons-outline/home.svg?raw'
import mapSvg from '../assets/hicons-outline/map.svg?raw'
import menuSvg from '../assets/hicons-outline/menu.svg?raw'
import paymentSvg from '../assets/hicons-outline/payment.svg?raw'
import pencilSvg from '../assets/hicons-outline/pencil.svg?raw'
import percentSvg from '../assets/hicons-outline/percent.svg?raw'
import refreshSvg from '../assets/hicons-outline/refresh.svg?raw'
import reportSvg from '../assets/hicons-outline/report.svg?raw'
import syncSvg from '../assets/hicons-outline/sync.svg?raw'
import trashSvg from '../assets/hicons-outline/trash.svg?raw'
import userSvg from '../assets/hicons-outline/user.svg?raw'
import walletSvg from '../assets/hicons-outline/wallet.svg?raw'

const ICONS = {
  activity: activitySvg,
  archive: archiveSvg,
  bag: bagSvg,
  buy: buySvg,
  category: categorySvg,
  'chevron-down': chevronDownSvg,
  'chevron-left': chevronLeftSvg,
  'chevron-right': chevronRightSvg,
  clock: clockSvg,
  document: documentSvg,
  graph: graphSvg,
  group: groupSvg,
  home: homeSvg,
  map: mapSvg,
  menu: menuSvg,
  payment: paymentSvg,
  pencil: pencilSvg,
  percent: percentSvg,
  refresh: refreshSvg,
  report: reportSvg,
  sync: syncSvg,
  trash: trashSvg,
  user: userSvg,
  wallet: walletSvg,
} as const

export type HiconName = keyof typeof ICONS

export type HiconProps = {
  name: HiconName
  color?: string
  sx?: SxProps<Theme>
} & Omit<ComponentPropsWithoutRef<'span'>, 'color' | 'children'>

/** Ícones outline (hicon) em `src/assets/hicons-outline`. */
export const Hicon = forwardRef<HTMLSpanElement, HiconProps>(function Hicon(
  { name, color = 'inherit', sx, ...other },
  ref,
) {
  const svg = ICONS[name]
  return (
    <Box
      ref={ref}
      component="span"
      {...other}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 0,
        fontSize: '1.25rem',
        width: '1em',
        height: '1em',
        color: color === 'inherit' ? undefined : color,
        '& svg': {
          display: 'block',
          width: '1em',
          height: '1em',
        },
        ...sx,
      }}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
})
