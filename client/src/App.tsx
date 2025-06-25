import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import QRScanner from "@/pages/QRScanner";
import EquipmentDashboard from "@/pages/EquipmentDashboard";
import WorkTypeSelection from "@/pages/WorkTypeSelection";
import WorkProcedure from "@/pages/WorkProcedure";
import AdminPanel from "@/pages/AdminPanel";
import BottomNavigation from "@/components/BottomNavigation";
import { useState, useEffect } from "react";

function Router() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("scanner");

  // Update active tab based on current route
  useEffect(() => {
    if (location === "/") {
      setActiveTab("scanner");
    } else if (location.startsWith("/equipment/") && location.includes("/work-types")) {
      setActiveTab("work");
    } else if (location.startsWith("/equipment/")) {
      setActiveTab("dashboard");
    } else if (location === "/admin") {
      setActiveTab("admin");
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Navigation Bar */}
      <nav className="bg-primary text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center space-x-3">
            <span className="material-icons text-2xl">security</span>
            <h1 className="text-lg font-medium">스마트 안전 파트너</h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="material-icons cursor-pointer">notifications</span>
            <span className="material-icons cursor-pointer">account_circle</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-md mx-auto bg-white min-h-[calc(100vh-140px)]">
        <Switch>
          <Route path="/" component={QRScanner} />
          <Route path="/equipment/:id" component={EquipmentDashboard} />
          <Route path="/equipment/:equipmentId/work-types" component={WorkTypeSelection} />
          <Route path="/work-session/:sessionId" component={WorkProcedure} />
          <Route path="/admin" component={AdminPanel} />
        </Switch>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
