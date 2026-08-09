import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import {
  addMonths,
  differenceInDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  getDay,
  getMonth,
  getYear,
  isBefore,
  isSameDay,
  isWithinInterval,
  setMonth,
  setYear,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Hicon } from '../../components/Hicon'
import { aplicarMascaraData, formatarDataInput, parsearDataInput } from './dateInputHelpers'

const MESES_NOME = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

export type DateRangeCalendarPanelProps = {
  dataInicio: Date | null
  dataFim: Date | null
  onSetDataInicio: (d: Date | null) => void
  onSetDataFim: (d: Date | null) => void
  dataInicioInput: string
  dataFimInput: string
  onSetDataInicioInput: (s: string) => void
  onSetDataFimInput: (s: string) => void
  mesCalendario: Date
  onSetMesCalendario: (d: Date) => void
  seletorAberto: boolean
  onSetSeletorAberto: (v: boolean) => void
  anoSelecionado: number
  onSetAnoSelecionado: (n: number) => void
  onFechar: () => void
  onLimpar: () => void
  onAplicar: () => void
}

/**
 * Corpo do calendário intervalo (mesmo painel S1/S2).
 */
export function DateRangeCalendarPanel({
  dataInicio,
  dataFim,
  onSetDataInicio,
  onSetDataFim,
  dataInicioInput,
  dataFimInput,
  onSetDataInicioInput,
  onSetDataFimInput,
  mesCalendario,
  onSetMesCalendario,
  seletorAberto,
  onSetSeletorAberto,
  anoSelecionado,
  onSetAnoSelecionado,
  onFechar,
  onLimpar,
  onAplicar,
}: DateRangeCalendarPanelProps) {
  const inicioMes = startOfMonth(mesCalendario)
  const fimMes = endOfMonth(mesCalendario)
  const diasMes = eachDayOfInterval({ start: inicioMes, end: fimMes })
  const primeiroDiaSemana = getDay(inicioMes)
  const diasVazios = Array(primeiroDiaSemana).fill(null)

  const prevMonth = () => {
    const novo = subMonths(mesCalendario, 1)
    onSetMesCalendario(novo)
    onSetAnoSelecionado(getYear(novo))
  }
  const nextMonth = () => {
    const novo = addMonths(mesCalendario, 1)
    onSetMesCalendario(novo)
    onSetAnoSelecionado(getYear(novo))
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={1}>
        <TextField
          label="Data Início"
          size="small"
          value={dataInicioInput || formatarDataInput(dataInicio)}
          onChange={(e) => {
            const m = aplicarMascaraData(e.target.value)
            onSetDataInicioInput(m)
            const d = parsearDataInput(m)
            if (d) onSetDataInicio(d)
            else if (m === '') onSetDataInicio(null)
          }}
          onBlur={() => {
            if (dataInicioInput && dataInicioInput.length < 10) onSetDataInicioInput('')
          }}
          placeholder="DD/MM/AAAA"
          sx={{ width: 140 }}
          slotProps={{ htmlInput: { maxLength: 10 } }}
        />
        <TextField
          label="Data Fim"
          size="small"
          value={dataFimInput || formatarDataInput(dataFim)}
          onChange={(e) => {
            const m = aplicarMascaraData(e.target.value)
            onSetDataFimInput(m)
            const d = parsearDataInput(m)
            if (d) onSetDataFim(d)
            else if (m === '') onSetDataFim(null)
          }}
          onBlur={() => {
            if (dataFimInput && dataFimInput.length < 10) onSetDataFimInput('')
          }}
          placeholder="DD/MM/AAAA"
          sx={{ width: 140 }}
          slotProps={{ htmlInput: { maxLength: 10 } }}
        />
        {dataInicio && dataFim ? (
          <Box
            sx={{
              ml: 'auto',
              backgroundColor: '#C3DBF3',
              padding: '4px 12px',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, color: 'text.secondary', textAlign: 'center', lineHeight: 1.2 }}
            >
              {differenceInDays(dataFim, dataInicio) + 1}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, color: 'text.secondary', textAlign: 'center', lineHeight: 1.2 }}
            >
              {differenceInDays(dataFim, dataInicio) + 1 === 1 ? 'dia' : 'dias'}
            </Typography>
          </Box>
        ) : null}
      </Box>

      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
        position="relative"
      >
        <IconButton size="small" onClick={prevMonth} aria-label="Mês anterior">
          <Hicon name="chevron-left" sx={{ fontSize: '1.25rem' }} />
        </IconButton>
        <Button
          variant="text"
          onClick={() => {
            if (seletorAberto) {
              onSetSeletorAberto(false)
            } else {
              onSetAnoSelecionado(getYear(mesCalendario))
              onSetSeletorAberto(true)
            }
          }}
          sx={{
            textTransform: 'capitalize',
            color: 'text.primary',
            fontWeight: 500,
            fontSize: '1.25rem',
            '&:hover': { backgroundColor: 'transparent' },
          }}
          endIcon={<Hicon name="chevron-down" sx={{ opacity: 0.7 }} aria-hidden />}
        >
          {format(mesCalendario, 'MMMM yyyy', { locale: ptBR })}
        </Button>
        <IconButton size="small" onClick={nextMonth} aria-label="Próximo mês">
          <Hicon name="chevron-right" sx={{ fontSize: '1.25rem' }} />
        </IconButton>

        {seletorAberto ? (
          <Box
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              mt: 1,
              p: 2,
              backgroundColor: 'background.paper',
              borderRadius: 1,
              boxShadow: 3,
              zIndex: 1301,
            }}
          >
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <IconButton
                size="small"
                onClick={() => onSetAnoSelecionado(anoSelecionado - 1)}
                aria-label="Ano anterior"
              >
                <Hicon name="chevron-left" sx={{ fontSize: '1.25rem' }} />
              </IconButton>
              <Button
                variant="text"
                sx={{
                  textTransform: 'none',
                  color: 'text.primary',
                  fontWeight: 500,
                  fontSize: '1rem',
                  '&:hover': { backgroundColor: 'transparent' },
                }}
              >
                {anoSelecionado}
              </Button>
              <IconButton
                size="small"
                onClick={() => onSetAnoSelecionado(anoSelecionado + 1)}
                aria-label="Próximo ano"
              >
                <Hicon name="chevron-right" sx={{ fontSize: '1.25rem' }} />
              </IconButton>
            </Box>
            <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={1}>
              {MESES_NOME.map((mes, index) => {
                const mesAtual = getMonth(mesCalendario)
                const anoAtual = getYear(mesCalendario)
                const isSel = index === mesAtual && anoSelecionado === anoAtual
                return (
                  <Button
                    key={mes}
                    variant={isSel ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => {
                      const novoMes = setMonth(setYear(new Date(), anoSelecionado), index)
                      onSetMesCalendario(novoMes)
                      onSetSeletorAberto(false)
                    }}
                    sx={{
                      textTransform: 'capitalize',
                      minWidth: 'auto',
                      py: 1,
                      ...(isSel && {
                        backgroundColor: '#1565C0',
                        '&:hover': { backgroundColor: '#1565C0' },
                      }),
                    }}
                  >
                    {mes.substring(0, 3)}
                  </Button>
                )
              })}
            </Box>
          </Box>
        ) : null}
      </Box>

      <Box>
        <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={0.5} mb={1}>
          {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((dia) => (
            <Typography key={dia} variant="caption" align="center" sx={{ fontWeight: 'bold', py: 1 }}>
              {dia}
            </Typography>
          ))}
        </Box>
        <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={0.5}>
          {diasVazios.map((_, index) => (
            <Box key={`empty-${index}`} />
          ))}
          {diasMes.map((dia) => {
            const isInicio = dataInicio && isSameDay(dia, dataInicio)
            const isFim = dataFim && isSameDay(dia, dataFim)
            const isNoRange =
              dataInicio &&
              dataFim &&
              isWithinInterval(dia, {
                start: startOfDay(dataInicio),
                end: endOfDay(dataFim),
              }) &&
              !isInicio &&
              !isFim
            const isSel = isInicio || isFim
            return (
              <Button
                key={dia.toISOString()}
                onClick={() => {
                  if (!dataInicio || (dataInicio && dataFim)) {
                    onSetDataInicio(dia)
                    onSetDataFim(null)
                  } else if (dataInicio && !dataFim) {
                    if (isBefore(dia, dataInicio)) {
                      onSetDataFim(dataInicio)
                      onSetDataInicio(dia)
                    } else {
                      onSetDataFim(dia)
                    }
                  }
                }}
                sx={{
                  minWidth: 40,
                  height: 40,
                  p: 0,
                  borderRadius: isSel ? '50%' : 0,
                  backgroundColor: isSel
                    ? 'primary.main'
                    : isNoRange
                      ? 'rgba(25, 118, 210, 0.12)'
                      : 'transparent',
                  color: isSel ? 'white' : 'text.primary',
                  fontWeight: isSel ? 'bold' : 'normal',
                  position: 'relative',
                  '&:hover': {
                    backgroundColor: isSel
                      ? 'primary.dark'
                      : isNoRange
                        ? 'rgba(25, 118, 210, 0.2)'
                        : 'action.hover',
                  },
                  '&::before': isNoRange
                    ? {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(25, 118, 210, 0.08)',
                        zIndex: -1,
                      }
                    : {},
                }}
              >
                {format(dia, 'd')}
              </Button>
            )
          })}
        </Box>
      </Box>

      <Box display="flex" justifyContent="space-between" gap={1} mt={2}>
        <Button variant="outlined" onClick={onFechar} sx={{ flex: 1 }}>
          Fechar
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          onClick={onLimpar}
          disabled={!dataInicio && !dataFim}
          sx={{ flex: 1 }}
        >
          Limpar
        </Button>
        <Button variant="contained" onClick={onAplicar} sx={{ flex: 1 }}>
          Aplicar
        </Button>
      </Box>
    </Box>
  )
}
