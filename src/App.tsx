import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import ProjectsPage from "@/pages/ProjectsPage";
import SolicitacoesPage from "@/pages/SolicitacoesPage";
import SolicitacaoFormPage from "@/pages/SolicitacaoFormPage";
import BaseDadosPage from "@/pages/BaseDadosPage";
import InventarioPage from "@/pages/InventarioPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
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
            <Route path="/registro" element={<RegisterPage />} />
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
                      <Route path="/solicitacoes" element={<SolicitacoesPage />} />
                      <Route path="/solicitacoes/:id" element={<SolicitacaoFormPage />} />
                      <Route path="/inventario" element={<InventarioPage />} />
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
