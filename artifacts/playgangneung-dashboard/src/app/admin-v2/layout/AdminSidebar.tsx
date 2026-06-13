import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Inbox,
  BookOpen,
  Star,
  Send,
  Megaphone,
  BarChart2,
  Store,
  Home,
  Settings,
  LogOut,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const menuItems = [
  {
    group: "콘텐츠",
    items: [
      { label: "대시보드",         icon: LayoutDashboard, path: "/admin/v2" },
      { label: "강릉소식 수집함",  icon: Inbox,           path: "/admin/v2/inbox" },
      { label: "강릉노트 관리",    icon: BookOpen,        path: "/admin/v2/notes" },
      { label: "오늘의 강릉소식",  icon: Star,            path: "/admin/v2/today" },
      { label: "SNS 발행",        icon: Send,            path: "/admin/v2/sns" },
    ],
  },
  {
    group: "광고",
    items: [
      { label: "광고 운영",   icon: Megaphone, path: "/admin/v2/ads" },
      { label: "광고 성과",   icon: BarChart2, path: "/admin/v2/performance" },
      { label: "업체 랜딩",   icon: Store,     path: "/admin/v2/business" },
      { label: "홈 노출 관리", icon: Home,      path: "/admin/v2/home-display" },
    ],
  },
  {
    group: "시스템",
    items: [
      { label: "설정", icon: Settings, path: "/admin/v2/settings" },
    ],
  },
];

export default function AdminSidebar() {
  const [location] = useLocation();

  function isActive(path: string) {
    if (path === "/admin/v2") return location === "/admin/v2";
    return location.startsWith(path);
  }

  function handleLogout() {
    fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" })
      .finally(() => {
        localStorage.removeItem("pg_admin_token");
        window.location.href = `${BASE}/login`;
      });
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={`${BASE}/logo.png`} alt="PLAY강릉" className="h-7 w-7 rounded object-contain" />
          <div>
            <p className="text-sm font-bold text-gray-900">PLAY강릉</p>
            <p className="text-xs text-gray-500">관리자 v2</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menuItems.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive(item.path)}>
                      <Link href={item.path} className={cn("flex items-center gap-2")}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
