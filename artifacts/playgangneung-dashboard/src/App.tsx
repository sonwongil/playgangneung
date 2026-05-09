import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import AdminEventDetail from "@/pages/admin-event-detail";
import AdSubmit from "@/pages/ad-submit";
import Login from "@/pages/login";

const queryClient = new QueryClient();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useAdminAuth() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
      if (!res.ok) return { isAdmin: false };
      return res.json() as Promise<{ isAdmin: boolean }>;
    },
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!isLoading && !data?.isAdmin) navigate("/login");
  }, [isLoading, data, navigate]);

  return { isLoading, isAdmin: data?.isAdmin ?? false };
}

function AdminGuard() {
  const { isLoading, isAdmin } = useAdminAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">확인 중...</div>;
  if (!isAdmin) return null;
  return <Admin />;
}

function AdminEventDetailGuard() {
  const { isLoading, isAdmin } = useAdminAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">확인 중...</div>;
  if (!isAdmin) return null;
  return <AdminEventDetail />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin/events/:id" component={AdminEventDetailGuard} />
      <Route path="/admin" component={AdminGuard} />
      <Route path="/login" component={Login} />
      <Route path="/ad-submit" component={AdSubmit} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
