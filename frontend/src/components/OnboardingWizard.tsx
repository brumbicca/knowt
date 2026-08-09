/**
 * Wizard §14 — onboarding de fonte (10 passos).
 * Reutiliza APIs do bridge; não altera Fiesta operacional nem o roteiro da demo.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import {
  fetchAutorizacoes,
  fetchCapabilities,
  fetchConexoes,
  fetchOrganizacoes,
  fetchProdutosOrigem,
  fetchUnidades,
  seedOrganizacoes,
} from '../api/bridge'
import { useBiSource } from '../state/BiSourceContext'

const STEPS = [
  'Empresa / unidade',
  'Produto de origem',
  'Tipo de acesso',
  'Autorização',
  'Escopo',
  'Descoberta',
  'Cobertura',
  'Validações',
  'Pendências',
  'Ativação',
]

const SCOPE_OPTIONS = [
  { id: 'sales', label: 'Vendas / sales' },
  { id: 'orders', label: 'Pedidos / orders' },
  { id: 'margins', label: 'Margens' },
  { id: 'insights', label: 'Insights' },
]

function suggestSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48)
}

type Props = { open: boolean; onClose: () => void }

export function OnboardingWizard({ open, onClose }: Props) {
  const { addSource, refreshSources } = useBiSource()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([])
  const [units, setUnits] = useState<Array<{ id: string; org_id: string; name: string }>>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string; vendor?: string }>>([])
  const [conexoes, setConexoes] = useState<
    Array<{ id: string; kind?: string; label?: string; status?: string }>
  >([])
  const [authzNote, setAuthzNote] = useState('—')
  const [capsSummary, setCapsSummary] = useState('—')

  const [orgId, setOrgId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [productId, setProductId] = useState('')
  const [accessKind, setAccessKind] = useState('api_key')
  const [scope, setScope] = useState<Record<string, boolean>>({
    sales: true,
    orders: true,
    margins: false,
    insights: true,
  })
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)

  const unitsForOrg = useMemo(
    () => units.filter((u) => !orgId || u.org_id === orgId),
    [units, orgId],
  )

  const pendencias = useMemo(() => {
    const list: string[] = []
    if (!orgId) list.push('Organização não seleccionada')
    if (!unitId) list.push('Unidade não seleccionada')
    if (!productId) list.push('Produto de origem não seleccionado')
    if (!name.trim()) list.push('Nome da fonte em falta')
    if (!Object.values(scope).some(Boolean)) list.push('Escopo vazio — escolha pelo menos um domínio')
    if (authzNote.toLowerCase().includes('sem ') || authzNote === '—')
      list.push('Autorização: correr seed de identidade se ainda não houver Gate 0')
    return list
  }, [orgId, unitId, productId, name, scope, authzNote])

  const loadMeta = useCallback(async () => {
    setErr(null)
    try {
      const [o, u, p, c] = await Promise.all([
        fetchOrganizacoes(),
        fetchUnidades(),
        fetchProdutosOrigem(),
        fetchConexoes(),
      ])
      setOrgs(o.organizacoes || [])
      setUnits(u.unidades || [])
      setProducts(p.produtos_origem || [])
      setConexoes(c.conexoes || [])
      if (!(o.organizacoes || []).length) {
        await seedOrganizacoes('bi-wizard')
        const [o2, u2, p2] = await Promise.all([
          fetchOrganizacoes(),
          fetchUnidades(),
          fetchProdutosOrigem(),
        ])
        setOrgs(o2.organizacoes || [])
        setUnits(u2.unidades || [])
        setProducts(p2.produtos_origem || [])
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Falha ao carregar metadados')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setStep(0)
    setDoneMsg(null)
    setErr(null)
    void loadMeta()
  }, [open, loadMeta])

  useEffect(() => {
    if (!open || step !== 3) return
    void (async () => {
      try {
        const res = await fetchAutorizacoes()
        const approved = (res.autorizacoes || []).filter((a) => a.status === 'approved')
        setAuthzNote(
          approved.length
            ? `${approved.length} autorização(ões) approved (Gate 0)`
            : 'Sem autorizações approved — use seed /organizacoes/seed',
        )
      } catch {
        setAuthzNote('Autorizações indisponíveis')
      }
    })()
  }, [open, step])

  useEffect(() => {
    if (!open || step !== 6) return
    void (async () => {
      try {
        const res = await fetchCapabilities('traydemo')
        const caps = res.capabilities || {}
        const avail = Object.entries(caps).filter(([, v]) => v?.status === 'available').length
        const total = Object.keys(caps).length
        setCapsSummary(
          total
            ? `Exemplo traydemo: ${avail}/${total} capabilities available`
            : 'Sem capabilities — POST /capabilities/seed após activar a fonte',
        )
      } catch {
        setCapsSummary('Capabilities indisponíveis neste momento')
      }
    })()
  }, [open, step])

  const handleClose = () => {
    if (busy) return
    setName('')
    setRole('')
    setSlug('')
    setSlugTouched(false)
    setOrgId('')
    setUnitId('')
    setProductId('')
    setDoneMsg(null)
    onClose()
  }

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  const activate = async () => {
    setBusy(true)
    setErr(null)
    try {
      const product = products.find((p) => p.id === productId)
      const unit = units.find((u) => u.id === unitId)
      const roleParts = [
        product?.name || productId,
        unit?.name || unitId,
        accessKind,
      ].filter(Boolean)
      const isTiny =
        productId === 'tiny-olist' ||
        (slug.trim() || '').toLowerCase() === 'tinyerp' ||
        name.trim().toLowerCase().includes('tiny erp')
      const created = await addSource({
        name: name.trim(),
        role: role.trim() || roleParts.join(' · ') || undefined,
        slug: isTiny ? 'tinyerp' : slug.trim() || undefined,
        origin_product_id: productId || undefined,
        actor: 'bi-wizard',
      })
      try {
        await seedOrganizacoes('bi-wizard-activate')
      } catch {
        /* seed best-effort */
      }
      await refreshSources()
      const bind = created.bind_s1
      if (isTiny && bind?.ok) {
        setDoneMsg(
          `Fonte «${name.trim()}» criada e ligada à conta Tiny ERP (S1). ` +
            `Conexão ${bind.connection_id || 'ok'}; authz ${bind.authz_status || 'ok'}. ` +
            `Carga/ETL e margem ficam passos seguintes — sem misturar Fiesta.`,
        )
      } else if (isTiny && bind && bind.ok === false) {
        setDoneMsg(
          `Fonte «${name.trim()}» criada, mas o bind S1 falhou (${bind.error || 'erro'}). ` +
            `Use POST /fontes/tinyerp/bind-s1 ou prepare_tinyerp_bi_connection.`,
        )
      } else {
        setDoneMsg(
          `Fonte «${name.trim()}» criada. Banco bi_* + registo — carga/ETL e shadow são passos externos (não misturam Fiesta).`,
        )
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro na ativação')
    } finally {
      setBusy(false)
    }
  }

  const body = (() => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Organização e unidade (DoD #1). Salesforce ≠ empresa.
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Organização</InputLabel>
              <Select
                label="Organização"
                value={orgId}
                onChange={(e) => {
                  setOrgId(e.target.value)
                  setUnitId('')
                }}
              >
                {orgs.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.name} ({o.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" disabled={!orgId}>
              <InputLabel>Unidade</InputLabel>
              <Select
                label="Unidade"
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                {unitsForOrg.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {u.name} ({u.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        )
      case 1:
        return (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Produto de origem (Salesforce, Tray, …) — não é SKU de vendas.
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Produto</InputLabel>
              <Select
                label="Produto"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {products.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                    {p.vendor ? ` · ${p.vendor}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        )
      case 2:
        return (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Tipo de acesso (secret_refs / allowlist — valores nunca no Hermes).
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Kind</InputLabel>
              <Select
                label="Kind"
                value={accessKind}
                onChange={(e) => setAccessKind(e.target.value)}
              >
                <MenuItem value="salesforce_oauth">salesforce_oauth</MenuItem>
                <MenuItem value="api_key">api_key</MenuItem>
                <MenuItem value="mongo_readonly">mongo_readonly</MenuItem>
                <MenuItem value="other">other</MenuItem>
              </Select>
            </FormControl>
            {conexoes.length ? (
              <Typography variant="caption" color="text.secondary">
                Conexões existentes: {conexoes.map((c) => c.label || c.id).join(', ')}
              </Typography>
            ) : null}
          </Stack>
        )
      case 3:
        return (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Gate 0 — autorização formal (aprovador, escopo, retenção).
            </Typography>
            <Alert severity="info">{authzNote}</Alert>
            <Button size="small" onClick={() => void seedOrganizacoes('bi-wizard').then(loadMeta)}>
              Seed identidade + authz demo
            </Button>
          </Stack>
        )
      case 4:
        return (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Escopo desejado (capabilities a pedir — publicação só com available).
            </Typography>
            <FormGroup>
              {SCOPE_OPTIONS.map((opt) => (
                <FormControlLabel
                  key={opt.id}
                  control={
                    <Checkbox
                      checked={!!scope[opt.id]}
                      onChange={(e) =>
                        setScope((s) => ({ ...s, [opt.id]: e.target.checked }))
                      }
                    />
                  }
                  label={opt.label}
                />
              ))}
            </FormGroup>
          </Stack>
        )
      case 5:
        return (
          <Alert severity="info">
            Descoberta: use <code>POST /discovery/run</code> com a fonte após a ativação. O wizard
            não corre Playwright aqui — evita misturar com a demo e com Fiesta.
          </Alert>
        )
      case 6:
        return (
          <Stack spacing={1}>
            <Typography variant="body2">{capsSummary}</Typography>
            <Typography variant="caption" color="text.secondary">
              Após ativar: <code>GET /capabilities?source_id=…</code> e catálogo filtrado.
            </Typography>
          </Stack>
        )
      case 7:
        return (
          <Alert severity="info">
            Validações: <code>POST /semantics/validate</code> (Mongo↔KPI, gates #7, relatório
            oficial #8). Status em «Saúde da fonte» no dashboard.
          </Alert>
        )
      case 8:
        return (
          <Stack spacing={1}>
            <Typography variant="subtitle2">Pendências objectivas</Typography>
            {pendencias.length === 0 ? (
              <Alert severity="success">Pronta para ativação (registo + banco).</Alert>
            ) : (
              pendencias.map((p) => (
                <Typography key={p} variant="body2" color="warning.main">
                  · {p}
                </Typography>
              ))
            )}
          </Stack>
        )
      case 9:
        return (
          <Stack spacing={2}>
            {doneMsg ? (
              <Alert severity="success">{doneMsg}</Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  Cria o registo da fonte e o banco <code>bi_&lt;slug&gt;</code>. Carga/shadow
                  ficam fora deste passo.
                </Typography>
                <TextField
                  label="Nome"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!slugTouched) setSlug(suggestSlug(e.target.value))
                  }}
                  fullWidth
                  size="small"
                  autoFocus
                />
                <TextField
                  label="Descrição / role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(e.target.value)
                  }}
                  fullWidth
                  size="small"
                  helperText={`Banco: bi_${slug || suggestSlug(name) || '…'}`}
                />
              </>
            )}
          </Stack>
        )
      default:
        return null
    }
  })()

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif' }}>
        Onboarding de fonte (§14)
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, pb: 2 }}>
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 2 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>
                  <Typography variant="caption">{label}</Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
          {err ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {err}
            </Alert>
          ) : null}
          {body}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={busy}>
          Fechar
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={back} disabled={busy || step === 0 || !!doneMsg}>
          Voltar
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="contained" onClick={next} disabled={busy}>
            Seguinte
          </Button>
        ) : doneMsg ? null : (
          <Button
            variant="contained"
            onClick={() => void activate()}
            disabled={busy || pendencias.some((p) => p.includes('Nome'))}
          >
            {busy ? 'A activar…' : 'Activar fonte'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
