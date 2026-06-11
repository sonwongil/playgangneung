import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";

const Admin               = lazy(() => import("@/pages/admin"));
const AdminEventDetail    = lazy(() => import("@/pages/admin-event-detail"));
const AdSubmit            = lazy(() => import("@/pages/ad-submit"));
const Login               = lazy(() => import("@/pages/login"));
const AdReport            = lazy(() => import("@/pages/ad-report"));
const MyAd                = lazy(() => import("@/pages/my-ad"));
const Checkout            = lazy(() => import("@/pages/checkout"));
const CheckoutSuccess     = lazy(() => import("@/pages/checkout-success"));
const CheckoutBankSuccess = lazy(() => import("@/pages/checkout-bank-success"));
const CheckoutFail        = lazy(() => import("@/pages/checkout-fail"));
const Privacy             = lazy(() => import("@/pages/privacy"));
const DataDeletion        = lazy(() => import("@/pages/data-deletion"));
const Terms               = lazy(() => import("@/pages/terms"));
const Viewer              = lazy(() => import("@/pages/viewer"));
const NotFound            = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient();

// ── 전역 fetch interceptor ────────────────────────────────────────────────
// 쿠키가 차단되는 iframe/크로스-오리진 환경에서 Bearer 토큰을 자동 첨부
if (typeof window !== "undefined") {
  const _origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const token = localStorage.getItem("pg_admin_token");
    if (token && url.includes("/api/")) {
      const headers = new Headers(init?.headers);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return _origFetch(input, { ...init, headers });
    }
    return _origFetch(input, init);
  };
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
      <span className="w-5 h-5 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin mr-2" />
      로딩 중...
    </div>
  );
}

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
  if (isLoading) return <PageLoader />;
  if (!isAdmin) return null;
  return <Admin />;
}

function AdminEventDetailGuard() {
  const { isLoading, isAdmin } = useAdminAuth();
  if (isLoading) return <PageLoader />;
  if (!isAdmin) return null;
  return <AdminEventDetail />;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/admin/events/:id" component={AdminEventDetailGuard} />
        <Route path="/admin" component={AdminGuard} />
        <Route path="/login" component={Login} />
        <Route path="/sign-in/*?" component={Login} />
        <Route path="/sign-up/*?" component={Login} />
        <Route path="/ad-submit" component={AdSubmit} />
        <Route path="/report/:token" component={AdReport} />
        <Route path="/my-ad" component={MyAd} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/checkout/bank-success" component={CheckoutBankSuccess} />
        <Route path="/checkout/fail" component={CheckoutFail} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/data-deletion" component={DataDeletion} />
        <Route path="/terms" component={Terms} />
        <Route path="/viewer" component={Viewer} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <WouterRouter base={BASE}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
