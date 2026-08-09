import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import { useBiSource } from '../state/BiSourceContext'

/**
 * Rotas que dependem de capabilities só-Fiesta (ops, fiscal Tiny/NF, sync, CMV…).
 * Espelhos bi_* têm vendas/pedidos/margens — estas páginas não devem misturar Fiesta.
 */
const FIESTA_ONLY_PREFIXES = [
  '/fiscal',
  '/despesas',
  '/clientes',
  '/pagamentos',
  '/operacoes',
  '/insights/alertas',
] as const

function isFiestaOnlyPath(pathname: string): boolean {
  return FIESTA_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/**
 * Páginas de domínio: com espelho bi_* publicado (ex. Salesforce), deixa passar
 * excepto rotas só-Fiesta. Fontes sem carga/contrato: aviso genérico.
 */
export function SourceScopeGuard() {
  const { isFiestaActive, activeSource, setActiveSourceId } = useBiSource()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (isFiestaActive || !activeSource) return <Outlet />

  const db = String(activeSource.db_name || '')
  const liveMirror = /^bi_[a-z0-9_]+$/i.test(db) && Number(activeSource.pedidos_count || 0) > 0

  if (liveMirror && isFiestaOnlyPath(pathname)) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="small" label="Só Fiesta" color="warning" variant="outlined" />
              <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
                Indisponível em {activeSource.name}
              </Typography>
            </Stack>
            <Typography color="text.secondary" sx={{ fontSize: '0.95rem' }}>
              Esta área (fiscal / alertas operacionais / sync / despesas / clientes / pagamentos)
              ainda não tem contrato publicado para fontes externas. Mostrar números do Fiesta
              com <strong>{activeSource.name}</strong> activo seria incorrecto — por isso fica
              fechada.
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>
              Em {activeSource.name} podes usar Vendas, Pedidos, Margens, Produtos e Insights
              comerciais com os dados do espelho.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                size="small"
                onClick={() => setActiveSourceId('fiesta')}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Ver em Fiesta
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate('/vendas')}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Ir para Vendas
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => navigate('/')}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Home
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  if (liveMirror) return <Outlet />

  const pedidos = Number(activeSource.pedidos_count || 0)

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" label="Fonte externa" color="info" variant="outlined" />
            <Typography variant="h6" sx={{ fontSize: '1.05rem' }}>
              {activeSource.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <code>{activeSource.db_name}</code>
            </Typography>
          </Stack>

          <Typography color="text.secondary" sx={{ fontSize: '0.95rem' }}>
            Esta página ainda não consulta a fonte <strong>{activeSource.name}</strong>. Os ecrãs de
            domínio leem o contrato do Financial, por isso mostrar aqui números do Fiesta com o card
            de outra empresa activo seria incorrecto.
          </Typography>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              O que falta para esta fonte responder
            </Typography>
            <Typography component="ul" color="text.secondary" sx={{ m: 0, pl: 2.5, fontSize: '0.9rem' }}>
              <li>
                Carga validada nas collections do contrato
                {pedidos > 0 ? ` (${pedidos.toLocaleString('pt-BR')} pedidos já indexados)` : ' (ainda sem pedidos)'}
              </li>
              <li>Roteamento por fonte no Agent Gateway, para o BI pedir os dados do banco certo</li>
              <li>Reconciliação contra a origem antes de publicar cada métrica</li>
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              size="small"
              onClick={() => setActiveSourceId('fiesta')}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Voltar à fonte Fiesta
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate('/')}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Ir para a Home
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
