import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  LayoutDashboard,
  Settings,
  RefreshCw,
  ImageOff,
  MessageSquare,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Menu,
  ExternalLink,
  ChevronRight,
  Megaphone,
  Pencil,
  LogOut,
  KeyRound,
  Copy,
  Send,
  Rss,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SocialDraft {
  title: string;
  caption: string;
  hashtags: string[];
  createdAt: string;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  startDate?: string;
  endDate?: string;
  scheduleStatus?: string;
  link: string;
  source: string;
  sourceType: string;
  location?: string;
  category?: string;
  thumbnail?: string;
  status: "draft" | "approved" | "rejected" | "published";
  socialDraft: SocialDraft | null;
  crawledAt: string;
}

interface Ad {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  category: string;
  title: string;
  description: string;
  date: string;
  location: string;
  url: string;
  imageUrl: string | null;
  plan: "basic" | "main" | "premium";
  status: "pending" | "approved" | "scheduled" | "published" | "rejected";
  createdAt: string;
}

type NavKey = "dashboard" | "feed" | "publish" | "ads" | "settings";

const NAV_ITEMS: { icon: React.ReactNode; label: string; key: NavKey }[] = [
  { icon: <LayoutDashboard className="w-4 h-4" />, label: "대시보드", key: "dashboard" },
  { icon: <Rss className="w-4 h-4" />, label: "SNS 피드 만들기", key: "feed" },
  { icon: <Send className="w-4 h-4" />, label: "SNS 발행", key: "publish" },
  { icon: <Megaphone className="w-4 h-4" />, label: "광고접수", key: "ads" },
  { icon: <Settings className="w-4 h-4" />, label: "설정", key: "settings" },
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  draft:     { label: "검토 중",   icon: <Clock className="w-3 h-3" />,       cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved:  { label: "승인",     icon: <CheckCircle className="w-3 h-3" />,  cls: "bg-green-100 text-green-700 border-green-200" },
  rejected:  { label: "반려",     icon: <XCircle className="w-3 h-3" />,      cls: "bg-red-100 text-red-700 border-red-200" },
  published: { label: "발행완료", icon: <Send className="w-3 h-3" />,         cls: "bg-blue-100 text-blue-700 border-blue-200" },
};

const AD_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "접수대기", cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved:  { label: "승인",     cls: "bg-green-100 text-green-700 border-green-200" },
  scheduled: { label: "발행예정", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  published: { label: "발행완료", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  rejected:  { label: "제외",     cls: "bg-red-100 text-red-700 border-red-200" },
};

export default function Admin() {
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editThumbnailUrl, setEditThumbnailUrl] = useState("");
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  // inline draft editing: map of eventId → { caption, hashtagsStr }
  const [draftEdits, setDraftEdits] = useState<Record<string, { caption: string; hashtagsStr: string }>>({});
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<{ events: Event[] }>({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/events`, { credentials: "include" });
      if (!r.ok) throw new Error("이벤트 로드 실패");
      return r.json();
    },
  });

  const { data: adsData, isLoading: adsLoading } = useQuery<{ ads: Ad[] }>({
    queryKey: ["admin-ads"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ads`, { credentials: "include" });
      if (!r.ok) throw new Error("광고 로드 실패");
      return r.json();
    },
    enabled: activeNav === "ads",
  });

  const events: Event[] = data?.events ?? [];
  const ads: Ad[] = adsData?.ads ?? [];

  // derived lists
  const feedEvents = events.filter((e) => e.status === "approved");
  const publishEvents = events.filter(
    (e) => e.status === "approved" && e.socialDraft,
  );

  // ── Mutations ────────────────────────────────────────────────────────────────
  const crawlMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/crawl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!r.ok) throw new Error("크롤링 실패");
      return r.json();
    },
    onSuccess: (d) => { toast({ title: "크롤링 완료", description: `${d.added ?? 0}건 추가` }); qc.invalidateQueries({ queryKey: ["admin-events"] }); },
    onError: () => toast({ title: "크롤링 실패", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`${BASE}/api/events/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error("상태 변경 실패");
      return r.json();
    },
    onSuccess: () => { toast({ title: "상태 변경 완료" }); qc.invalidateQueries({ queryKey: ["admin-events"] }); },
    onError: () => toast({ title: "상태 변경 실패", variant: "destructive" }),
  });

  const draftMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/events/${id}/draft`, { method: "POST" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "초안 생성 실패"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "SNS 초안 생성 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: "초안 생성 실패", description: e.message, variant: "destructive" }),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async ({ id, caption, hashtags }: { id: string; caption: string; hashtags: string[] }) => {
      const r = await fetch(`${BASE}/api/events/${id}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, hashtags }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "저장 실패"); }
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: "초안 저장 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      setDraftEdits((prev) => { const n = { ...prev }; delete n[d.id]; return n; });
    },
    onError: (e: Error) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/events/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("삭제 실패");
      return r.json();
    },
    onSuccess: () => { toast({ title: "삭제 완료" }); qc.invalidateQueries({ queryKey: ["admin-events"] }); },
    onError: () => toast({ title: "삭제 실패", variant: "destructive" }),
  });

  const editEventMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Event> }) => {
      const r = await fetch(`${BASE}/api/events/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(patch) });
      if (!r.ok) throw new Error("수정 실패");
      return r.json();
    },
    onSuccess: () => { toast({ title: "수정 완료" }); qc.invalidateQueries({ queryKey: ["admin-events"] }); setEditingEvent(null); },
    onError: () => toast({ title: "수정 실패", variant: "destructive" }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => { const r = await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" }); if (!r.ok) throw new Error(); return r.json(); },
    onSuccess: () => { qc.clear(); navigate("/login"); },
    onError: () => toast({ title: "로그아웃 실패", variant: "destructive" }),
  });

  const changePwMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const r = await fetch(`${BASE}/api/auth/change-password`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ currentPassword, newPassword }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "비밀번호 변경 실패");
      return d;
    },
    onSuccess: () => { toast({ title: "비밀번호 변경 완료" }); setPwForm({ current: "", next: "", confirm: "" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const adStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await fetch(`${BASE}/api/ads/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => { toast({ title: "상태 변경 완료" }); qc.invalidateQueries({ queryKey: ["admin-ads"] }); },
    onError: () => toast({ title: "상태 변경 실패", variant: "destructive" }),
  });

  const adDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/ads/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => { toast({ title: "삭제 완료" }); qc.invalidateQueries({ queryKey: ["admin-ads"] }); },
    onError: () => toast({ title: "삭제 실패", variant: "destructive" }),
  });

  const adEditMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Ad> }) => {
      const r = await fetch(`${BASE}/api/ads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error(); return r.json();
    },
    onSuccess: () => { toast({ title: "수정 완료" }); qc.invalidateQueries({ queryKey: ["admin-ads"] }); setEditingAd(null); },
    onError: () => toast({ title: "수정 실패", variant: "destructive" }),
  });

  const regenerateDraftsMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/regenerate-drafts`, { method: "POST", credentials: "include" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "실패"); return d as { total: number; regenerated: number };
    },
    onSuccess: (d) => {
      toast({ title: d.regenerated === 0 ? "모두 최신 링크" : `${d.regenerated}건 재생성 완료` });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  // ── Draft edit helpers ───────────────────────────────────────────────────────
  function getDraftEdit(ev: Event) {
    if (draftEdits[ev.id]) return draftEdits[ev.id];
    return {
      caption: ev.socialDraft?.caption ?? "",
      hashtagsStr: ev.socialDraft?.hashtags.join(" ") ?? "",
    };
  }
  function setDraftCaption(id: string, caption: string) {
    setDraftEdits((p) => ({ ...p, [id]: { ...getDraftEditById(id), caption } }));
  }
  function setDraftHashtagsStr(id: string, hashtagsStr: string) {
    setDraftEdits((p) => ({ ...p, [id]: { ...getDraftEditById(id), hashtagsStr } }));
  }
  function getDraftEditById(id: string) {
    return draftEdits[id] ?? { caption: "", hashtagsStr: "" };
  }
  function initDraftEdit(ev: Event) {
    if (!draftEdits[ev.id]) {
      setDraftEdits((p) => ({
        ...p,
        [ev.id]: {
          caption: ev.socialDraft?.caption ?? "",
          hashtagsStr: ev.socialDraft?.hashtags.join(" ") ?? "",
        },
      }));
    }
  }
  function parseHashtags(str: string): string[] {
    return str.split(/[\s,]+/).map((h) => h.replace(/^#/, "").trim()).filter(Boolean);
  }
  function copyText(ev: Event) {
    const text = ev.socialDraft
      ? `${ev.socialDraft.caption}\n\n${ev.socialDraft.hashtags.map((h) => `#${h}`).join(" ")}`
      : "";
    navigator.clipboard.writeText(text).then(() => toast({ title: "복사 완료" }));
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full bg-sidebar text-sidebar-foreground ${mobile ? "w-64" : "w-56"}`}>
      <div className="p-5 border-b border-sidebar-border">
        <img src={`${BASE}/logo.png`} alt="PLAY강릉" className="h-8 object-contain brightness-0 invert" />
        <p className="text-xs text-sidebar-foreground/50 mt-1">관리자</p>
      </div>
      <nav className="flex-1 py-4 px-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => { setActiveNav(item.key); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors ${
              activeNav === item.key
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            {item.icon}
            {item.label}
            {activeNav === item.key && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <a href={`${BASE}/`} className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
          <ExternalLink className="w-3 h-3" />공개 홈페이지
        </a>
        <button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="flex items-center gap-2 text-xs text-sidebar-foreground/50 hover:text-red-400 transition-colors w-full"
        >
          <LogOut className="w-3 h-3" />{logoutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
        </button>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex flex-shrink-0"><Sidebar /></aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full"><Sidebar mobile /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 rounded-md hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-base">{NAV_ITEMS.find((n) => n.key === activeNav)?.label}</h1>
              <p className="text-xs text-muted-foreground">PLAY강릉 백오피스</p>
            </div>
          </div>
          <Button size="sm" onClick={() => crawlMutation.mutate()} disabled={crawlMutation.isPending} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${crawlMutation.isPending ? "animate-spin" : ""}`} />
            {crawlMutation.isPending ? "크롤링 중..." : "전체 크롤링"}
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-5">

          {/* ══ 대시보드: 수집 목차 ══════════════════════════════════════════ */}
          {activeNav === "dashboard" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                수집된 콘텐츠 <span className="font-semibold text-foreground">{events.length}건</span> — 항목을 클릭하면 상세 내용을 확인합니다.
              </p>
              {isLoading ? (
                <div className="py-16 text-center text-muted-foreground text-sm">불러오는 중...</div>
              ) : events.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  <LayoutDashboard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  수집된 콘텐츠가 없습니다. 상단의 전체 크롤링 버튼을 눌러 수집하세요.
                </div>
              ) : (
                events.map((ev) => {
                  const sc = STATUS_CONFIG[ev.status];
                  return (
                    <button key={ev.id} className="w-full text-left" onClick={() => navigate(`/admin/events/${ev.id}`)}>
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-white hover:border-blue-300 hover:shadow-sm transition-all group">
                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          {ev.thumbnail
                            ? <img src={ev.thumbnail} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-5 h-5 text-gray-300" /></div>
                          }
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] border font-semibold ${sc.cls}`}>
                              {sc.icon}{sc.label}
                            </span>
                            {ev.category && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ev.category}</Badge>}
                            {ev.socialDraft && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-600"><MessageSquare className="w-2.5 h-2.5" />초안</span>}
                          </div>
                          <p className="font-medium text-sm leading-snug line-clamp-1 group-hover:text-blue-600 transition-colors">{ev.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ev.description || "설명 없음"}</p>
                        </div>
                        {/* Date + Arrow */}
                        <div className="shrink-0 text-right">
                          <p className="text-xs text-muted-foreground">{ev.date}</p>
                          <p className="text-[10px] text-muted-foreground/60">{ev.source}</p>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-500 ml-auto mt-1" />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* ══ SNS 피드 만들기 ═══════════════════════════════════════════════ */}
          {activeNav === "feed" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground mb-1">
                승인된 콘텐츠 <span className="font-semibold text-foreground">{feedEvents.length}건</span> — 초안을 작성하고 수정한 뒤 카드이미지를 생성하세요.
              </p>
              {feedEvents.length === 0 && (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  <Rss className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  승인된 콘텐츠가 없습니다. 대시보드에서 항목을 승인하세요.
                </div>
              )}
              {feedEvents.map((ev) => {
                const edit = getDraftEdit(ev);
                const isDirty = !!draftEdits[ev.id];
                return (
                  <Card key={ev.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Header row */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gray-50/60">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          {ev.thumbnail
                            ? <img src={ev.thumbnail} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-4 h-4 text-gray-300" /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm line-clamp-1">{ev.title}</p>
                          <p className="text-xs text-muted-foreground">{ev.date} · {ev.source}</p>
                        </div>
                        {ev.link && (
                          <a href={ev.link} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600">
                              <ExternalLink className="w-3 h-3" />원문
                            </Button>
                          </a>
                        )}
                      </div>

                      {/* Body */}
                      <div className="p-4 space-y-3">
                        {!ev.socialDraft ? (
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">SNS 초안이 없습니다.</p>
                            <Button
                              size="sm"
                              onClick={() => draftMutation.mutate(ev.id)}
                              disabled={draftMutation.isPending}
                              className="gap-1.5"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              {draftMutation.isPending ? "생성 중..." : "초안 생성"}
                            </Button>
                          </div>
                        ) : (
                          <>
                            {/* Editable caption */}
                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">SNS 문구</Label>
                              <Textarea
                                rows={5}
                                value={edit.caption}
                                className="text-sm resize-none"
                                onClick={() => initDraftEdit(ev)}
                                onChange={(e) => { initDraftEdit(ev); setDraftCaption(ev.id, e.target.value); }}
                              />
                            </div>
                            {/* Editable hashtags */}
                            <div>
                              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">해시태그 (공백 또는 쉼표로 구분)</Label>
                              <Input
                                value={edit.hashtagsStr}
                                className="text-sm"
                                placeholder="#강릉 #강릉여행 ..."
                                onClick={() => initDraftEdit(ev)}
                                onChange={(e) => { initDraftEdit(ev); setDraftHashtagsStr(ev.id, e.target.value); }}
                              />
                            </div>
                            {/* Action buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant={isDirty ? "default" : "outline"}
                                className={`gap-1.5 ${isDirty ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                                disabled={saveDraftMutation.isPending || !isDirty}
                                onClick={() => saveDraftMutation.mutate({
                                  id: ev.id,
                                  caption: edit.caption,
                                  hashtags: parseHashtags(edit.hashtagsStr),
                                })}
                              >
                                {saveDraftMutation.isPending ? "저장 중..." : isDirty ? "변경사항 저장" : "저장됨"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => copyText(ev)}
                              >
                                <Copy className="w-3 h-3" />문구 복사
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ══ 발행하기 ══════════════════════════════════════════════════════ */}
          {activeNav === "publish" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground mb-1">
                발행 준비 완료 <span className="font-semibold text-foreground">{publishEvents.length}건</span> — SNS 초안이 완성된 항목입니다.
              </p>
              {publishEvents.length === 0 && (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  <Send className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>발행 준비된 콘텐츠가 없습니다.</p>
                  <p className="text-xs mt-1">SNS 피드 만들기에서 초안을 먼저 작성하세요.</p>
                </div>
              )}
              {publishEvents.map((ev) => {
                const fullText = ev.socialDraft
                  ? `${ev.socialDraft.caption}\n\n${ev.socialDraft.hashtags.map((h) => `#${h}`).join(" ")}`
                  : "";
                const isPublished = ev.status === "published";
                return (
                  <Card key={ev.id} className={isPublished ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">{ev.title}</p>
                              <p className="text-xs text-muted-foreground">{ev.date} · {ev.source}</p>
                            </div>
                            {isPublished && (
                              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-semibold">
                                <Send className="w-3 h-3" />발행완료
                              </span>
                            )}
                          </div>
                          {ev.socialDraft && (
                            <p className="text-xs text-muted-foreground line-clamp-3 bg-gray-50 rounded-lg p-2.5 leading-relaxed">
                              {ev.socialDraft.caption}
                            </p>
                          )}
                          {!isPublished && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 text-xs gap-1.5"
                                onClick={() => {
                                  navigator.clipboard.writeText(fullText).then(() => toast({ title: "문구 복사 완료", description: "SNS 앱에서 붙여넣기 하세요." }));
                                }}
                              >
                                <Copy className="w-3 h-3" />문구 복사
                              </Button>
                              <a
                                href="https://www.facebook.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => navigator.clipboard.writeText(fullText)}
                              >
                                <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5 text-[#1877F2] border-[#1877F2]/30 hover:bg-[#1877F2]/10">
                                  <ExternalLink className="w-3 h-3" />페이스북 열기
                                </Button>
                              </a>
                              <a
                                href="https://www.instagram.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => navigator.clipboard.writeText(fullText)}
                              >
                                <Button size="sm" variant="outline" className="h-8 px-3 text-xs gap-1.5 text-[#E1306C] border-[#E1306C]/30 hover:bg-[#E1306C]/10">
                                  <ExternalLink className="w-3 h-3" />인스타 열기
                                </Button>
                              </a>
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: ev.id, status: "published" }, {
                                  onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-events"] }),
                                })}
                              >
                                <Send className="w-3 h-3" />발행완료 처리
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ══ 광고접수 ══════════════════════════════════════════════════════ */}
          {activeNav === "ads" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">광고 접수 목록 <span className="font-semibold text-foreground">{ads.length}건</span></p>
              {adsLoading ? <div className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</div> : ads.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground"><Megaphone className="w-8 h-8 mx-auto mb-2 opacity-30" />접수된 광고가 없습니다.</div>
              ) : ads.map((ad) => {
                const sc = AD_STATUS[ad.status] ?? AD_STATUS.pending;
                return (
                  <Card key={ad.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border font-medium ${sc.cls}`}>{sc.label}</span>
                            <span className="text-xs font-medium text-muted-foreground">{ad.businessName}</span>
                          </div>
                          <p className="font-semibold text-sm">{ad.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{ad.phone} · {ad.createdAt?.slice(0, 10)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          {ad.status === "pending" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50"
                              onClick={() => adStatusMutation.mutate({ id: ad.id, status: "approved" })} disabled={adStatusMutation.isPending}>
                              <CheckCircle className="w-3 h-3" />승인
                            </Button>
                          )}
                          {ad.status === "approved" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-blue-700 border-blue-200"
                              onClick={() => adStatusMutation.mutate({ id: ad.id, status: "scheduled" })} disabled={adStatusMutation.isPending}>
                              발행예정
                            </Button>
                          )}
                          {ad.status === "scheduled" && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                              onClick={() => adStatusMutation.mutate({ id: ad.id, status: "published" })} disabled={adStatusMutation.isPending}>
                              발행완료
                            </Button>
                          )}
                          {!["rejected","published"].includes(ad.status) && (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-700 border-red-200"
                              onClick={() => adStatusMutation.mutate({ id: ad.id, status: "rejected" })} disabled={adStatusMutation.isPending}>
                              <XCircle className="w-3 h-3" />제외
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingAd(ad)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:bg-destructive/10"
                            onClick={() => adDeleteMutation.mutate(ad.id)} disabled={adDeleteMutation.isPending}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ══ 설정 ══════════════════════════════════════════════════════════ */}
          {activeNav === "settings" && (
            <div className="max-w-lg space-y-4">
              <Card>
                <CardContent className="p-5 space-y-3">
                  <p className="font-semibold text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 text-blue-600" />SNS 초안 링크 일괄 재생성</p>
                  <p className="text-sm text-muted-foreground">기존 초안의 출처 URL을 /content/:id 상세 링크로 일괄 업데이트합니다.</p>
                  {regenerateDraftsMutation.data && (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      {regenerateDraftsMutation.data.regenerated === 0 ? "모든 초안이 이미 최신입니다." : `${regenerateDraftsMutation.data.regenerated}건 업데이트 완료`}
                    </div>
                  )}
                  <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => regenerateDraftsMutation.mutate()} disabled={regenerateDraftsMutation.isPending}>
                    <RefreshCw className={`w-4 h-4 ${regenerateDraftsMutation.isPending ? "animate-spin" : ""}`} />
                    {regenerateDraftsMutation.isPending ? "재생성 중..." : "일괄 재생성"}
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="font-semibold text-sm flex items-center gap-2 mb-4"><KeyRound className="w-4 h-4 text-blue-600" />비밀번호 변경</p>
                  <form className="space-y-4" onSubmit={(e) => {
                    e.preventDefault();
                    if (pwForm.next !== pwForm.confirm) { toast({ title: "새 비밀번호가 일치하지 않습니다", variant: "destructive" }); return; }
                    if (pwForm.next.length < 4) { toast({ title: "4자 이상이어야 합니다", variant: "destructive" }); return; }
                    changePwMutation.mutate({ currentPassword: pwForm.current, newPassword: pwForm.next });
                  }}>
                    <div className="space-y-1"><Label>현재 비밀번호</Label><Input type="password" value={pwForm.current} onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>새 비밀번호</Label><Input type="password" value={pwForm.next} onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>새 비밀번호 확인</Label><Input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))} /></div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={changePwMutation.isPending || !pwForm.current || !pwForm.next}>
                      {changePwMutation.isPending ? "변경 중..." : "비밀번호 변경"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>

    {/* ══ 이벤트 수정 다이얼로그 ════════════════════════════════════════════ */}
    {editingEvent && (
      <Dialog open onOpenChange={(o) => { if (!o) setEditingEvent(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-600" />이벤트 수정</DialogTitle></DialogHeader>
          <form className="space-y-4 py-2" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            editEventMutation.mutate({ id: editingEvent.id, patch: {
              title: fd.get("title") as string,
              description: fd.get("description") as string,
              thumbnail: (fd.get("thumbnail") as string) || undefined,
              location: fd.get("location") as string,
              category: fd.get("category") as string,
              startDate: fd.get("startDate") as string,
              endDate: fd.get("endDate") as string,
            }});
          }}>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">대표 이미지 URL
                {!editThumbnailUrl && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5"><AlertTriangle className="w-3 h-3" />이미지 없음</span>}
              </Label>
              <Input name="thumbnail" value={editThumbnailUrl} onChange={(e) => setEditThumbnailUrl(e.target.value)} placeholder="https://example.com/image.jpg" className={!editThumbnailUrl ? "border-orange-300" : ""} />
              {editThumbnailUrl && <div className="rounded-lg overflow-hidden border h-32 bg-gray-50"><img src={editThumbnailUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>}
            </div>
            <div className="space-y-1"><Label>제목</Label><Input name="title" defaultValue={editingEvent.title} required /></div>
            <div className="space-y-1"><Label>설명</Label><Textarea name="description" rows={3} defaultValue={editingEvent.description} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>장소</Label><Input name="location" defaultValue={editingEvent.location ?? ""} /></div>
              <div className="space-y-1"><Label>카테고리</Label>
                <select name="category" defaultValue={editingEvent.category ?? "행사"} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="행사">행사</option><option value="맛집">맛집</option><option value="핫플">핫플</option><option value="지역소식">지역소식</option>
                </select>
              </div>
              <div className="space-y-1"><Label>시작일</Label><Input name="startDate" type="date" defaultValue={editingEvent.startDate ?? editingEvent.date} /></div>
              <div className="space-y-1"><Label>종료일</Label><Input name="endDate" type="date" defaultValue={editingEvent.endDate ?? ""} /></div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingEvent(null)}>취소</Button>
              <Button type="submit" disabled={editEventMutation.isPending}>{editEventMutation.isPending ? "저장 중..." : "저장"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )}

    {/* ══ 광고 수정 다이얼로그 ══════════════════════════════════════════════ */}
    {editingAd && (
      <Dialog open onOpenChange={(o) => { if (!o) setEditingAd(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-blue-600" />광고 수정</DialogTitle></DialogHeader>
          <form className="space-y-4 py-2" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            adEditMutation.mutate({ id: editingAd.id, patch: {
              title: fd.get("title") as string, businessName: fd.get("businessName") as string,
              contactName: fd.get("contactName") as string, phone: fd.get("phone") as string,
              email: fd.get("email") as string, category: fd.get("category") as string,
              description: fd.get("description") as string, date: fd.get("date") as string,
              location: fd.get("location") as string, url: fd.get("url") as string,
              plan: fd.get("plan") as Ad["plan"],
            }});
          }}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>광고 제목</Label><Input name="title" defaultValue={editingAd.title} required /></div>
              <div className="space-y-1"><Label>업체명</Label><Input name="businessName" defaultValue={editingAd.businessName} required /></div>
              <div className="space-y-1"><Label>카테고리</Label><Input name="category" defaultValue={editingAd.category} /></div>
              <div className="space-y-1"><Label>담당자</Label><Input name="contactName" defaultValue={editingAd.contactName} /></div>
              <div className="space-y-1"><Label>연락처</Label><Input name="phone" defaultValue={editingAd.phone} /></div>
              <div className="col-span-2 space-y-1"><Label>이메일</Label><Input name="email" type="email" defaultValue={editingAd.email} /></div>
              <div className="col-span-2 space-y-1"><Label>광고 내용</Label><Textarea name="description" rows={3} defaultValue={editingAd.description} /></div>
              <div className="space-y-1"><Label>날짜</Label><Input name="date" type="date" defaultValue={editingAd.date} /></div>
              <div className="space-y-1"><Label>위치</Label><Input name="location" defaultValue={editingAd.location} /></div>
              <div className="col-span-2 space-y-1"><Label>링크 URL</Label><Input name="url" defaultValue={editingAd.url} placeholder="https://" /></div>
              <div className="col-span-2 space-y-1"><Label>광고 플랜</Label>
                <select name="plan" defaultValue={editingAd.plan} className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="basic">기본 (1일 노출)</option>
                  <option value="main">메인 (3일 노출, 상단 고정)</option>
                  <option value="premium">프리미엄 (5일 노출, 최상단)</option>
                </select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingAd(null)}>취소</Button>
              <Button type="submit" disabled={adEditMutation.isPending}>{adEditMutation.isPending ? "저장 중..." : "저장"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
