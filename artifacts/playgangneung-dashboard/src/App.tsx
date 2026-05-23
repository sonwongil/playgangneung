import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { koKR } from "@clerk/localizations";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import AdminEventDetail from "@/pages/admin-event-detail";
import AdSubmit from "@/pages/ad-submit";
import Login from "@/pages/login";
import AdReport from "@/pages/ad-report";
import MyAd from "@/pages/my-ad";
import Checkout from "@/pages/checkout";
import CheckoutSuccess from "@/pages/checkout-success";
import CheckoutFail from "@/pages/checkout-fail";
import Privacy from "@/pages/privacy";

const queryClient = new QueryClient();

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return BASE && path.startsWith(BASE) ? path.slice(BASE.length) || "/" : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: BASE || "/",
    logoImageUrl: `${window.location.origin}${BASE}/logo2.png`,
  },
  variables: {
    colorPrimary: "#ea580c",
    colorForeground: "#111827",
    colorMutedForeground: "#6b7280",
    colorDanger: "#ef4444",
    colorBackground: "#ffffff",
    colorInput: "#f9fafb",
    colorInputForeground: "#111827",
    colorNeutral: "#e5e7eb",
    fontFamily: "'Noto Sans KR', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gray-900 font-bold",
    headerSubtitle: "text-gray-500",
    socialButtonsBlockButtonText: "text-gray-700 font-medium",
    formFieldLabel: "text-gray-700 font-medium",
    footerActionLink: "text-orange-600 font-semibold hover:text-orange-700",
    footerActionText: "text-gray-500",
    dividerText: "text-gray-400",
    identityPreviewEditButton: "text-orange-600",
    formFieldSuccessText: "text-green-600",
    alertText: "text-red-600",
    logoBox: "flex justify-center py-2",
    logoImage: "h-10 object-contain",
    socialButtonsBlockButton: "border border-gray-200 hover:bg-gray-50",
    formButtonPrimary: "bg-orange-600 hover:bg-orange-700 text-white font-semibold",
    formFieldInput: "border-gray-200 bg-gray-50 text-gray-900",
    footerAction: "bg-gray-50",
    dividerLine: "bg-gray-200",
    alert: "border-red-100 bg-red-50",
    otpCodeFieldInput: "border-gray-200",
    formFieldRow: "",
    main: "",
    "formFieldInput__password": "[&::placeholder]:opacity-0",
    "formFieldInput__confirmPassword": "[&::placeholder]:opacity-0",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4 py-8">
      <div className="flex flex-col lg:flex-row items-start justify-center gap-8 w-full max-w-4xl">
        <SignIn routing="path" path={`${BASE}/sign-in`} signUpUrl={`${BASE}/sign-up`} />
        <SignUp routing="virtual" signInUrl={`${BASE}/sign-in`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4 py-8">
      <SignUp routing="path" path={`${BASE}/sign-up`} signInUrl={`${BASE}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
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
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        확인 중...
      </div>
    );
  if (!isAdmin) return null;
  return <Admin />;
}

function AdminEventDetailGuard() {
  const { isLoading, isAdmin } = useAdminAuth();
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        확인 중...
      </div>
    );
  if (!isAdmin) return null;
  return <AdminEventDetail />;
}

function AdSubmitGuard() {
  return (
    <>
      <Show when="signed-in">
        <AdSubmit />
      </Show>
      <Show when="signed-out">
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <div className="text-center space-y-4 max-w-sm">
            <div className="text-5xl mb-2">🔒</div>
            <p className="text-lg font-bold text-gray-800">로그인이 필요합니다</p>
            <p className="text-sm text-gray-500">
              광고 접수는 PLAY강릉 회원만 가능합니다.
              <br />
              회원가입은 구글 계정으로 간편하게 할 수 있어요.
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <a
                href={`${BASE}/sign-in`}
                className="px-5 py-2.5 rounded-full bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 transition-colors"
              >
                로그인
              </a>
              <a
                href={`${BASE}/sign-up`}
                className="px-5 py-2.5 rounded-full border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition-colors"
              >
                회원가입
              </a>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin/events/:id" component={AdminEventDetailGuard} />
      <Route path="/admin" component={AdminGuard} />
      <Route path="/login" component={Login} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/ad-submit" component={AdSubmitGuard} />
      <Route path="/report/:token" component={AdReport} />
      <Route path="/my-ad" component={MyAd} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/checkout/fail" component={CheckoutFail} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/privacy" component={Privacy} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${BASE}/sign-in`}
      signUpUrl={`${BASE}/sign-up`}
      localization={{
        ...koKR,
        signIn: {
          ...koKR.signIn,
          start: {
            ...koKR.signIn?.start,
            title: "PLAY강릉 로그인",
            subtitle: "계정에 로그인하세요",
          },
        },
        signUp: {
          ...koKR.signUp,
          start: {
            ...koKR.signUp?.start,
            title: "PLAY강릉 회원가입",
            subtitle: "강릉의 소식을 가장 빠르게 만나보세요",
            actionText: "계정이 없으신가요?",
            actionLink: "회원가입",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={BASE}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
