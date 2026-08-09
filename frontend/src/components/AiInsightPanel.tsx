import { useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Link,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import { Hicon } from './Hicon'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import {
  fetchInsightResumo,
  type InsightAchado,
  type InsightDominio,
  type InsightResumo,
} from '../api/bridge'

export type InsightFallback = {
  title: string
  detail: string
  recommendations: ReadonlyArray<{ title: string; detail: string; to: string }>
}

const NIVEL_LABEL: Record<string, string> = {
  alta: 'Confiança alta',
  media: 'Confiança média',
  baixa: 'Confiança baixa',
}

/**
 * Painel «Insight da IA» — leitura, recomendações e próxima ação vindas do
 * bridge (`/insights/resumo`), a mesma resposta que o Hermes dá no chat.
 * Enquanto carrega (ou se o bridge falhar) mostra a leitura local da página.
 */
export function AiInsightPanel({
  dominio,
  fallback,
  ctaTo = '/insights/prioridades',
  ctaLabel = 'Ver plano de ação sugerido',
}: {
  dominio: InsightDominio
  fallback: InsightFallback
  ctaTo?: string
  ctaLabel?: string
}) {
  const theme = useTheme()
  const { periodQuery, marketplace } = useBiData()
  const { isFiestaActive, activeSource } = useBiSource()
  const [data, setData] = useState<InsightResumo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const sourceLive =
      isFiestaActive ||
      (Boolean(activeSource?.db_name) &&
        /^bi_/i.test(String(activeSource?.db_name)) &&
        Number(activeSource?.pedidos_count || 0) > 0)
    if (!sourceLive) {
      setData(null)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    fetchInsightResumo(dominio, periodQuery, marketplace || undefined)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dominio, periodQuery, marketplace, isFiestaActive, activeSource?.id, activeSource?.db_name, activeSource?.pedidos_count])

  const titulo = data?.titulo || fallback.title
  const detalhe = data?.principal?.detalhe || fallback.detail
  const recomendacoes: InsightAchado[] =
    data?.recomendacoes?.length
      ? data.recomendacoes
      : fallback.recommendations.map((r) => ({
          titulo: r.title,
          detalhe: r.detail,
          destino: r.to,
        }))
  const nivel = data?.confianca?.nivel
  const destinoCta = data?.proxima_acao?.destino || ctaTo
  const perguntarRica = () => {
    const label = data?.dominio_label || dominio
    window.dispatchEvent(
      new CustomEvent('fiesta:open-rica', {
        detail: {
          prompt: `Explique o insight da IA de ${label} neste período e diga o que devo priorizar.`,
        },
      }),
    )
  }

  const sourceLive =
    isFiestaActive ||
    (Boolean(activeSource?.db_name) &&
      /^bi_/i.test(String(activeSource?.db_name)) &&
      Number(activeSource?.pedidos_count || 0) > 0)

  if (!sourceLive) {
    return (
      <Card
        sx={{
          height: 'auto',
          width: '100%',
          maxWidth: { xs: '100%', lg: 400 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.22),
          bgcolor: alpha(theme.palette.primary.main, 0.05),
        }}
      >
        <CardContent>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
            <Hicon name="activity" sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
            <Typography variant="overline" fontWeight={800} letterSpacing={0.08} color="primary">
              Insight da IA
            </Typography>
          </Stack>
          <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
            Sem leitura para {activeSource?.name || 'esta fonte'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            O motor de insights usa o contrato do Financial. Enquanto esta fonte não tiver carga
            validada e roteamento próprio, mostrar uma leitura aqui seria repetir números do Fiesta
            sob outro nome.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      sx={{
        /* Cartão compacto (conteúdo) — nunca esticar altura da coluna */
        height: 'auto',
        width: '100%',
        maxWidth: { xs: '100%', lg: 400 },
        borderRadius: 2,
        border: '1px solid',
        borderColor: alpha(theme.palette.primary.main, 0.22),
        bgcolor: alpha(theme.palette.primary.main, 0.05),
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
          <Hicon name="activity" sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
          <Typography variant="overline" fontWeight={800} letterSpacing={0.08} color="primary">
            Insight da IA
          </Typography>
          {nivel ? (
            <Tooltip title={data?.confianca?.motivo || ''}>
              <Chip
                size="small"
                label={NIVEL_LABEL[nivel] || nivel}
                sx={{
                  height: 18,
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  bgcolor: alpha(
                    nivel === 'alta'
                      ? theme.palette.success.main
                      : nivel === 'baixa'
                        ? theme.palette.error.main
                        : theme.palette.warning.main,
                    0.14,
                  ),
                  color:
                    nivel === 'alta'
                      ? theme.palette.success.main
                      : nivel === 'baixa'
                        ? theme.palette.error.main
                        : theme.palette.warning.main,
                }}
              />
            </Tooltip>
          ) : null}
        </Stack>

        {loading && !data ? (
          <Skeleton variant="text" width="90%" height={22} />
        ) : (
          <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
            {titulo}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {detalhe}
        </Typography>
        {data?.leitura ? (
          <Typography
            variant="caption"
            display="block"
            sx={{ mb: 1.25, fontWeight: 600, color: 'text.primary', opacity: 0.85 }}
          >
            {data.leitura}
          </Typography>
        ) : null}

        <Typography
          variant="overline"
          fontWeight={800}
          letterSpacing={0.08}
          color="text.secondary"
          sx={{ display: 'block', mb: 1 }}
        >
          Recomendações
        </Typography>
        <Stack spacing={0.9}>
          {recomendacoes.slice(0, 3).map((r) => (
            <Box
              key={r.titulo}
              sx={{
                p: 0.85,
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" fontWeight={700} display="block">
                {r.titulo}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mb: 0.35 }}
              >
                {r.detalhe}
              </Typography>
              {r.destino ? (
                <Link
                  component={RouterLink}
                  to={r.destino}
                  underline="hover"
                  fontWeight={600}
                  sx={{ fontSize: '0.72rem' }}
                >
                  Abrir →
                </Link>
              ) : null}
            </Box>
          ))}
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75} sx={{ mt: 1.25 }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={perguntarRica}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Perguntar à knowt
          </Button>
          <Button
            component={RouterLink}
            to={destinoCta}
            variant="contained"
            fullWidth
            sx={{ textTransform: 'none', borderRadius: 2 }}
            endIcon={<Hicon name="chevron-right" sx={{ fontSize: '1rem' }} />}
          >
            {data?.proxima_acao?.titulo ? 'Resolver agora' : ctaLabel}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
