import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import { deleteFonte, updateFonte, type BiSource } from '../api/bridge'
import { useBiSource } from '../state/BiSourceContext'
import { Hicon } from './Hicon'
import { OnboardingWizard } from './OnboardingWizard'

const LOGO_MAX_BYTES = 280_000
const LOGO_MAX_EDGE = 320
/** Dimensões reais do card de fonte (pré-visualização = mesmo tamanho). */
const SOURCE_CARD_W = 180
const SOURCE_CARD_H = 72

/** «Bello Festa» → bellofesta */
function suggestSlug(name: string): string {
  const base = (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
  return base.slice(0, 48) || 'fonte'
}

/** Slug explícito: permite underscore. */
function normalizeSlugInput(slug: string): string {
  const base = (slug || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return base.slice(0, 48) || 'fonte'
}

function slugPreview(name: string, slug?: string) {
  const s = (slug || '').trim() ? normalizeSlugInput(slug!) : suggestSlug(name)
  return s.startsWith('bi_') ? s : `bi_${s}`
}

/** Redimensiona imagem para data URL PNG/JPEG leve (fundo do card). */
function fileToLogoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Escolhe um ficheiro de imagem (PNG, JPG, SVG, WebP)'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler a imagem'))
    reader.onload = () => {
      const raw = String(reader.result || '')
      if (file.type === 'image/svg+xml') {
        if (raw.length > LOGO_MAX_BYTES) {
          reject(new Error('SVG demasiado grande (máx. ~280 KB)'))
          return
        }
        resolve(raw)
        return
      }
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, LOGO_MAX_EDGE / Math.max(img.width, img.height, 1))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas indisponível'))
          return
        }
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        let dataUrl = canvas.toDataURL('image/png')
        if (dataUrl.length > LOGO_MAX_BYTES) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.82)
        }
        if (dataUrl.length > LOGO_MAX_BYTES) {
          reject(new Error('Imagem ainda grande demais após compressão'))
          return
        }
        resolve(dataUrl)
      }
      img.onerror = () => reject(new Error('Imagem inválida'))
      img.src = raw
    }
    reader.readAsDataURL(file)
  })
}

function isSvgLogo(src: string): boolean {
  const s = (src || '').trim()
  return /\.svg(\?|#|$)/i.test(s) || s.startsWith('data:image/svg+xml')
}

/**
 * Fundo do card: SVG → uma só cor do tema (mask);
 * PNG/JPG → imagem original com transparência.
 */
function CardLogoBackdrop({ src }: { src: string }) {
  const theme = useTheme()
  const tint = theme.palette.primary.light

  if (isSvgLogo(src)) {
    const mask = `url(${JSON.stringify(src)})`
    return (
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          boxSizing: 'border-box',
          /* margem acima/abaixo/lados — área útil do logo */
          p: '10px',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            opacity: 0.38,
            backgroundColor: tint,
            WebkitMaskImage: mask,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskImage: mask,
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            maskSize: 'contain',
          }}
        />
      </Box>
    )
  }

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        boxSizing: 'border-box',
        p: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: 0.34,
      }}
    >
      <Box
        component="img"
        src={src}
        alt=""
        sx={{
          display: 'block',
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          userSelect: 'none',
        }}
      />
    </Box>
  )
}

/** Face visual idêntica (card real + pré-visualização do modal). */
function SourceCardFace({
  name,
  subtitle,
  logoUrl,
  active,
  accent,
  canDelete,
  onEdit,
  onDelete,
  interactive,
  onSelect,
}: {
  name: string
  subtitle?: string
  logoUrl?: string | null
  active?: boolean
  accent?: 'fiesta' | 'external'
  canDelete?: boolean
  onEdit?: () => void
  onDelete?: () => void
  interactive?: boolean
  onSelect?: () => void
}) {
  const logo = (logoUrl || '').trim()

  return (
    <Box
      onClick={interactive ? onSelect : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect?.()
              }
            }
          : undefined
      }
      sx={{
        position: 'relative',
        boxSizing: 'border-box',
        width: SOURCE_CARD_W,
        height: SOURCE_CARD_H,
        flexShrink: 0,
        overflow: 'hidden',
        border: '2px solid',
        borderColor: active
          ? 'primary.main'
          : accent === 'fiesta'
            ? 'rgba(15, 118, 110, 0.35)'
            : 'divider',
        borderRadius: '12px',
        bgcolor: active
          ? 'rgba(15, 118, 110, 0.08)'
          : accent === 'fiesta'
            ? 'rgba(15, 118, 110, 0.04)'
            : 'background.paper',
        px: 1.5,
        py: 1,
        textAlign: 'left',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background-color 0.15s',
        ...(interactive
          ? {
              '&:hover': {
                borderColor: 'primary.main',
              },
            }
          : {}),
      }}
    >
      {logo ? <CardLogoBackdrop src={logo} /> : null}
      {interactive && onEdit && onDelete ? (
        <CardIconActions onEdit={onEdit} onDelete={onDelete} canDelete={canDelete} />
      ) : (
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            zIndex: 2,
            width: 28,
            height: 28 + 4 + 28,
            pointerEvents: 'none',
            opacity: 0.35,
          }}
          aria-hidden
        />
      )}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          pr: 4.5,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minWidth: 0,
        }}
      >
        <Typography
          variant="body2"
          fontWeight={700}
          noWrap
          title={name}
          sx={{
            fontFamily: '"Outfit", sans-serif',
            lineHeight: 1.25,
            textShadow: logo ? '0 1px 2px rgba(0,0,0,0.55)' : undefined,
          }}
        >
          {name}
        </Typography>
        {subtitle ? (
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            title={subtitle}
            sx={{
              display: 'block',
              mt: 0.35,
              lineHeight: 1.3,
              textShadow: logo ? '0 1px 2px rgba(0,0,0,0.45)' : undefined,
            }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Box>
    </Box>
  )
}

function LogoField({
  value,
  onChange,
  disabled,
  previewName,
  previewRole,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  previewName?: string
  previewRole?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const onPick = async (file: File | null) => {
    if (!file) return
    setLocalErr(null)
    setBusy(true)
    try {
      const dataUrl = await fileToLogoDataUrl(file)
      onChange(dataUrl)
    } catch (e: unknown) {
      setLocalErr(e instanceof Error ? e.message : 'Erro ao carregar logo')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Stack spacing={1.25}>
      <TextField
        label="Logo (URL opcional)"
        placeholder="https://… ou carrega um ficheiro"
        value={value.startsWith('data:') ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        disabled={disabled || busy}
        helperText={
          value.startsWith('data:image/svg') || /\.svg/i.test(value)
            ? 'SVG: no card usa a cor do tema (harmonioso)'
            : value.startsWith('data:')
              ? 'Logo carregado do ficheiro (data URL)'
              : 'URL ou ficheiro — SVG recomendado (cor do tema no card)'
        }
      />
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <Button
          variant="outlined"
          size="small"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'A processar…' : 'Carregar ficheiro'}
        </Button>
        {value ? (
          <Button
            size="small"
            color="inherit"
            disabled={disabled || busy}
            onClick={() => onChange('')}
          >
            Remover logo
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          hidden
          onChange={(e) => void onPick(e.target.files?.[0] || null)}
        />
      </Stack>
      {value ? (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            Pré-visualização (idêntica ao card)
          </Typography>
          <SourceCardFace
            name={previewName?.trim() || 'Nome'}
            subtitle={previewRole?.trim() || 'Descrição'}
            logoUrl={value}
            accent="external"
          />
        </Box>
      ) : null}
      {localErr ? (
        <Typography variant="body2" color="error">
          {localErr}
        </Typography>
      ) : null}
    </Stack>
  )
}

function CardIconActions({
  onEdit,
  onDelete,
  canDelete,
}: {
  onEdit: () => void
  onDelete: () => void
  canDelete?: boolean
}) {
  const iconSize = canDelete ? 24 : 28
  /* button nativo: evita fundo default do MuiIconButton */
  const baseBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: iconSize,
    height: iconSize,
    flexShrink: 0,
    m: 0,
    p: 0,
    border: '2px solid',
    borderRadius: '8px',
    /* branco suave — distinto da borda do card e menos gritante que #fff */
    borderColor: 'rgba(255, 255, 255, 0.62)',
    color: 'rgba(255, 255, 255, 0.62)',
    backgroundColor: 'transparent',
    background: 'none',
    boxShadow: 'none',
    cursor: 'pointer',
    lineHeight: 0,
    boxSizing: 'border-box' as const,
    WebkitAppearance: 'none' as const,
    appearance: 'none' as const,
    pointerEvents: 'auto' as const,
    '&:focus': { outline: 'none' },
    '&:focus-visible': {
      outline: '2px solid',
      outlineColor: 'primary.light',
      outlineOffset: 1,
    },
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 2,
        width: 40,
        height: SOURCE_CARD_H,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        /* iguais: acima | entre | abaixo */
        justifyContent: canDelete ? 'space-evenly' : 'flex-start',
        pt: canDelete ? 0 : '6px',
        pr: '6px',
        pointerEvents: 'none',
      }}
    >
      <Tooltip title="Editar" placement="left">
        <Box
          component="button"
          type="button"
          aria-label="Editar fonte"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          sx={{
            ...baseBtn,
            '&:hover': {
              borderColor: 'primary.main',
              color: 'primary.main',
              backgroundColor: 'transparent',
              background: 'none',
            },
          }}
        >
          <Hicon name="pencil" sx={{ fontSize: canDelete ? '0.75rem' : '0.85rem' }} />
        </Box>
      </Tooltip>
      {canDelete ? (
        <Tooltip title="Excluir" placement="left">
          <Box
            component="button"
            type="button"
            aria-label="Excluir fonte"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            sx={{
              ...baseBtn,
              '&:hover': {
                borderColor: 'error.main',
                color: 'error.main',
                backgroundColor: 'transparent',
                background: 'none',
              },
            }}
          >
            <Hicon name="trash" sx={{ fontSize: '0.75rem' }} />
          </Box>
        </Tooltip>
      ) : null}
    </Box>
  )
}

function SourceCard({
  source,
  active,
  onSelect,
  onEdit,
  onDelete,
  canDelete,
  accent,
}: {
  source: BiSource
  active?: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  canDelete?: boolean
  accent?: 'fiesta' | 'external'
}) {
  return (
    <SourceCardFace
      name={source.name}
      subtitle={source.role || source.db_name}
      logoUrl={source.logo_url}
      active={active}
      accent={accent}
      canDelete={canDelete}
      onEdit={onEdit}
      onDelete={onDelete}
      interactive
      onSelect={onSelect}
    />
  )
}

function AddSourceDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return <OnboardingWizard open={open} onClose={onClose} />
}

function EditSourceDialog({
  source,
  open,
  onClose,
  onSaved,
}: {
  source: BiSource | null
  open: boolean
  onClose: () => void
  onSaved: (fonte: BiSource) => void
}) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [slug, setSlug] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isBuiltin = !!source?.builtin || source?.id === 'fiesta'
  const dbAtual = source?.db_name || ''
  const dbNovo = slug.trim() ? slugPreview(slug, slug) : dbAtual
  const dbMuda = !isBuiltin && !!dbNovo && dbNovo !== dbAtual

  useEffect(() => {
    if (!open || !source) return
    setName(source.name || '')
    setRole(source.role || '')
    setSlug(source.db_name?.replace(/^bi_/, '') || source.id || '')
    setLogoUrl(source.logo_url || '')
    setErr(null)
  }, [open, source])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const handleSave = async () => {
    if (!source) return
    setErr(null)
    setSaving(true)
    try {
      const res = await updateFonte(source.id, {
        name: name.trim(),
        role: role.trim(),
        logo_url: logoUrl.trim(),
        ...(dbMuda ? { slug: slug.trim() } : {}),
      })
      if (!res.ok || !res.fonte) {
        throw new Error(res.error || 'Não foi possível actualizar a fonte')
      }
      onSaved(res.fonte)
      handleClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao editar fonte')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif' }}>Editar fonte</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {isBuiltin ? (
            <Typography variant="body2" color="text.secondary">
              Fonte sistema — podes personalizar o nome, a descrição e o logo exibidos no BI.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Banco actual: <code>{dbAtual}</code>
            </Typography>
          )}
          <TextField
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label="Descrição"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            fullWidth
            placeholder="Ex.: ERP · espelho ecommerce_financial"
          />
          {isBuiltin ? null : (
            <TextField
              label="Slug (banco)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              fullWidth
              helperText={
                dbMuda
                  ? `Banco passa a ${dbNovo} — os dados actuais são movidos para lá`
                  : `Banco: ${dbNovo}`
              }
            />
          )}
          <LogoField
            value={logoUrl}
            onChange={setLogoUrl}
            disabled={saving}
            previewName={name}
            previewRole={role}
          />
          {err ? (
            <Typography variant="body2" color="error">
              {err}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={saving || name.trim().length < 2}>
          {saving ? 'A gravar…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DeleteSourceDialog({
  source,
  open,
  onClose,
  onDeleted,
}: {
  source: BiSource | null
  open: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  const { activeSourceId, setActiveSourceId } = useBiSource()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleClose = () => {
    if (saving) return
    setErr(null)
    onClose()
  }

  const handleDelete = async () => {
    if (!source) return
    setErr(null)
    setSaving(true)
    try {
      const res = await deleteFonte(source.id)
      if (!res.ok) {
        throw new Error(res.error || 'Não foi possível excluir a fonte')
      }
      if (activeSourceId === source.id) {
        setActiveSourceId('fiesta')
      }
      onDeleted()
      handleClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao excluir fonte')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontFamily: '"Outfit", sans-serif' }}>Excluir fonte</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2">
            Remover <strong>{source?.name}</strong> da lista de fontes?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            O registo desaparece do BI; o banco Mongo <code>{source?.db_name}</code> não é apagado.
          </Typography>
          {err ? (
            <Typography variant="body2" color="error">
              {err}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancelar
        </Button>
        <Button color="error" variant="contained" onClick={() => void handleDelete()} disabled={saving}>
          {saving ? 'A excluir…' : 'Excluir'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Barra Fiesta | fontes registadas | + Adicionar */
export function SourceCardsBar() {
  const {
    sources,
    activeSourceId,
    setActiveSourceId,
    loading,
    isFiestaActive,
    refreshSources,
    replaceSource,
  } = useBiSource()
  const [addOpen, setAddOpen] = useState(false)
  const [editSource, setEditSource] = useState<BiSource | null>(null)
  const [deleteSource, setDeleteSource] = useState<BiSource | null>(null)

  const renderCard = (s: BiSource, accent: 'fiesta' | 'external') => {
    const isBuiltin = s.builtin || s.id === 'fiesta'
    return (
      <Box key={s.id}>
        <SourceCard
          source={s}
          active={activeSourceId === s.id}
          accent={accent}
          canDelete={!isBuiltin}
          onSelect={() => setActiveSourceId(s.id)}
          onEdit={() => setEditSource(s)}
          onDelete={() => setDeleteSource(s)}
        />
      </Box>
    )
  }

  return (
    <>
      <Box
        sx={{
          width: '100%',
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 1.5, sm: 2 },
          pt: 1,
          pb: 0.5,
          boxSizing: 'border-box',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} letterSpacing={0.04}>
            FONTE DE DADOS
          </Typography>
          {loading ? <CircularProgress size={14} /> : null}
          {!isFiestaActive && activeSourceId ? (
            <Chip size="small" label="Consulta externa" color="info" variant="outlined" />
          ) : null}
        </Stack>
        <Stack
          direction="row"
          spacing={1.25}
          useFlexGap
          flexWrap="wrap"
          alignItems="stretch"
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap" alignItems="stretch">
            {sources.map((s) =>
              renderCard(s, s.builtin || s.id === 'fiesta' ? 'fiesta' : 'external'),
            )}
            <Tooltip title="Registar nova origem (ERP, CRM…) — cria bi_&lt;slug&gt; no Mongo">
              <Button
                variant="outlined"
                onClick={() => setAddOpen(true)}
                sx={{
                  width: 52,
                  height: 72,
                  minWidth: 52,
                  borderRadius: '12px',
                  borderStyle: 'dashed',
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  px: 0,
                }}
              >
                +
              </Button>
            </Tooltip>
          </Stack>

          {/* Lane Business omitida no piloto knowt — só Insights (+ Agenda). */}
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label="Insights"
            sx={{
              height: 36,
              px: 1,
              fontWeight: 700,
              fontFamily: '"Outfit", sans-serif',
              alignSelf: 'center',
              borderRadius: '10px',
            }}
          />
        </Stack>
      </Box>
      <AddSourceDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <EditSourceDialog
        source={editSource}
        open={!!editSource}
        onClose={() => setEditSource(null)}
        onSaved={(fonte) => {
          const anterior = editSource?.id
          replaceSource(fonte)
          if (anterior && anterior !== fonte.id && activeSourceId === anterior) {
            setActiveSourceId(fonte.id)
          }
          refreshSources()
        }}
      />
      <DeleteSourceDialog
        source={deleteSource}
        open={!!deleteSource}
        onClose={() => setDeleteSource(null)}
        onDeleted={refreshSources}
      />
    </>
  )
}
