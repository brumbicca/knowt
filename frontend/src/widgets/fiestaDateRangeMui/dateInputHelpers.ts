import { format, parse } from 'date-fns'

export function formatarDataInput(data: Date | null): string {
  if (!data) return ''
  return format(data, 'dd/MM/yyyy')
}

export function aplicarMascaraData(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '')
  const numerosLimitados = apenasNumeros.substring(0, 8)
  if (numerosLimitados.length <= 2) return numerosLimitados
  if (numerosLimitados.length <= 4) {
    return `${numerosLimitados.substring(0, 2)}/${numerosLimitados.substring(2)}`
  }
  return `${numerosLimitados.substring(0, 2)}/${numerosLimitados.substring(2, 4)}/${numerosLimitados.substring(4)}`
}

export function parsearDataInput(dataStr: string): Date | null {
  if (!dataStr || dataStr.length !== 10) return null
  try {
    const data = parse(dataStr, 'dd/MM/yyyy', new Date())
    if (isNaN(data.getTime())) return null
    return data
  } catch {
    return null
  }
}

/** Parse ISO `yyyy-MM-dd` as local date (sem deslocar fuso). */
export function parseIsoLocal(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (isNaN(date.getTime())) return null
  return date
}
