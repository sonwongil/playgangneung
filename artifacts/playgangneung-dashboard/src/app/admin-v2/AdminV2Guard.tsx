import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import AdminV2Router from "./AdminV2Router";

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

export default function AdminV2Guard() {
  const { isLoading, isAdmin } = useAdminAuth();
  if (isLoading) return <PageLoader />;
  if (!isAdmin) return null;
  return <AdminV2Router />;
}
