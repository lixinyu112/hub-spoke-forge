import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProjectProvider } from "@/contexts/ProjectContext";
import ComponentSpecs from "@/pages/ComponentSpecs";
import SpokeGenerator from "@/pages/SpokeGenerator";
import HubSynthesizer from "@/pages/HubSynthesizer";
import ContentBrowser from "@/pages/ContentBrowser";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <ProjectProvider>
          <DashboardLayout>
            <Routes>
              <Route path="/" element={<ComponentSpecs />} />
              <Route path="/spoke-generator" element={<SpokeGenerator />} />
              <Route path="/hub-synthesizer" element={<HubSynthesizer />} />
              <Route path="/browser" element={<ContentBrowser />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DashboardLayout>
        </ProjectProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
