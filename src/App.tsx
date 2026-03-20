import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/DashboardLayout";
import ComponentSpecs from "@/pages/ComponentSpecs";
import SpokeGenerator from "@/pages/SpokeGenerator";
import HubSynthesizer from "@/pages/HubSynthesizer";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<ComponentSpecs />} />
            <Route path="/spoke-generator" element={<SpokeGenerator />} />
            <Route path="/hub-synthesizer" element={<HubSynthesizer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
