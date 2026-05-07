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
import SolicitacoesPage from "@/pages/SolicitacoesPage";
import SolicitacaoFormPage from "@/pages/SolicitacaoFormPage";
import LegacySolicitacaoRedirect from "@/pages/LegacySolicitacaoRedirect";
import BaseDadosPage from "@/pages/BaseDadosPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
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
                      <Route path="/projetos/:projetoId" element={<Navigate to="solicitacoes" replace />} />
                      <Route path="/projetos/:projetoId/solicitacoes" element={<SolicitacoesPage />} />
                      <Route path="/projetos/:projetoId/solicitacoes/nova" element={<SolicitacaoFormPage />} />
                      <Route path="/projetos/:projetoId/solicitacoes/:id" element={<SolicitacaoFormPage />} />
                      {/* Legacy redirects */}
                      <Route path="/solicitacoes" element={<Navigate to="/projetos" replace />} />
                      <Route path="/solicitacoes/:id" element={<LegacySolicitacaoRedirect />} />
                      <Route path="/base-dados" element={<BaseDadosPage />} />
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
