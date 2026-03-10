import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import ProjectsPage from "@/pages/ProjectsPage";
import SolicitacoesPage from "@/pages/SolicitacoesPage";
import SolicitacaoFormPage from "@/pages/SolicitacaoFormPage";
import BaseDadosPage from "@/pages/BaseDadosPage";
import InventarioPage from "@/pages/InventarioPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/projetos" element={<ProjectsPage />} />
            <Route path="/solicitacoes" element={<SolicitacoesPage />} />
            <Route path="/solicitacoes/:id" element={<SolicitacaoFormPage />} />
            <Route path="/base-dados" element={<BaseDadosPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
