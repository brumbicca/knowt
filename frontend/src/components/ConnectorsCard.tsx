import { useEffect, useState } from 'react'
import { Box, Chip, Stack, Typography } from '@mui/material'
import { bridgeGet } from '../api/bridge'
import { useBiSource } from '../state/BiSourceContext'

type Connector = {
  id: string
  name: string
  role: string
  status: 'active' | 'pilot' | 'soon'
  detail: string
}

type ConnectorsApi = {
  connectors?: Array<{ id?: string; status?: string; vendor?: string; tenants?: string[] }>
}

/** Secção Conectores — estado real das fontes (demo investidor + multi-fonte). */
export function ConnectorsCard() {
  const { sources, isFiestaActive, activeSource } = useBiSource()
  const [remote, setRemote] = useState<NonNullable<ConnectorsApi['connectors']>>([])

  useEffect(() => {
    bridgeGet<ConnectorsApi>('/connectors')
      .then((res) => setRemote(res.connectors || []))
      .catch(() => setRemote([]))
  }, [])

  const sfLive = sources.some(
    (s) =>
      !s.builtin &&
      /^bi_salesforce/i.test(String(s.db_name || '')) &&
      Number(s.pedidos_count || 0) > 0,
  )
  const trayLive = sources.some(
    (s) => s.id === 'traydemo' || /^bi_tray/i.test(String(s.db_name || '')),
  )
  const trayRemote = remote.find((c) => c.id === 'tray-ecommerce')

  const connectors: Connector[] = [
    {
      id: 'fiesta',
      name: 'Fiesta',
      role: 'S1 API + S2 Financial',
      status: 'active',
      detail: isFiestaActive
        ? 'Fonte activa — vendas, pedidos, margens e lojas via Agent Gateway (mesma verdade da Rica IA).'
        : 'Disponível no card de fontes — troca sem misturar números com Salesforce/Tray.',
    },
    {
      id: 'google',
      name: 'Google Workspace',
      role: 'Calendar + Tasks OAuth',
      status: 'active',
      detail:
        'Agenda e tarefas sincronizadas no BI, chat Rica IA e Telegram; brief diário às 08:00.',
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      role: sfLive ? 'Espelho bi_salesforce_* · orders.v1' : 'CRM / ERP',
      status: sfLive ? 'active' : 'soon',
      detail: sfLive
        ? activeSource &&
          !activeSource.builtin &&
          /^bi_salesforce/i.test(String(activeSource.db_name || ''))
          ? `Espelho activo em «${activeSource.name}» — vendas/pedidos/representantes; fiscal/NF só no Fiesta.`
          : 'Bello Copo e Bello Festas carregados (espelho Mongo). Selecciona o card da fonte para consultar.'
        : 'Placeholder — interface DataSource pronta para ligar CRM sem reescrever o BI.',
    },
    {
      id: 'tray',
      name: 'Tray',
      role: trayLive || trayRemote ? 'Ecommerce · orders.v1 (Fase 10)' : 'Ecommerce platform',
      status: trayLive ? 'active' : trayRemote ? 'pilot' : 'soon',
      detail: trayLive
        ? activeSource?.id === 'traydemo'
          ? 'Fonte Tray Demo activa — segundo sistema (não-Salesforce) no mesmo contrato orders.v1.'
          : 'Fonte Tray Demo disponível nos cards — prova de generalização multi-sistema.'
        : trayRemote
          ? 'Conector tray-ecommerce declarado — seed demo via POST /connectors/tray-ecommerce/seed.'
          : 'Segundo sistema previsto para provar que o factory não é exclusivo Salesforce.',
    },
  ]

  const statusLabel = (s: Connector['status']) =>
    s === 'active' ? 'Activo' : s === 'pilot' ? 'Piloto' : 'Em breve'

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="h6">Conectores</Typography>
        <Chip size="small" label="Arquitectura" variant="outlined" />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        {sfLive || trayLive
          ? 'Fiesta + Salesforce + Tray + Google na mesma camada — troca de fonte no topo, sem mistura.'
          : 'Hoje Fiesta; o desenho já prevê Salesforce, Tray e outros ERPs na mesma camada de consulta.'}
      </Typography>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        sx={{ alignItems: 'stretch' }}
      >
        {connectors.map((c) => (
          <Box
            key={c.id}
            sx={{
              flex: 1,
              p: 1.75,
              borderRadius: '12px',
              border: '1px solid',
              borderColor:
                c.status === 'active'
                  ? 'rgba(15, 118, 110, 0.3)'
                  : c.status === 'pilot'
                    ? 'rgba(2, 132, 199, 0.35)'
                    : 'divider',
              bgcolor:
                c.status === 'active'
                  ? 'rgba(15, 118, 110, 0.045)'
                  : c.status === 'pilot'
                    ? 'rgba(2, 132, 199, 0.04)'
                    : 'rgba(15, 23, 42, 0.02)',
              opacity: c.status === 'soon' ? 0.85 : 1,
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              spacing={0.75}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{ fontFamily: '"Outfit", sans-serif', fontSize: '0.95rem' }}
                >
                  {c.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {c.role}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={statusLabel(c.status)}
                color={
                  c.status === 'active' ? 'success' : c.status === 'pilot' ? 'info' : 'default'
                }
                variant={c.status === 'soon' ? 'outlined' : 'filled'}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.45 }}>
              {c.detail}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
