import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import ProjectsPage from "@/pages/ProjectsPage";
import SolicitacoesPage from "@/pages/SolicitacoesPage";
import SolicitacaoFormPage from "@/pages/SolicitacaoFormPage";
import BaseDadosPage from "@/pages/BaseDadosPage";
import UsuariosPage from "@/pages/UsuariosPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Carregando...</div>;
  if (!user) return <LoginPage />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projetos" element={<ProjectsPage />} />
        <Route path="/solicitacoes" element={<SolicitacoesPage />} />
        <Route path="/solicitacoes/:id" element={<SolicitacaoFormPage />} />
        <Route path="/base-dados" element={<BaseDadosPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ProtectedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
