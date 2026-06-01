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
import FornecedoresPage from "@/pages/FornecedoresPage";
import OrcamentosListPage from "@/pages/OrcamentosListPage";
import OrcamentoNovoPage from "@/pages/OrcamentoNovoPage";
import OrcamentoDetalhePage from "@/pages/OrcamentoDetalhePage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import AssemblyBomPage from "@/pages/AssemblyBomPage";
import CalculosPage from "@/pages/CalculosPage";
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
                      <Route path="/base-dados" element={<BaseDadosPage />} />
                      <Route path="/fornecedores" element={<FornecedoresPage />} />
                      <Route path="/orcamentos" element={<OrcamentosListPage />} />
                      <Route path="/orcamentos/novo" element={<OrcamentoNovoPage />} />
                      <Route path="/orcamentos/:id" element={<OrcamentoDetalhePage />} />
                      <Route path="/assemblies" element={<AssemblyBomPage />} />
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
