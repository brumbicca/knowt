import { useCallback, useEffect, useState } from 'react'
import { ClickAwayListener, Paper, Popper, TextField } from '@mui/material'
import { format, getYear, startOfMonth } from 'date-fns'
import { DateRangeCalendarPanel } from '../widgets/fiestaDateRangeMui/DateRangeCalendarPanel'
import { formatarDataInput, parseIsoLocal } from '../widgets/fiestaDateRangeMui/dateInputHelpers'

export type BiDateRangeValue = { inicio: string; fim: string } | null

type BiDateRangeFieldProps = {
  value: BiDateRangeValue
  onApply: (range: { inicio: string; fim: string }) => void
  onClear: () => void
  disabled?: boolean
  sx?: object
}

/**
 * Uma só entrada no filtro; abre o calendário personalizado S1/S2 (intervalo no popover).
 */
export function BiDateRangeField({ value, onApply, onClear, disabled, sx }: BiDateRangeFieldProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const open = Boolean(anchorEl)

  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [dataInicioInput, setDataInicioInput] = useState('')
  const [dataFimInput, setDataFimInput] = useState('')
  const [mesCalendario, setMesCalendario] = useState<Date>(() => startOfMonth(new Date()))
  const [seletorAberto, setSeletorAberto] = useState(false)
  const [anoSelecionado, setAnoSelecionado] = useState(() => getYear(new Date()))

  const seedFromValue = useCallback(() => {
    const ini = parseIsoLocal(value?.inicio)
    const fim = parseIsoLocal(value?.fim)
    setDataInicio(ini)
    setDataFim(fim)
    setDataInicioInput(formatarDataInput(ini))
    setDataFimInput(formatarDataInput(fim))
    const base = ini ?? new Date()
    setMesCalendario(startOfMonth(base))
    setAnoSelecionado(getYear(base))
    setSeletorAberto(false)
  }, [value])

  const fechar = useCallback(() => {
    setAnchorEl(null)
    setSeletorAberto(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, fechar])

  const abrir = (el: HTMLElement) => {
    seedFromValue()
    setAnchorEl(el)
  }

  const aplicar = () => {
    if (dataInicio && dataFim) {
      onApply({
        inicio: format(dataInicio, 'yyyy-MM-dd'),
        fim: format(dataFim, 'yyyy-MM-dd'),
      })
      fechar()
      return
    }
    onClear()
    fechar()
  }

  const limpar = () => {
    setDataInicio(null)
    setDataFim(null)
    setDataInicioInput('')
    setDataFimInput('')
  }

  const display =
    value?.inicio && value?.fim
      ? `${formatarDataInput(parseIsoLocal(value.inicio))} – ${formatarDataInput(parseIsoLocal(value.fim))}`
      : ''

  return (
    <>
      <TextField
        size="small"
        label="Período personalizado"
        placeholder="Data personalizada"
        value={display}
        onClick={(e) => {
          if (!disabled) abrir(e.currentTarget)
        }}
        disabled={disabled}
        slotProps={{
          input: { readOnly: true },
          inputLabel: { shrink: true },
        }}
        sx={{
          minWidth: 260,
          width: 260,
          cursor: disabled ? 'default' : 'pointer',
          '& .MuiInputBase-input': { cursor: disabled ? 'default' : 'pointer' },
          ...sx,
        }}
      />
      {open && anchorEl ? (
        <Popper
          open
          anchorEl={anchorEl}
          placement="bottom-start"
          style={{ zIndex: 1400 }}
          modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
        >
          <ClickAwayListener onClickAway={fechar}>
            <Paper
              sx={{
                p: 2,
                maxWidth: 350,
                boxShadow: 3,
                backgroundColor: 'background.paper',
              }}
            >
              <DateRangeCalendarPanel
                dataInicio={dataInicio}
                dataFim={dataFim}
                onSetDataInicio={setDataInicio}
                onSetDataFim={setDataFim}
                dataInicioInput={dataInicioInput}
                dataFimInput={dataFimInput}
                onSetDataInicioInput={setDataInicioInput}
                onSetDataFimInput={setDataFimInput}
                mesCalendario={mesCalendario}
                onSetMesCalendario={setMesCalendario}
                seletorAberto={seletorAberto}
                onSetSeletorAberto={setSeletorAberto}
                anoSelecionado={anoSelecionado}
                onSetAnoSelecionado={setAnoSelecionado}
                onFechar={fechar}
                onLimpar={limpar}
                onAplicar={aplicar}
              />
            </Paper>
          </ClickAwayListener>
        </Popper>
      ) : null}
    </>
  )
}
