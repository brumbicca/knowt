import { Alert, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { DomainPageShell } from '../components/DomainPageShell'

export type InsightsDomainId =
  | 'home'
  | 'alertas'
  | 'prioridades'
  | 'comercial'
  | 'produtos'
  | 'logistica'
  | 'financeiro'

const COPY: Record<
  InsightsDomainId,
  {
    title: string
    pdf: string
    blurb: string
    dados: string
    fase: string
  }
> = {
  home: {
    title: 'Insights',
    pdf: 'pág. 12 — Visão executiva / principais insights',
    blurb:
      'Resumo narrativo do que mais importa: vendas, margem, fiscal, sync e prioridades — cards de insight + radar, não só KPIs crus (isso fica no Business).',
    dados: 'overview · ops/alerts · margens · agenda/tarefas',
    fase: '1',
  },
  alertas: {
    title: 'Alertas',
    pdf: 'pág. 13 — Alertas do dia',
    blurb:
      'Severidade, ranking e histórico curto dos alertas operacionais (CMV/NF, sync, UpSeller). A Home Business já mostra um pedaço; aqui é o painel completo.',
    dados: '/ops/alerts · margin_gap · sync',
    fase: '1',
  },
  prioridades: {
    title: 'Prioridades',
    pdf: 'pág. 14 — Prioridades da semana',
    blurb:
      'O que atacar esta semana: gaps fiscais, tarefas abertas, compromissos e canais com queda. Combina alertas + tarefas + agenda.',
    dados: 'ops/alerts · /tarefas · /agenda/semana',
    fase: '1',
  },
  comercial: {
    title: 'Comercial',
    pdf: 'pág. 16 — Comercial inteligente',
    blurb:
      'Funil, canais, ticket e tendência com leitura de insight (não a grelha operacional de Pedidos/Vendas do Business).',
    dados: 'dashboard · métricas · canais · status pedidos',
    fase: '2',
  },
  produtos: {
    title: 'Mix & SKUs',
    pdf: 'pág. 17 — Produtos e estoque (mix / ABC)',
    blurb:
      'ABC/Pareto, faixas de ticket e concentração de receita. Sem WMS industrial — “estoque” no PDF vira mix e saúde de catálogo/SKU.',
    dados: 'top SKUs · catálogo S2 · ticket médio',
    fase: '2',
  },
  logistica: {
    title: 'Logística',
    pdf: 'pág. 19 — Expedição (adaptada a fretes / status)',
    blurb:
      'Frete no líquido, faixas de custo e pedidos em trânsito/sem NF. Não é fábrica/expedição BelloCopo — é logística marketplace.',
    dados: 'fretes · métricas.frete · status pedidos · gaps NF',
    fase: '2',
  },
  financeiro: {
    title: 'Financeiro',
    pdf: 'pág. 21 — Financeiro inteligente',
    blurb:
      'Fluxo receita × taxas × líquido, margem/CMV e despesas — leitura de insight sobre os mesmos números do Business.',
    dados: 'métricas · margens · pagamentos · despesas',
    fase: '2',
  },
}

type Props = { domain: InsightsDomainId }

/** Placeholder Insights — conteúdo chega por fases; estrutura e copy já alinhados ao PDF. */
export function InsightsPlaceholderPage({ domain }: Props) {
  const meta = COPY[domain]
  return (
    <DomainPageShell
      title={meta.title}
      subtitle={`Insights · ${meta.pdf}`}
    >
      <Card>
        <CardContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Modo <strong>Insights</strong> — fase {meta.fase}. O Business continua a ser o operacional
            padrão; esta aba recebe narrativa, alertas e recomendações.
          </Alert>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>
            {meta.blurb}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Fontes previstas: {meta.dados}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button component={RouterLink} to="/insights" variant="contained" sx={{ textTransform: 'none' }}>
              Resumo Insights
            </Button>
            <Button component={RouterLink} to="/" variant="outlined" sx={{ textTransform: 'none' }}>
              Ir ao Business
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </DomainPageShell>
  )
}
