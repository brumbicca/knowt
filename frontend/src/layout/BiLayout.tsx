import { useEffect, useState } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Drawer,
  Fab,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Outlet } from 'react-router-dom'
import { AssistantDrawer } from '../components/AssistantDrawer'
import { BiDateRangeField } from '../components/BiDateRangeField'
import { DomainNav } from '../components/DomainNav'
import { SourceCardsBar } from '../components/SourceCardsBar'
import { SourceProvenanceStrip } from '../components/SourceProvenanceStrip'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import { useBiTheme } from '../state/BiThemeContext'
import { THEME_OPTIONS, type BiThemeId } from '../theme'
import type { Periodo } from '../api/bridge'

export function BiLayout() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null)
  const { themeId, setThemeId } = useBiTheme()
  const {
    periodo,
    setPeriodo,
    periodoOptions,
    customRange,
    setCustomRange,
    marketplace,
    setMarketplace,
    marketplaceOptions,
    loading,
    refresh,
    data,
  } = useBiData()
  const { isFiestaActive, activeSource } = useBiSource()
  const sourceLabel = activeSource?.name || 'Fiesta'

  useEffect(() => {
    const openAssistant = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail
      setAssistantPrompt(detail?.prompt || null)
      setAssistantOpen(true)
    }
    window.addEventListener('fiesta:open-rica', openAssistant)
    return () => window.removeEventListener('fiesta:open-rica', openAssistant)
  }, [])

  const openAssistantManually = () => {
    setAssistantPrompt(null)
    setAssistantOpen(true)
  }

  // Com fonte externa o overview vem vazio por construção: sugerir «alarga o
  // período» seria tratar ausência de ligação como período sem vendas.
  const emptyPeriod =
    isFiestaActive &&
    !loading &&
    !!data &&
    Number(data.vendas || 0) === 0 &&
    Number(data.pedidos || 0) === 0
  const weekToDateOnlyToday =
    !customRange &&
    periodo === 'semana' &&
    !!data?.rangeLabel &&
    data.rangeLabel.includes('→') &&
    data.rangeLabel.split(/\s*→\s*/)[0]?.trim() === data.rangeLabel.split(/\s*→\s*/)[1]?.trim()

  const canalLabel =
    marketplaceOptions.find((o) => o.id === marketplace)?.label || 'Todos os canais'

  const statusLine = [
    `Fonte · ${sourceLabel}`,
    isFiestaActive ? 'Marketplaces · knowt' : 'Consulta externa · sem mistura',
    [
      isFiestaActive ? 'Mesma verdade que a knowt' : `Origem ${sourceLabel}`,
      data?.rangeLabel,
      marketplace ? canalLabel : null,
      data?.prevVendasFmt
        ? `ant. ${data.prevVendasFmt}${
            data.deltaVendasPct != null
              ? ` (${data.deltaVendasPct > 0 ? '+' : ''}${data.deltaVendasPct.toFixed(1)}%)`
              : ''
          }`
        : null,
    ]
      .filter(Boolean)
      .join(' · '),
  ].join(' | ')

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" elevation={0}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          justifyContent="space-between"
          useFlexGap
          flexWrap="wrap"
          sx={{
            maxWidth: 1400,
            width: '100%',
            mx: 'auto',
            px: { xs: 1.5, sm: 2 },
            py: { xs: 1, sm: 1.15 },
            boxSizing: 'border-box',
            minHeight: { xs: 56, sm: 72 },
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: '1 1 280px' }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '8px',
                background: theme.chart.logoGradient,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.04em',
                flexShrink: 0,
                boxShadow: `0 4px 12px ${theme.palette.primary.main}59`,
              }}
            >
              BI
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  lineHeight: 1.2,
                  fontSize: { xs: '0.95rem', sm: '1.15rem' },
                  fontFamily: '"Outfit", sans-serif',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                knowt — Command Center
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  fontSize: { xs: '0.72rem', sm: '0.8rem' },
                  lineHeight: 1.35,
                  mt: 0.2,
                  whiteSpace: { xs: 'normal', sm: 'nowrap' },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={statusLine}
              >
                {statusLine}
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ flexShrink: 0, ml: { xs: 0, sm: 'auto' } }}
          >
            <Chip
              size="small"
              color="success"
              variant="outlined"
              label={loading && !data ? '…' : 'Ao vivo'}
              sx={{ fontWeight: 700, flexShrink: 0 }}
            />
            <TextField
              select
              size="small"
              label="Tema"
              value={themeId}
              onChange={(e) => setThemeId(e.target.value as BiThemeId)}
              sx={{ minWidth: { xs: 100, sm: 120 } }}
            >
              {THEME_OPTIONS.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              size="small"
              variant="text"
              onClick={refresh}
              disabled={loading}
              sx={{ flexShrink: 0, textTransform: 'none' }}
            >
              {isMobile ? '↻' : 'Actualizar'}
            </Button>
            {!isMobile ? (
              <Button variant="contained" onClick={openAssistantManually} sx={{ flexShrink: 0 }}>
                knowt
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </AppBar>

      <SourceCardsBar />

      <SourceProvenanceStrip />

      <DomainNav />

      {/* Filtros de período / canal — abaixo das abas */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 1.5, sm: 2 },
          pb: 1.25,
          boxSizing: 'border-box',
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
          sx={{
            px: { xs: 1.25, sm: 1.5 },
            py: 1.15,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: (t) =>
              t.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(15, 118, 110, 0.18)',
            borderTop: 'none',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
          }}
        >
          {isMobile ? (
            <>
              <TextField
                select
                size="small"
                label="Período"
                value={customRange ? 'custom' : periodo}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'custom') return
                  setPeriodo(v as Periodo)
                }}
                sx={{ flex: 1, minWidth: 120 }}
                disabled={loading}
              >
                {periodoOptions.map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </MenuItem>
                ))}
                {customRange ? (
                  <MenuItem value="custom">Personalizado</MenuItem>
                ) : null}
              </TextField>
              <BiDateRangeField
                value={customRange}
                onApply={(r) => setCustomRange(r)}
                onClear={() => setCustomRange(null)}
                disabled={loading}
                sx={{ flex: 1, minWidth: 160 }}
              />
              <TextField
                select
                size="small"
                label="Canal"
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
                sx={{ flex: 1, minWidth: 100 }}
                disabled={loading}
              >
                {marketplaceOptions.map((opt) => (
                  <MenuItem key={opt.id || 'all'} value={opt.id}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                {periodoOptions.map((opt) => (
                  <Chip
                    key={opt.id}
                    size="medium"
                    label={opt.label}
                    color={!customRange && periodo === opt.id ? 'primary' : 'default'}
                    variant={!customRange && periodo === opt.id ? 'filled' : 'outlined'}
                    onClick={() => setPeriodo(opt.id as Periodo)}
                    disabled={loading && !customRange && periodo === opt.id}
                    sx={{
                      height: 36,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      px: 0.5,
                      '& .MuiChip-label': { px: 1.5 },
                    }}
                  />
                ))}
              </Stack>
              <BiDateRangeField
                value={customRange}
                onApply={(r) => setCustomRange(r)}
                onClear={() => setCustomRange(null)}
                disabled={loading}
              />
              <TextField
                select
                size="small"
                label="Canal"
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
                sx={{ minWidth: 160, ml: { md: 'auto' } }}
                disabled={loading}
              >
                {marketplaceOptions.map((opt) => (
                  <MenuItem key={opt.id || 'all'} value={opt.id}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}
        </Stack>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          p: { xs: 1.5, sm: 2, md: 3 },
          pt: { xs: 1.5, sm: 2 },
          pb: { xs: 'calc(88px + env(safe-area-inset-bottom, 0px))', sm: 3 },
          maxWidth: 1400,
          width: '100%',
          mx: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {emptyPeriod ? (
          <Alert
            severity="warning"
            variant="outlined"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => setPeriodo('7d')}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Últimos 7 dias
              </Button>
            }
          >
            {weekToDateOnlyToday
              ? '«Esta semana» na segunda-feira cobre só hoje — ainda sem vendas. Clique em Últimos 7 dias para ver o histórico.'
              : 'Sem vendas neste intervalo. Clique em Últimos 7 dias ou escolha outro período.'}
          </Alert>
        ) : null}
        {!isFiestaActive && activeSource && Number(activeSource.pedidos_count || 0) <= 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Fonte <strong>{activeSource.name}</strong> ({activeSource.db_name}) — ainda sem pedidos
            carregados no espelho. Os KPIs ficam vazios até a carga desta fonte concluir.
          </Alert>
        ) : null}
        {!isFiestaActive && activeSource && Number(activeSource.pedidos_count || 0) > 0 ? (
          <Alert severity="success" sx={{ mb: 2 }} variant="outlined">
            Fonte <strong>{activeSource.name}</strong> — a ler{' '}
            <code>{activeSource.db_name}</code> (
            {Number(activeSource.pedidos_count).toLocaleString('pt-BR')} pedidos). Números isolados
            do Fiesta.
          </Alert>
        ) : null}
        <Outlet />
      </Box>

      {isMobile ? (
        <Fab
          color="primary"
          variant="extended"
          onClick={openAssistantManually}
          aria-label="Abrir assistente knowt"
          sx={{
            position: 'fixed',
            right: 16,
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            zIndex: (t) => t.zIndex.speedDial,
            textTransform: 'none',
            fontWeight: 700,
            boxShadow: 4,
          }}
        >
          knowt
        </Fab>
      ) : null}

      <Drawer
        anchor="right"
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420 },
            maxWidth: '100vw',
            height: '100%',
          },
        }}
      >
        <AssistantDrawer
          onClose={() => setAssistantOpen(false)}
          initialPrompt={assistantPrompt}
        />
      </Drawer>
    </Box>
  )
}
