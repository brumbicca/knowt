import { Navigate, Route, Routes } from 'react-router-dom'
import { BiLayout } from './layout/BiLayout'
import { VendasPage } from './pages/VendasPage'
import { MargensPage } from './pages/MargensPage'
import { FiscalPage } from './pages/FiscalPage'
import { FretesPage } from './pages/FretesPage'
import { DespesasPage } from './pages/DespesasPage'
import { ClientesPage } from './pages/ClientesPage'
import { PedidosPage } from './pages/PedidosPage'
import { PagamentosPage } from './pages/PagamentosPage'
import { ProdutoPage } from './pages/ProdutoPage'
import { ProdutosPage } from './pages/ProdutosPage'
import { OperacoesPage } from './pages/OperacoesPage'
import { AgendaPage } from './pages/AgendaPage'
import { InsightsHomePage } from './pages/InsightsHomePage'
import { InsightsAlertasPage } from './pages/InsightsAlertasPage'
import { InsightsPrioridadesPage } from './pages/InsightsPrioridadesPage'
import { InsightsComercialPage } from './pages/InsightsComercialPage'
import { InsightsProdutosPage } from './pages/InsightsProdutosPage'
import { InsightsLogisticaPage } from './pages/InsightsLogisticaPage'
import { InsightsFinanceiroPage } from './pages/InsightsFinanceiroPage'
import { SourceScopeGuard } from './components/SourceScopeGuard'
import { BiDataProvider } from './state/BiDataContext'
import { BiSourceProvider } from './state/BiSourceContext'

export default function App() {
  return (
    <BiSourceProvider>
      <BiDataProvider>
        <Routes>
          <Route element={<BiLayout />}>
            <Route index element={<Navigate to="/insights" replace />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route element={<SourceScopeGuard />}>
              <Route path="vendas" element={<VendasPage />} />
              <Route path="pedidos" element={<PedidosPage />} />
              <Route path="pagamentos" element={<PagamentosPage />} />
              <Route path="produtos" element={<ProdutosPage />} />
              <Route path="produtos/:sku" element={<ProdutoPage />} />
              <Route path="margens" element={<MargensPage />} />
              <Route path="fiscal" element={<FiscalPage />} />
              <Route path="fretes" element={<FretesPage />} />
              <Route path="despesas" element={<DespesasPage />} />
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="operacoes" element={<OperacoesPage />} />
              <Route path="insights" element={<InsightsHomePage />} />
              <Route path="insights/alertas" element={<InsightsAlertasPage />} />
              <Route path="insights/prioridades" element={<InsightsPrioridadesPage />} />
              <Route path="insights/comercial" element={<InsightsComercialPage />} />
              <Route path="insights/produtos" element={<InsightsProdutosPage />} />
              <Route path="insights/logistica" element={<InsightsLogisticaPage />} />
              <Route path="insights/financeiro" element={<InsightsFinanceiroPage />} />
            </Route>
            <Route path="insights/mix" element={<Navigate to="/insights/produtos" replace />} />
            <Route path="*" element={<Navigate to="/insights" replace />} />
          </Route>
        </Routes>
      </BiDataProvider>
    </BiSourceProvider>
  )
}
