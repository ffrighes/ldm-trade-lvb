import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import ProjectsPage from "@/pages/ProjectsPage";
import BomTreePage from "@/pages/BomTreePage";
import BaseDadosPage from "@/pages/BaseDadosPage";
import OrcamentosPage from "@/pages/OrcamentosPage";
import OrcamentoDetailPage from "@/pages/OrcamentoDetailPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import CalculosPage from "@/pages/CalculosPage";
import PerdaCargaPage from "@/pages/PerdaCargaPage";
import IsolamentoTermicoPage from "@/pages/IsolamentoTermicoPage";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import UpdatePasswordPage from "@/pages/UpdatePasswordPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
            <Route path="/atualizar-senha" element={<UpdatePasswordPage />} />

            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/projetos" element={<ProjectsPage />} />
                      <Route path="/projetos/:projetoId" element={<Navigate to="boms" replace />} />
                      <Route path="/projetos/:projetoId/boms" element={<BomTreePage />} />
                      <Route path="/projetos/:projetoId/calculos" element={<CalculosPage />} />
                      <Route path="/projetos/:projetoId/calculos/perda-carga/novo" element={<PerdaCargaPage />} />
                      <Route path="/projetos/:projetoId/calculos/perda-carga/:calculoId" element={<PerdaCargaPage />} />
                      <Route path="/projetos/:projetoId/calculos/isolamento-termico" element={<IsolamentoTermicoPage />} />
                      <Route path="/base-dados" element={<BaseDadosPage />} />
                      <Route path="/orcamentos" element={<OrcamentosPage />} />
                      <Route path="/orcamentos/:orcamentoId" element={<OrcamentoDetailPage />} />
                      <Route path="/admin/usuarios" element={<AdminUsersPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
