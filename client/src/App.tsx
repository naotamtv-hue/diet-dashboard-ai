import AppShell from "@/components/AppShell";
import ErrorBoundary from "@/components/ErrorBoundary";
import PwaInstallHint from "@/components/PwaInstallHint";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Coach from "@/pages/Coach";
import Convenience from "@/pages/Convenience";
import Dashboard from "@/pages/Dashboard";
import Goal from "@/pages/Goal";
import Meals from "@/pages/Meals";
import Mypersol from "@/pages/Mypersol";
import NotFound from "@/pages/NotFound";
import Photos from "@/pages/Photos";
import Settings from "@/pages/Settings";
import Strength from "@/pages/Strength";
import Trainer from "@/pages/Trainer";
import Weight from "@/pages/Weight";
import Workouts from "@/pages/Workouts";
import CalendarView from "@/pages/CalendarView";
import { Route, Switch } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/mypersol" component={Mypersol} />
      <Route path="/meals" component={Meals} />
      <Route path="/weight" component={Weight} />
      <Route path="/workouts" component={Workouts} />
      <Route path="/strength" component={Strength} />
      <Route path="/trainer" component={Trainer} />
      <Route path="/coach" component={Coach} />
      <Route path="/convenience" component={Convenience} />
      <Route path="/photos" component={Photos} />
      <Route path="/goal" component={Goal} />
      <Route path="/calendar" component={CalendarView} />
      <Route path="/settings" component={Settings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <PwaInstallHint />
          <AppShell>
            <Router />
          </AppShell>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
