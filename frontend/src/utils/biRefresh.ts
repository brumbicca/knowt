/** Sinais leves entre chat Rica IA e cards Agenda/Tarefas (sem Context extra). */

export const BI_AGENDA_REFRESH = 'fiesta-bi:agenda-refresh'
export const BI_TASKS_REFRESH = 'fiesta-bi:tasks-refresh'

export function notifyAgendaRefresh() {
  window.dispatchEvent(new Event(BI_AGENDA_REFRESH))
}

export function notifyTasksRefresh() {
  window.dispatchEvent(new Event(BI_TASKS_REFRESH))
}

/** Após resposta OK da Rica IA: refresca cards afectados pelo pedido. */
export function notifyPanelsAfterRicaReply(userMessage: string) {
  const m = (userMessage || '').toLowerCase()
  const agenda =
    /agenda|calend[aá]rio|compromisso|reuni[aã]o|marcar|agend|lembrete|call com/.test(m) ||
    (/\b\d{1,2}\/\d{1,2}\b/.test(m) && /às|as\s+\d{1,2}h|\d{1,2}:\d{2}/.test(m))
  const tasks = /tarefa|todo|to-do|conclui|marcar.*feita|feita a tarefa/.test(m)
  if (agenda) notifyAgendaRefresh()
  if (tasks) notifyTasksRefresh()
  if (!agenda && !tasks && /rica|hermes|google calendar/.test(m)) {
    notifyAgendaRefresh()
  }
}
