import { parseISO } from 'date-fns'

// A agenda é operada em America/Sao_Paulo; o browser pode estar noutro fuso.
// Convertemos o instante para o "relógio de parede" de SP e devolvemos um Date
// local com essas componentes, para que format/getHours/isSameDay mostrem SP.
const SP_TZ = 'America/Sao_Paulo'

const spFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SP_TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i

export function toSaoPaulo(date: Date): Date {
  const parts: Record<string, string> = {}
  for (const p of spFormatter.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value
  }
  const hour = parts.hour === '24' ? '00' : parts.hour
  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  )
}

export function nowSP(): Date {
  return toSaoPaulo(new Date())
}

/** ISO com offset (ex. Google Calendar) → hora de SP. Sem offset já é hora local de SP. */
export function parseIsoSP(iso: string): Date | null {
  const raw = String(iso || '').trim()
  if (!raw) return null
  const d = parseISO(raw)
  if (Number.isNaN(d.getTime())) return null
  return HAS_OFFSET.test(raw) ? toSaoPaulo(d) : d
}
