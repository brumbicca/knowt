import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material'
import { DomainPageShell } from '../components/DomainPageShell'
import {
  fetchProdutoPorSku,
  fmtBrl,
  S2_APP_URL,
  type ProdutoDetalhe,
} from '../api/bridge'

export type TopSkuNavState = {
  descricao?: string
  receita?: number
  quantidade?: number
}

function str(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
  return String(v)
}

export function ProdutoPage() {
  const { sku: skuParam } = useParams<{ sku: string }>()
  const sku = decodeURIComponent(skuParam || '')
  const location = useLocation()
  const nav = (location.state || {}) as TopSkuNavState

  const [payload, setPayload] = useState<ProdutoDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!sku) {
      setLoading(false)
      setError('SKU inválido')
      return
    }
    setLoading(true)
    setError(null)
    fetchProdutoPorSku(sku)
      .then(setPayload)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar produto')
      })
      .finally(() => setLoading(false))
  }, [sku])

  useEffect(() => {
    load()
  }, [load])

  const produto = payload?.produto
  const inCatalog = Boolean(produto && typeof produto === 'object')
  const catalogSku =
    (payload?.catalog_sku && String(payload.catalog_sku)) ||
    (produto && str(produto.sku) !== '—' ? str(produto.sku) : '') ||
    sku
  const listingId = payload?.listing_id ? String(payload.listing_id) : null
  const resolvedFrom = payload?.resolved_from || null

  const titulo = useMemo(() => {
    if (inCatalog && produto) {
      return str(
        produto.description ||
          produto.descricao ||
          produto.nome ||
          produto.titulo ||
          catalogSku ||
          sku,
      )
    }
    return nav.descricao || catalogSku || sku || 'Produto'
  }, [inCatalog, produto, nav.descricao, catalogSku, sku])

  const rows = useMemo(() => {
    if (!inCatalog || !produto) return [] as Array<[string, string]>
    const cat =
      produto.categoria && typeof produto.categoria === 'object'
        ? str((produto.categoria as { nome?: string }).nome)
        : str(produto.categoria)
    const custo =
      produto.product_cost != null
        ? fmtBrl(Number(produto.product_cost))
        : produto.cmv != null
          ? fmtBrl(Number(produto.cmv))
          : produto.custo != null
            ? fmtBrl(Number(produto.custo))
            : '—'
    const preco =
      produto.preco != null
        ? fmtBrl(Number(produto.preco))
        : produto.price != null
          ? fmtBrl(Number(produto.price))
          : '—'
    const pick: Array<[string, string]> = [
      ['SKU catálogo', str(produto.sku || catalogSku)],
      ['ID anúncio', str(produto.id_anuncio || listingId)],
      ['SKU variante', str(produto.sku_variante)],
      [
        'Descrição',
        str(produto.description || produto.descricao || produto.nome || produto.titulo),
      ],
      ['Categoria', cat],
      ['NCM', str(produto.fiscal_number)],
      ['Custo / CMV', custo],
      ['Preço', preco],
      ['Estoque', str(produto.estoque ?? produto.quantidade_estoque)],
      ['Status', str(produto.status || produto.ativo)],
    ]
    return pick.filter(([, v]) => v !== '—')
  }, [inCatalog, produto, catalogSku, listingId])

  const kpis = useMemo(() => {
    const items: Array<{ label: string; value: string }> = []
    if (nav.quantidade != null) items.push({ label: 'Qtd (período)', value: String(nav.quantidade) })
    if (nav.receita != null) items.push({ label: 'Receita (período)', value: fmtBrl(nav.receita) })
    if (inCatalog && produto?.product_cost != null) {
      items.push({ label: 'CMV unit.', value: fmtBrl(Number(produto.product_cost)) })
    } else if (inCatalog && produto?.cmv != null) {
      items.push({ label: 'CMV unit.', value: fmtBrl(Number(produto.cmv)) })
    } else if (inCatalog && produto?.preco != null) {
      items.push({ label: 'Preço catálogo', value: fmtBrl(Number(produto.preco)) })
    }
    return items
  }, [nav, inCatalog, produto])

  return (
    <DomainPageShell
      title={titulo}
      subtitle={
        listingId && catalogSku && listingId !== catalogSku
          ? `Anúncio ${listingId} → SKU ${catalogSku}`
          : `SKU · ${catalogSku || sku || '—'}`
      }
      loading={loading}
      error={error}
      onRetry={load}
      stats={kpis.length ? kpis : undefined}
    >
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
        <Button component={RouterLink} to="/" size="small" variant="outlined">
          ← Home
        </Button>
        <Button
          component="a"
          href={`${S2_APP_URL}/produtos`}
          target="_blank"
          rel="noreferrer"
          size="small"
          variant="outlined"
        >
          Abrir no Financial
        </Button>
      </Stack>

      {!loading && !inCatalog ? (
        <Alert severity="info" variant="outlined">
          Este identificador veio do Top produtos (anúncio / marketplace) e não foi possível
          resolver SKU de catálogo nem CMV. Os números do período abaixo vêm da Home.
        </Alert>
      ) : null}

      {!loading && inCatalog && resolvedFrom === 'id_anuncio' ? (
        <Chip
          size="small"
          color="info"
          label={
            produto?.product_cost != null || produto?.cmv != null
              ? 'Resolvido: anúncio → SKU + CMV'
              : 'Resolvido: anúncio → SKU (S1)'
          }
          sx={{ alignSelf: 'flex-start' }}
        />
      ) : null}

      {!loading && inCatalog && resolvedFrom === 'catalog' ? (
        <Chip size="small" color="success" label="No catálogo S2" sx={{ alignSelf: 'flex-start' }} />
      ) : null}

      {!loading && inCatalog && resolvedFrom === 'cmvs' ? (
        <Chip size="small" color="success" label="CMV encontrado" sx={{ alignSelf: 'flex-start' }} />
      ) : null}

      {!loading && inCatalog && !resolvedFrom ? (
        <Chip size="small" color="success" label="Produto" sx={{ alignSelf: 'flex-start' }} />
      ) : null}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {inCatalog ? 'Ficha do produto' : 'Resumo do período'}
          </Typography>
          <Table size="small">
            <TableBody>
              {!inCatalog ? (
                <>
                  <TableRow>
                    <TableCell width="40%">Identificador</TableCell>
                    <TableCell>{sku}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Descrição (vendas)</TableCell>
                    <TableCell>{nav.descricao || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Quantidade</TableCell>
                    <TableCell>{nav.quantidade ?? '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Receita</TableCell>
                    <TableCell>{nav.receita != null ? fmtBrl(nav.receita) : '—'}</TableCell>
                  </TableRow>
                </>
              ) : (
                rows.map(([label, value]) => (
                  <TableRow key={label}>
                    <TableCell width="40%">{label}</TableCell>
                    <TableCell>{value}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DomainPageShell>
  )
}
