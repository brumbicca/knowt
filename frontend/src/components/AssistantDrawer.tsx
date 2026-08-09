import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Link,
  Stack,
  TextField,
  Typography,
  Button,
  Chip,
} from '@mui/material'
import {
  fmtBrl,
  sendAssistantChat,
  transcribeAssistantAudio,
  type InsightDominio,
  type Periodo,
  PERIODO_OPTIONS,
} from '../api/bridge'
import { useBiData } from '../state/BiDataContext'
import { useBiSource } from '../state/BiSourceContext'
import { notifyPanelsAfterRicaReply } from '../utils/biRefresh'

type Props = {
  onClose: () => void
  initialPrompt?: string | null
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
}

type Suggestion = { short: string; ask: string }

const PAGE_DOMAINS: Array<{
  path: string
  dominio: InsightDominio
  label: string
}> = [
  { path: '/insights/comercial', dominio: 'comercial', label: 'comercial' },
  { path: '/insights/produtos', dominio: 'mix', label: 'mix e SKUs' },
  { path: '/insights/logistica', dominio: 'logistica', label: 'logística' },
  { path: '/insights/financeiro', dominio: 'financeiro', label: 'financeiro' },
  { path: '/insights/alertas', dominio: 'operacoes', label: 'operações' },
  { path: '/insights/prioridades', dominio: 'home', label: 'prioridades' },
  { path: '/insights', dominio: 'home', label: 'negócio' },
  { path: '/pedidos', dominio: 'comercial', label: 'pedidos' },
  { path: '/vendas', dominio: 'comercial', label: 'vendas' },
  { path: '/produtos', dominio: 'mix', label: 'mix e SKUs' },
  { path: '/fretes', dominio: 'logistica', label: 'logística' },
  { path: '/pagamentos', dominio: 'financeiro', label: 'financeiro' },
  { path: '/despesas', dominio: 'despesas', label: 'despesas' },
  { path: '/margens', dominio: 'financeiro', label: 'margens' },
  { path: '/fiscal', dominio: 'fiscal', label: 'fiscal' },
  { path: '/operacoes', dominio: 'operacoes', label: 'operações' },
  { path: '/clientes', dominio: 'clientes', label: 'clientes' },
  { path: '/insights/agenda', dominio: 'agenda', label: 'agenda' },
  { path: '/', dominio: 'home', label: 'negócio' },
]

function pageDomain(pathname: string) {
  return PAGE_DOMAINS.find(
    ({ path }) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)),
  )
}

function periodAskPhrase(
  periodo: Periodo,
  customRange: { inicio: string; fim: string } | null,
  rangeLabel?: string,
): string {
  if (customRange?.inicio && customRange?.fim) {
    return rangeLabel || `de ${customRange.inicio} a ${customRange.fim}`
  }
  const map: Record<Periodo, string> = {
    hoje: 'hoje',
    semana: 'esta semana',
    mes: 'este mês',
    '7d': 'nos últimos 7 dias',
    '30d': 'nos últimos 30 dias',
  }
  return map[periodo] || 'neste período'
}

function periodChipLabel(
  periodo: Periodo,
  customRange: { inicio: string; fim: string } | null,
  rangeLabel?: string,
): string {
  if (customRange?.inicio && customRange?.fim) {
    return rangeLabel || `${customRange.inicio} → ${customRange.fim}`
  }
  return PERIODO_OPTIONS.find((o) => o.id === periodo)?.label || periodo
}

/** Extrai datas ISO do rangeLabel do overview (`2026-07-13 → 2026-07-18`). */
function datesFromRangeLabel(label?: string): { inicio?: string; fim?: string } {
  if (!label) return {}
  const m = label.match(/(\d{4}-\d{2}-\d{2})\s*[→\-–]\s*(\d{4}-\d{2}-\d{2})/)
  if (!m) return {}
  return { inicio: m[1], fim: m[2] }
}

function buildSuggestions(pathname: string, periodPhrase: string): Suggestion[] {
  const p = periodPhrase
  const currentDomain = pageDomain(pathname)
  const insightSuggestion: Suggestion | null = currentDomain
    ? {
        short: 'Insight da IA',
        ask: `Qual é o insight da IA para ${currentDomain.label} ${p}? Diga o que devo priorizar e por quê.`,
      }
    : null
  const byPath: Record<string, Suggestion[]> = {
    '/despesas': [
      { short: 'Despesas', ask: `Quanto gastei ${p} em despesas?` },
      { short: 'Por categoria', ask: `Despesas ${p} por categoria` },
    ],
    '/fretes': [
      { short: 'Frete total', ask: `Qual o frete líquido ${p}? Usa pedidos/métricas.` },
      { short: 'Maiores riscos', ask: `Quais pedidos ou canais têm maior risco de frete ${p}?` },
    ],
    '/fiscal': [
      { short: 'NFs', ask: `Quantas notas fiscais ${p}?` },
      { short: 'Sem NF', ask: `Quantos pedidos sem NF ${p} e por canal?` },
    ],
    '/margens': [
      { short: 'Margem total', ask: `Qual a margem CMV ${p}?` },
      { short: 'Cobertura', ask: `Qual a cobertura NF da margem ${p}?` },
    ],
    '/pedidos': [
      { short: 'Líquido', ask: `Qual o líquido a receber ${p}?` },
      { short: 'Pedidos', ask: `Quantos pedidos válidos ${p}?` },
    ],
    '/pagamentos': [
      { short: 'Taxas e líquido', ask: `Analisa taxas e líquido ${p}` },
      { short: 'Como melhorar', ask: `Como melhorar o resultado financeiro ${p}?` },
    ],
    '/clientes': [{ short: 'Clientes', ask: 'Quantos clientes temos e por estado?' }],
    '/produtos': [
      { short: 'Mix vendido', ask: `Quantos produtos diferentes venderam ${p}?` },
      { short: 'Curva ABC', ask: `Quais SKUs concentram a receita ${p}?` },
    ],
    '/operacoes': [
      { short: 'Sync', ask: 'A sync está a correr? Qual o estado?' },
      { short: 'Sem NF', ask: 'Alertas de pedidos sem NF' },
    ],
    '/insights': [
      { short: 'Pedidos', ask: `Quantos pedidos ${p}?` },
      { short: 'Discovery', ask: 'O que já conhecemos do Tiny?' },
      { short: 'Resumo', ask: `Resumo de pedidos ${p}` },
    ],
    '/vendas': [
      { short: 'Vendas', ask: `Quanto vendemos ${p}?` },
      { short: 'Por canal', ask: `Vendas ${p} por canal` },
      { short: 'Discovery', ask: 'O que já conhecemos do Tiny?' },
    ],
  }
  const domain = Object.keys(byPath).find((k) => pathname === k || pathname.startsWith(`${k}/`))
  const base = domain
    ? byPath[domain]
    : [
    { short: 'Vendas', ask: `Quanto vendemos ${p}?` },
    { short: 'Discovery', ask: 'O que já conhecemos do Tiny?' },
    { short: 'Áudio → tarefa', ask: 'Cria uma tarefa: revisar cobertura fiscal' },
    { short: 'Áudio → agenda', ask: 'Agenda call amanhã às quinze horas' },
  ]
  return insightSuggestion ? [insightSuggestion, ...base].slice(0, 4) : base
}

const STORAGE_KEY = 'knowt-bi-chat-v1'
const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'system',
  text: 'knowt por aqui. Vejo o filtro e a página onde estás. No microfone, fala curto: «cria uma tarefa: …» ou «agenda … amanhã às 15h». Se perguntares «hoje» e o painel estiver na semana, explico os dois.',
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadPersisted(): { messages: ChatMessage[]; sessionId: string | null } {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem('fiesta-bi-hermes-chat-v1')
    if (!raw) return { messages: [WELCOME], sessionId: null }
    const data = JSON.parse(raw) as { messages?: ChatMessage[]; sessionId?: string | null }
    let msgs = Array.isArray(data.messages) && data.messages.length ? data.messages : [WELCOME]
    msgs = msgs.map((m) =>
      m.id === 'welcome' ||
      (m.role === 'system' && /(Hermes|Rica) por aqui/.test(m.text))
        ? WELCOME
        : m,
    )
    return { messages: msgs.slice(-80), sessionId: data.sessionId || null }
  } catch {
    return { messages: [WELCOME], sessionId: null }
  }
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  return candidates.find((m) => MediaRecorder.isTypeSupported(m))
}

/** Renderiza texto com links markdown e URLs longas quebráveis. */
function MessageBody({ text, muted }: { text: string; muted?: boolean }) {
  const parts: Array<{ type: 'text' | 'link'; value: string; href?: string }> = []
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) })
    if (m[1] && m[2]) {
      parts.push({ type: 'link', value: m[1], href: m[2] })
    } else if (m[3]) {
      const href = m[3]
      const label = href.length > 48 ? `${href.slice(0, 40)}…` : href
      parts.push({ type: 'link', value: label, href })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })

  return (
    <Typography
      variant={muted ? 'caption' : 'body2'}
      color={muted ? 'text.secondary' : 'inherit'}
      component="div"
      sx={{
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        maxWidth: '100%',
      }}
    >
      {parts.map((p, i) =>
        p.type === 'link' && p.href ? (
          <Link
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}
          >
            {p.value}
          </Link>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </Typography>
  )
}

/** Chat knowt — mesmo cérebro do Telegram (via Agent Gateway). */
export function AssistantDrawer({ onClose, initialPrompt }: Props) {
  const { pathname } = useLocation()
  const { data, periodo, customRange, marketplace, marketplaceOptions } = useBiData()
  const { activeSource, activeSourceId, isFiestaActive } = useBiSource()
  const canalLabel =
    marketplaceOptions.find((o) => o.id === marketplace)?.label || 'Todos os canais'
  const askPhrase = useMemo(
    () => periodAskPhrase(periodo, customRange, data?.rangeLabel),
    [periodo, customRange, data?.rangeLabel],
  )
  const chipPeriodo = useMemo(
    () => periodChipLabel(periodo, customRange, data?.rangeLabel),
    [periodo, customRange, data?.rangeLabel],
  )
  const suggestions = useMemo(
    () => buildSuggestions(pathname, askPhrase),
    [pathname, askPhrase],
  )
  const insightDomain = useMemo(() => pageDomain(pathname)?.dominio, [pathname])
  const persisted = useRef(loadPersisted())
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(persisted.current.sessionId)
  const [messages, setMessages] = useState<ChatMessage[]>(persisted.current.messages)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const voiceBusy = busy || recording || transcribing
  const micSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy, recording, transcribing])

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ messages: messages.slice(-80), sessionId }),
      )
    } catch {
      /* quota / private mode */
    }
  }, [messages, sessionId])

  useEffect(() => {
    if (initialPrompt) setInput(initialPrompt)
  }, [initialPrompt])

  useEffect(() => {
    return () => {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
      } catch {
        /* ignore */
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function clearChat() {
    setMessages([WELCOME])
    setSessionId(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  async function ask(text: string) {
    const message = text.trim()
    if (!message || busy) return

    setInput('')
    setMessages((prev) => [...prev, { id: uid(), role: 'user', text: message }])
    setBusy(true)
    try {
      const isCustom = Boolean(customRange?.inicio && customRange?.fim)
      const fromLabel = datesFromRangeLabel(data?.rangeLabel)
      const dataInicio = isCustom ? customRange!.inicio : fromLabel.inicio
      const dataFim = isCustom ? customRange!.fim : fromLabel.fim
      const dateFields =
        dataInicio && dataFim ? { data_inicio: dataInicio, data_fim: dataFim } : {}
      const sourceFields = {
        source_id: activeSourceId || 'tinyerp',
        source_name: activeSource?.name || (isFiestaActive ? 'Fiesta' : activeSourceId),
        source_db_name: activeSource?.db_name || (isFiestaActive ? 'ecommerce_financial' : undefined),
      }
      // Fonte com espelho live: injectar KPIs do painel (mesmo padrão Fiesta).
      // Fonte sem carga: só meta da fonte (sem inventar zeros do Fiesta).
      const sourceLive =
        isFiestaActive ||
        (Boolean(activeSource?.db_name) &&
          /^bi_/i.test(String(activeSource?.db_name)) &&
          Number(activeSource?.pedidos_count || 0) > 0)
      const context = sourceLive && data
        ? {
            page: pathname,
            insight_dominio: insightDomain,
            periodo: isCustom ? 'custom' : periodo,
            ...dateFields,
            ...sourceFields,
            marketplace: marketplace || null,
            marketplace_label: canalLabel,
            range_label: data.rangeLabel,
            vendas_fmt: data.vendasFmt,
            liquido_fmt: data.liquidoFmt,
            taxas_fmt: data.taxasFmt,
            frete_fmt: data.freteFmt,
            // Se CMV inconsistente, não injectar números crus (evita knowt ≠ KPI «Rever CMV»)
            margem_fmt: data.cmvInconsistente ? 'Inconsistente / Rever CMV' : data.margemFmt,
            cmv_fmt: data.cmvInconsistente
              ? `Inconsistente (${data.cmvFmt} >> vendas)`
              : data.cmvFmt,
            cmv_inconsistente: !!data.cmvInconsistente,
            cobertura_pct: data.coberturaPct,
            total_margens: data.totalMargens,
            pedidos: data.pedidos,
            canais: (data.canais || []).map((c) => ({
              name: c.name,
              value: c.value,
              vendas_fmt: fmtBrl(c.value),
            })),
          }
        : {
            page: pathname,
            insight_dominio: insightDomain,
            periodo: isCustom ? 'custom' : periodo,
            ...dateFields,
            ...sourceFields,
            marketplace: marketplace || null,
            marketplace_label: canalLabel,
          }
      const res = await sendAssistantChat(message, sessionId, context)
      if (res.session_id) setSessionId(res.session_id)
      if (res.ok && res.reply) {
        setMessages((prev) => [...prev, { id: uid(), role: 'assistant', text: res.reply! }])
        notifyPanelsAfterRicaReply(message)
        window.setTimeout(() => notifyPanelsAfterRicaReply(message), 1500)
      } else {
        const err =
          res.message ||
          res.error ||
          'Não consegui obter resposta da knowt. Tente de novo em instantes.'
        setMessages((prev) => [...prev, { id: uid(), role: 'system', text: err }])
      }
    } catch (e) {
      const err =
        e instanceof Error && e.name === 'AbortError'
          ? 'Tempo esgotado — a knowt ainda pode estar a processar. Tente uma pergunta mais curta.'
          : e instanceof Error
            ? e.message
            : 'Falha de rede ao falar com a knowt.'
      setMessages((prev) => [...prev, { id: uid(), role: 'system', text: err }])
    } finally {
      setBusy(false)
    }
  }

  async function handleAudioBlob(blob: Blob, mime: string) {
    setTranscribing(true)
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'system', text: 'A transcrever áudio…' },
    ])
    try {
      const res = await transcribeAssistantAudio(blob, mime)
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'system' && last.text.startsWith('A transcrever')) next.pop()
        return next
      })
      if (!res.ok || !res.transcript?.trim()) {
        const err = res.message || res.error || 'Não consegui transcrever o áudio.'
        setMessages((prev) => [...prev, { id: uid(), role: 'system', text: err }])
        return
      }
      await ask(res.transcript.trim())
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'system' && last.text.startsWith('A transcrever')) next.pop()
        return next
      })
      const err =
        e instanceof Error && e.name === 'AbortError'
          ? 'Tempo esgotado na transcrição.'
          : e instanceof Error
            ? e.message
            : 'Falha ao enviar áudio.'
      setMessages((prev) => [...prev, { id: uid(), role: 'system', text: err }])
    } finally {
      setTranscribing(false)
    }
  }

  async function toggleRecording() {
    if (voiceBusy && !recording) return
    if (recording) {
      try {
        mediaRecorderRef.current?.stop()
      } catch {
        /* ignore */
      }
      // Mantém recording=true até onstop (evita segunda gravação a meio do stop)
      return
    }
    if (!micSupported) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'system',
          text: 'Este navegador não permite gravação de áudio. Usa Chrome/Edge ou o Telegram.',
        },
      ])
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mime = pickRecorderMime()
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      recorder.onstop = () => {
        setRecording(false)
        const usedMime = recorder.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: usedMime })
        chunksRef.current = []
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
        mediaRecorderRef.current = null
        if (blob.size < 800) {
          setMessages((prev) => [
            ...prev,
            { id: uid(), role: 'system', text: 'Áudio demasiado curto — tenta de novo.' },
          ])
          return
        }
        void handleAudioBlob(blob, usedMime)
      }
      recorder.start()
      setRecording(true)
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'system',
          text: 'Não consegui aceder ao microfone. Permite o acesso no navegador e tenta outra vez.',
        },
      ])
    }
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        pb: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <Stack spacing={1} sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box sx={{ minWidth: 0, pr: 1 }}>
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif' }}>
              knowt
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              Mesmos números do painel · texto ou áudio
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
            <Button size="small" onClick={clearChat} disabled={voiceBusy} sx={{ minWidth: 0, px: 1 }}>
              Limpar
            </Button>
            <IconButton onClick={onClose} aria-label="fechar" size="small">
              ×
            </IconButton>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`painel: ${chipPeriodo}`} color="primary" variant="outlined" />
          {marketplace ? (
            <Chip size="small" label={canalLabel} color="secondary" variant="outlined" />
          ) : null}
          {sessionId ? (
            <Chip
              size="small"
              label="sessão"
              variant="outlined"
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            />
          ) : null}
        </Stack>
      </Stack>
      <Divider />

      <Box
        sx={{
          flex: 1,
          p: 2,
          overflowY: 'auto',
          overflowX: 'hidden',
          bgcolor: 'background.default',
          minWidth: 0,
        }}
      >
        <Stack spacing={1.25} sx={{ minWidth: 0 }}>
          {messages.map((m) => (
            <Box
              key={m.id}
              sx={{
                alignSelf:
                  m.role === 'user' ? 'flex-end' : m.role === 'assistant' ? 'flex-start' : 'stretch',
                maxWidth: m.role === 'system' ? '100%' : '92%',
                width: m.role === 'system' ? '100%' : 'auto',
                minWidth: 0,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                bgcolor:
                  m.role === 'user'
                    ? 'primary.main'
                    : m.role === 'assistant'
                      ? 'background.paper'
                      : 'rgba(15, 23, 42, 0.03)',
                color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
                border: m.role === 'assistant' || m.role === 'system' ? '1px solid' : 'none',
                borderColor: 'divider',
                boxShadow: m.role === 'assistant' ? '0 1px 4px rgba(15, 23, 42, 0.04)' : 'none',
                overflow: 'hidden',
              }}
            >
              <MessageBody text={m.text} muted={m.role === 'system'} />
            </Box>
          ))}
          {busy || transcribing ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.5 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                {transcribing ? 'A transcrever áudio…' : 'knowt a consultar os dados…'}
              </Typography>
            </Stack>
          ) : null}
          {recording ? (
            <Typography variant="caption" color="error.main" sx={{ px: 0.5 }}>
              A gravar… toca outra vez no microfone para enviar.
            </Typography>
          ) : null}
          <div ref={bottomRef} />
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {suggestions.map((s) => (
            <Chip
              key={s.ask}
              size="small"
              label={s.short}
              variant="outlined"
              disabled={voiceBusy}
              onClick={() => ask(s.ask)}
            />
          ))}
        </Stack>
      </Box>

      <Divider />
      <Stack spacing={1} sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
        <TextField
          size="small"
          fullWidth
          multiline
          maxRows={4}
          placeholder="Pergunte à knowt… ou usa o microfone"
          value={input}
          disabled={voiceBusy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(input)
            }
          }}
        />
        <Stack direction="row" spacing={1}>
          <Button
            variant={recording ? 'contained' : 'outlined'}
            color={recording ? 'error' : 'primary'}
            disabled={(voiceBusy && !recording) || !micSupported}
            onClick={() => void toggleRecording()}
            sx={{ minWidth: { xs: 88, sm: 112 }, flexShrink: 0 }}
          >
            {recording ? 'Parar' : 'Áudio'}
          </Button>
          <Button
            variant="contained"
            fullWidth
            disabled={voiceBusy || !input.trim()}
            onClick={() => void ask(input)}
          >
            {busy ? 'A pensar…' : 'Enviar'}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
          Demo áudio: «cria uma tarefa: …» ou «agenda … amanhã às 15h» · Chrome + microfone
        </Typography>
      </Stack>
    </Box>
  )
}
