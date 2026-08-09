import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import {
  Box,
  ButtonBase,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { Hicon, type HiconName } from './Hicon'

type NavItem = {
  to: string
  label: string
  exact?: boolean
  icon: HiconName
}

/** Ordem completa Business — «Mais» só se não couber. */
export const BI_NAV_ALL: NavItem[] = [
  { to: '/', label: 'Home', exact: true, icon: 'home' },
  { to: '/pedidos', label: 'Pedidos', icon: 'bag' },
  { to: '/margens', label: 'Margens', icon: 'graph' },
  { to: '/fiscal', label: 'Fiscal', icon: 'document' },
  { to: '/agenda', label: 'Agenda', icon: 'clock' },
  { to: '/operacoes', label: 'Operações', icon: 'sync' },
  { to: '/vendas', label: 'Vendas', icon: 'buy' },
  { to: '/produtos', label: 'Produtos', icon: 'category' },
  { to: '/pagamentos', label: 'Pagamentos', icon: 'payment' },
  { to: '/fretes', label: 'Fretes', icon: 'map' },
  { to: '/despesas', label: 'Despesas', icon: 'wallet' },
  { to: '/clientes', label: 'Clientes', icon: 'group' },
]

/** Abas Insights — knowt piloto (sem lane Business). */
export const INSIGHTS_NAV_ALL: NavItem[] = [
  { to: '/insights', label: 'Insights', exact: true, icon: 'activity' },
  { to: '/insights/agenda', label: 'Agenda', icon: 'clock' },
  { to: '/insights/alertas', label: 'Alertas', icon: 'report' },
  { to: '/insights/prioridades', label: 'Prioridades', icon: 'document' },
  { to: '/insights/comercial', label: 'Comercial', icon: 'buy' },
  { to: '/insights/produtos', label: 'Mix & SKUs', icon: 'category' },
  { to: '/insights/logistica', label: 'Logística', icon: 'map' },
  { to: '/insights/financeiro', label: 'Financeiro', icon: 'wallet' },
]

export const BI_NAV_PRIMARY = BI_NAV_ALL.slice(0, 6)
export const BI_NAV_MORE = BI_NAV_ALL.slice(6)
export const BI_NAV = BI_NAV_ALL.map((item) => ({
  ...item,
  exact: item.exact ?? false,
}))

export function isInsightsPath(pathname: string) {
  return pathname === '/insights' || pathname.startsWith('/insights/')
}

function pathActive(pathname: string, to: string, exact?: boolean) {
  return exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
}

const TOP_RADIUS = '8px'
const MAIS_MIN = 96

function estimateItemWidth(label: string, compact: boolean) {
  const char = compact ? 7 : 8
  const pad = compact ? 40 : 52
  return Math.ceil(pad + 20 + label.length * char)
}

type NavSegProps = {
  active: boolean
  label: string
  icon: HiconName
  to?: string
  onClick?: (e: MouseEvent<HTMLElement>) => void
  compact?: boolean
  roundTopLeft?: boolean
  roundTopRight?: boolean
  last?: boolean
}

function NavSegment({
  active,
  label,
  icon,
  to,
  onClick,
  compact,
  roundTopLeft,
  roundTopRight,
  last,
}: NavSegProps) {
  const sharedSx = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: compact ? 0.5 : 0.75,
    px: compact ? 0.75 : 1.25,
    py: compact ? 1 : 1.2,
    minHeight: compact ? 44 : 50,
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    color: active ? '#fff' : 'text.secondary',
    bgcolor: active ? 'primary.main' : 'transparent',
    fontWeight: active ? 700 : 600,
    fontSize: compact ? '0.78rem' : '0.875rem',
    fontFamily: '"Outfit", sans-serif',
    letterSpacing: 0.01,
    textDecoration: 'none',
    borderRight: last ? 'none' : '1px solid',
    borderColor: active ? 'rgba(255,255,255,0.22)' : 'rgba(15, 23, 42, 0.1)',
    borderTopLeftRadius: roundTopLeft ? TOP_RADIUS : 0,
    borderTopRightRadius: roundTopRight ? TOP_RADIUS : 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    transition: 'background-color 0.15s ease, color 0.15s ease',
    '&:hover': {
      bgcolor: active ? 'primary.dark' : 'action.selected',
      color: active ? '#fff' : 'text.primary',
    },
  } as const

  const content: ReactNode = (
    <>
      <Hicon name={icon} sx={{ fontSize: compact ? 18 : 20 }} />
      <Box
        component="span"
        sx={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}
      >
        {label}
      </Box>
    </>
  )

  if (to) {
    return (
      <ButtonBase
        component={RouterLink}
        to={to}
        disableRipple
        sx={sharedSx}
        aria-current={active ? 'page' : undefined}
      >
        {content}
      </ButtonBase>
    )
  }

  return (
    <ButtonBase disableRipple onClick={onClick} sx={sharedSx}>
      {content}
    </ButtonBase>
  )
}

export function DomainNav() {
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down('md'))
  const { pathname } = useLocation()
  const navAll = INSIGHTS_NAV_ALL
  const barRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(navAll.length)
  const [moreEl, setMoreEl] = useState<null | HTMLElement>(null)
  const moreOpen = Boolean(moreEl)

  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return

    const recompute = () => {
      const width = el.clientWidth
      let n = navAll.length
      while (n >= 1) {
        const needMais = n < navAll.length
        const budget = width - (needMais ? MAIS_MIN : 0)
        let used = 0
        for (let i = 0; i < n; i++) {
          used += estimateItemWidth(navAll[i].label, compact)
        }
        if (used <= budget || n === 1) break
        n -= 1
      }

      const activeIdx = navAll.findIndex((item) => pathActive(pathname, item.to, item.exact))
      if (activeIdx >= 0 && activeIdx >= n) {
        n = Math.max(n, Math.min(navAll.length, activeIdx + 1))
        const needMais = n < navAll.length
        const budget = width - (needMais ? MAIS_MIN : 0)
        let used = 0
        for (let i = 0; i < n; i++) used += estimateItemWidth(navAll[i].label, compact)
        while (n > 1 && used > budget) {
          n -= 1
          used = 0
          for (let i = 0; i < n; i++) used += estimateItemWidth(navAll[i].label, compact)
        }
      }

      setVisibleCount(n)
    }

    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [compact, pathname, navAll])

  const visible = navAll.slice(0, visibleCount)
  const overflow = navAll.slice(visibleCount)
  const showMais = overflow.length > 0
  const moreActive = overflow.some((item) => pathActive(pathname, item.to, item.exact))
  const cols = showMais
    ? `repeat(${visible.length}, minmax(0, 1fr)) ${MAIS_MIN}px`
    : `repeat(${visible.length}, minmax(0, 1fr))`

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 1400,
        mx: 'auto',
        px: { xs: 1.5, sm: 2 },
        pt: 1.25,
        pb: 0,
        boxSizing: 'border-box',
      }}
    >
      <Box
        ref={barRef}
        sx={{
          display: 'grid',
          gridTemplateColumns: cols,
          width: '100%',
          alignItems: 'stretch',
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#e2ebee',
          border: '1px solid',
          borderBottom: 'none',
          borderColor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(15, 118, 110, 0.22)',
          borderTopLeftRadius: TOP_RADIUS,
          borderTopRightRadius: TOP_RADIUS,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          overflow: 'hidden',
        }}
      >
        {visible.map((item, idx) => {
          const active = pathActive(pathname, item.to, item.exact)
          const isFirst = idx === 0
          const isLast = !showMais && idx === visible.length - 1
          return (
            <NavSegment
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={active}
              compact={compact}
              roundTopLeft={isFirst}
              roundTopRight={isLast}
              last={isLast}
            />
          )
        })}
        {showMais ? (
          <NavSegment
            label="Mais"
            icon="menu"
            active={moreActive || moreOpen}
            compact={compact}
            roundTopRight
            last
            onClick={(e) => setMoreEl(e.currentTarget)}
          />
        ) : null}
      </Box>

      <Menu
        anchorEl={moreEl}
        open={moreOpen}
        onClose={() => setMoreEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 200,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
            },
          },
        }}
      >
        {overflow.map((item) => {
          const active = pathActive(pathname, item.to, item.exact)
          return (
            <MenuItem
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={active}
              onClick={() => setMoreEl(null)}
              sx={{
                fontWeight: active ? 700 : 500,
                gap: 1.25,
                py: 1.1,
                fontFamily: '"Outfit", sans-serif',
              }}
            >
              <Hicon
                name={item.icon}
                sx={{
                  fontSize: 18,
                  color: active ? 'primary.main' : 'text.secondary',
                }}
              />
              <Typography variant="body2" fontWeight="inherit">
                {item.label}
              </Typography>
            </MenuItem>
          )
        })}
      </Menu>
    </Box>
  )
}
