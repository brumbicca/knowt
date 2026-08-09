import { Navigate, Route, Routes } from 'react-router-dom'
import { BiLayout } from './layout/BiLayout'
import { AgendaPage } from './pages/AgendaPage'
import { InsightsHomePage } from './pages/InsightsHomePage'
import { InsightsAlertasPage } from './pages/InsightsAlertasPage'
import { InsightsPrioridadesPage } from './pages/InsightsPrioridadesPage'
import { InsightsComercialPage } from './pages/InsightsComercialPage'
import { InsightsProdutosPage } from './pages/InsightsProdutosPage'
import { InsightsLogisticaPage } from './pages/InsightsLogisticaPage'
import { InsightsFinanceiroPage } from './pages/InsightsFinanceiroPage'
import { BiDataProvider } from './state/BiDataContext'
import { BiSourceProvider } from './state/BiSourceContext'

/** Piloto knowt: só lane Insights (+ Agenda). Business fica de fora. */
export default function App() {
  return (
    <BiSourceProvider>
      <BiDataProvider>
        <Routes>
          <Route element={<BiLayout />}>
            <Route index element={<Navigate to="/insights" replace />} />
            <Route path="insights" element={<InsightsHomePage />} />
            <Route path="insights/agenda" element={<AgendaPage />} />
            <Route path="insights/alertas" element={<InsightsAlertasPage />} />
            <Route path="insights/prioridades" element={<InsightsPrioridadesPage />} />
            <Route path="insights/comercial" element={<InsightsComercialPage />} />
            <Route path="insights/produtos" element={<InsightsProdutosPage />} />
            <Route path="insights/logistica" element={<InsightsLogisticaPage />} />
            <Route path="insights/financeiro" element={<InsightsFinanceiroPage />} />
            <Route path="insights/mix" element={<Navigate to="/insights/produtos" replace />} />
            {/* Legado Fiesta Business → Insights */}
            <Route path="agenda" element={<Navigate to="/insights/agenda" replace />} />
            <Route path="*" element={<Navigate to="/insights" replace />} />
          </Route>
        </Routes>
      </BiDataProvider>
    </BiSourceProvider>
  )
}
