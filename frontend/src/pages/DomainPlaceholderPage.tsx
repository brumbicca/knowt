import { Alert, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

const DOMAIN_COPY: Record<
  string,
  { title: string; blurb: string; bridge: string; fase: string }
> = {
  vendas: {
    title: 'Vendas',
    blurb: 'Tendência, canais, top SKUs e comparação de períodos — já na Home; esta área ganha profundidade na Fase B.',
    bridge: '/vendas/* · /vendas/comparacao · /vendas/dashboard-completo',
    fase: 'A → B',
  },
  pedidos: {
    title: 'Pedidos',
    blurb: 'Lista read-only, métricas e detalhe — dados já no bridge; UI completa na Fase C.',
    bridge: '/pedidos · /pedidos/{id} · /pedidos/metricas',
    fase: 'C',
  },
  margens: {
    title: 'Margens & CMV',
    blurb: 'Cobertura NF, lista e por loja. O resumo já alimenta o mini P&L da Home.',
    bridge: '/margens/periodo · /margens/lista · /margens/lojas · /cmv/estatisticas',
    fase: 'B',
  },
  fiscal: {
    title: 'Fiscal (NF)',
    blurb: 'Volume de notas no período e gap vs pedidos. Alertas ops já cobrem a lacuna na Home.',
    bridge: '/notas-fiscais/periodo · /ops/alerts',
    fase: 'B',
  },
  fretes: {
    title: 'Fretes',
    blurb: 'Custo de frete por período/canal. O líquido da Home já usa frete agregado das métricas.',
    bridge: '/fretes/periodo · metricas.totalFrete',
    fase: 'B',
  },
  despesas: {
    title: 'Despesas',
    blurb: 'Relatório e período — endpoint bridge já existe; ecrã dedicado na Fase B.',
    bridge: '/despesas/periodo · /despesas/relatorio',
    fase: 'B',
  },
  clientes: {
    title: 'Clientes',
    blurb: 'Relatório de clientes do período — bridge pronto; UI na Fase B.',
    bridge: '/clientes/relatorio',
    fase: 'B',
  },
  operacoes: {
    title: 'Operações',
    blurb: 'Sync, lojas, origem S1 e saúde do Sistema — cards da Home avançam para painel dedicado na Fase C.',
    bridge: '/sync/status · /lojas · /origem/stats · /ops/alerts',
    fase: 'C',
  },
}

type Props = { domain: keyof typeof DOMAIN_COPY }

export function DomainPlaceholderPage({ domain }: Props) {
  const meta = DOMAIN_COPY[domain]
  return (
    <Stack spacing={2}>
      <Typography variant="h4" sx={{ fontSize: { xs: '1.35rem', sm: '2rem' } }}>
        {meta.title}
      </Typography>
      <Card>
        <CardContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Fase {meta.fase} do BI completo — a Home já consome parte destes dados. Esta página
            será o ecrã dedicado.
          </Alert>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            {meta.blurb}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Bridge: {meta.bridge}
          </Typography>
          <Button component={RouterLink} to="/" variant="contained">
            Voltar à Home
          </Button>
        </CardContent>
      </Card>
    </Stack>
  )
}
