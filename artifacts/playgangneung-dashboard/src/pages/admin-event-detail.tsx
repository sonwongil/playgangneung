import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, ExternalLink, ImageOff, MessageSquare, Trash2,
  RefreshCw, CheckCircle, XCircle, Clock, Send, Save, ChevronDown,
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
  link: string;
  source: string;
  contact?: string;
  location?: string;
  category?: string;
  thumbnail?: string;
  status: string;
  socialDraft: SocialDraft | null;
  crawledAt: string;
}

const CATEGORIES = ["행사", "맛집", "핫플", "지역소식"];

function OriginalPreview({ url, base }: { url: string; base: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <button
        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
        onClick={() => setShow((v) => !v)}
      >
        {show ? "미리보기 닫기 ▲" : "원본 페이지 미리보기 ▼"}
      </button>
      {show && (
        <div className="border-t border-border">
          <iframe
            src={`${base}/api/proxy/page?url=${encodeURIComponent(url)}`}
            className="w-full border-none block"
            style={{ height: "600px" }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="lazy"
            title="원본 페이지 미리보기"
          />
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending:   { label: "수집됨",   cls: "bg-gray-100 text-gray-600 border-gray-200" },
  draft:     { label: "검토 중",  cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved:  { label: "승인됨",   cls: "bg-green-100 text-green-700 border-green-200" },
  rejected:  { label: "반려됨",   cls: "bg-red-100 text-red-700 border-red-200" },
  published: { label: "발행완료", cls: "bg-blue-100 text-blue-700 border-blue-200" },
};

export default function AdminEventDetail() {
  const [, params] = useRoute("/admin/events/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const eventId = params?.id ?? "";

  // Edit state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editInited, setEditInited] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // SNS draft state
  const [caption, setCaption] = useState("");
  const [hashtagsStr, setHashtagsStr] = useState("");
  const [draftInited, setDraftInited] = useState(false);
  const [showDraft, setShowDraft] = useState(false);

  // Data
  const { data, isLoading } = useQuery<{ events: Event[] }>({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/events`, { credentials: "include" });
      if (!r.ok) throw new Error("로드 실패");
      return r.json();
    },
  });

  const { data: configData } = useQuery<{ siteUrl: string }>({
    queryKey: ["config"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/config`);
      return r.json();
    },
    staleTime: Infinity,
  });

  const event = data?.events.find((e) => e.id === eventId) ?? null;

  // Init edit fields from event
  useEffect(() => {
    if (event && !editInited) {
      setEditTitle(event.title);
      setEditDescription(event.description ?? "");
      setEditContact(event.contact ?? "");
      setEditCategory(event.category ?? "지역소식");
      setEditStartDate(event.startDate ?? event.date ?? "");
      setEditEndDate(event.endDate ?? "");
      setEditInited(true);
    }
  }, [event, editInited]);

  // Init draft fields
  useEffect(() => {
    if (event?.socialDraft && !draftInited) {
      setCaption(event.socialDraft.caption);
      setHashtagsStr(event.socialDraft.hashtags.map((h) => h.startsWith("#") ? h : `#${h}`).join(" "));
      setDraftInited(true);
    }
  }, [event, draftInited]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveEventMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          contact: editContact,
          category: editCategory,
          startDate: editStartDate,
          endDate: editEndDate || undefined,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "저장 실패"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "저장 완료" });
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const r = await fetch(`${BASE}/api/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "상태 변경 실패"); }
      return r.json();
    },
    onSuccess: (_, status) => {
      const labels: Record<string, string> = {
        approved: "승인 완료 — 공개 피드에 반영됩니다",
        rejected: "반려됨",
        draft: "검토 중으로 변경됨",
        published: "발행완료 — SNS 공유 처리됐습니다",
      };
      toast({ title: labels[status] ?? "상태 변경 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const generateDraftMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/${eventId}/draft`, { method: "POST" });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "생성 실패"); }
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: "SNS 초안 생성 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      setCaption(d.socialDraft.caption);
      setHashtagsStr(d.socialDraft.hashtags.map((h: string) => `#${h}`).join(" "));
      setDraftInited(true);
      setShowDraft(true);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const hashtags = hashtagsStr.split(/\s+/).map((h) => h.replace(/^#/, "")).filter(Boolean);
      const r = await fetch(`${BASE}/api/events/${eventId}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, hashtags }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "저장 실패"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "초안 저장 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/${eventId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("삭제 실패");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      navigate("/admin");
    },
    onError: () => toast({ title: "삭제 실패", variant: "destructive" }),
  });

  // ── Loading / Not found ───────────────────────────────────────────────────
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">불러오는 중...</div>;
  }
  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">콘텐츠를 찾을 수 없습니다.</p>
        <Button variant="outline" onClick={() => navigate("/admin")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />뒤로
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_LABEL[event.status] ?? STATUS_LABEL["pending"];
  const isApproved = event.status === "approved" || event.status === "published";
  const siteUrl = configData?.siteUrl ?? "https://play-gangneung-dashboard.replit.app";
  const contentUrl = `${siteUrl}/content/${eventId}`;
  const fullDraftText = `${caption}\n\n${hashtagsStr}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0" onClick={() => navigate("/admin")}>
          <ArrowLeft className="w-4 h-4" />뒤로
        </Button>
        <p className="text-sm font-medium truncate flex-1 min-w-0">{event.title}</p>
        <Button
          size="sm" variant="ghost"
          className="gap-1.5 text-destructive hover:text-destructive/80 shrink-0"
          disabled={deleteMutation.isPending}
          onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(); }}
        >
          <Trash2 className="w-3.5 h-3.5" />삭제
        </Button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── 상태 + 승인/반려 ── */}
        <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">현재 상태</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-semibold ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{event.source}</span>
          </div>

          <div className="flex gap-2">
            {!isApproved ? (
              <Button
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white font-bold h-10"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("approved")}
              >
                <CheckCircle className="w-4 h-4" />승인 — 공개 피드에 올리기
              </Button>
            ) : (
              <Button
                className="flex-1 gap-2 bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 font-bold h-10"
                disabled
              >
                <CheckCircle className="w-4 h-4" />승인됨 — 공개 피드에 표시 중
              </Button>
            )}
            {event.status !== "rejected" && (
              <Button
                variant="outline"
                className="gap-1.5 h-10 text-red-600 border-red-200 hover:bg-red-50"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("rejected")}
              >
                <XCircle className="w-4 h-4" />반려
              </Button>
            )}
            {(event.status === "approved" || event.status === "published") && (
              <Button
                variant="outline"
                className="gap-1.5 h-10 text-yellow-700 border-yellow-200 hover:bg-yellow-50"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("draft")}
              >
                <Clock className="w-3.5 h-3.5" />취소
              </Button>
            )}
          </div>
        </div>

        {/* ── 썸네일 ── */}
        {event.thumbnail ? (
          <div className="rounded-2xl overflow-hidden border border-border shadow-sm bg-black">
            <img src={event.thumbnail} alt={event.title} className="w-full max-h-72 object-contain" />
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-400 px-5 py-8 flex flex-col gap-2">
            {event.category && <span className="text-xs font-bold text-white/70 uppercase">{event.category}</span>}
            <p className="text-white font-bold text-lg leading-snug">{event.title}</p>
            {event.description && <p className="text-white/80 text-sm line-clamp-3 leading-relaxed">{event.description}</p>}
            <div className="flex items-center gap-2 mt-1">
              <ImageOff className="w-4 h-4 text-white/40" />
              <span className="text-white/40 text-xs">이미지 없음</span>
            </div>
          </div>
        )}

        {/* ── 내용 편집 ── */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <p className="text-sm font-semibold">내용 편집</p>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">제목</Label>
            <Input
              value={editTitle}
              onChange={(e) => { setEditTitle(e.target.value); setIsDirty(true); }}
              className="text-sm"
              placeholder="제목"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">카테고리</Label>
              <div className="relative">
                <select
                  value={editCategory}
                  onChange={(e) => { setEditCategory(e.target.value); setIsDirty(true); }}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm appearance-none pr-8"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2.5 top-2.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">시작일</Label>
              <Input
                value={editStartDate}
                onChange={(e) => { setEditStartDate(e.target.value); setIsDirty(true); }}
                className="text-sm"
                placeholder="예: 2025.05.10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">종료일 (선택)</Label>
            <Input
              value={editEndDate}
              onChange={(e) => { setEditEndDate(e.target.value); setIsDirty(true); }}
              className="text-sm"
              placeholder="비워두면 당일 행사로 처리"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">문의처</Label>
            <Input
              value={editContact}
              onChange={(e) => { setEditContact(e.target.value); setIsDirty(true); }}
              className="text-sm"
              placeholder="전화번호 또는 담당부서"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">상세 설명</Label>
            <Textarea
              rows={5}
              value={editDescription}
              onChange={(e) => { setEditDescription(e.target.value); setIsDirty(true); }}
              className="text-sm resize-none"
              placeholder="행사 설명을 입력하세요"
            />
          </div>

          <Button
            className={`w-full gap-2 h-10 font-semibold ${isDirty ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
            variant={isDirty ? "default" : "outline"}
            disabled={saveEventMutation.isPending || !isDirty}
            onClick={() => saveEventMutation.mutate()}
          >
            <Save className="w-4 h-4" />
            {saveEventMutation.isPending ? "저장 중..." : isDirty ? "변경사항 저장" : "저장됨"}
          </Button>
        </div>

        {/* ── 원본 링크 ── */}
        {event.link && (
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <ExternalLink className="w-4 h-4 shrink-0 text-blue-500" />
              <span className="text-xs text-muted-foreground truncate flex-1 min-w-0 font-mono">{event.link}</span>
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                새 탭에서 열기
              </a>
            </div>
            <OriginalPreview url={event.link} base={BASE} />
          </div>
        )}

        {/* ── SNS 초안 (승인된 항목만) ── */}
        {isApproved && (
          <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <button
                className="flex items-center gap-2 text-sm font-semibold"
                onClick={() => setShowDraft((v) => !v)}
              >
                <MessageSquare className="w-4 h-4 text-blue-500" />SNS 초안
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showDraft ? "rotate-180" : ""}`} />
              </button>
              <Button
                size="sm" variant="outline" className="gap-1.5 h-8"
                disabled={generateDraftMutation.isPending}
                onClick={() => generateDraftMutation.mutate()}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generateDraftMutation.isPending ? "animate-spin" : ""}`} />
                {event.socialDraft ? "재생성" : "초안 생성"}
              </Button>
            </div>

            {showDraft && (event.socialDraft || draftInited) && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">SNS 문구</Label>
                  <Textarea
                    rows={6} value={caption} className="text-sm resize-none"
                    onChange={(e) => setCaption(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">해시태그</Label>
                  <Input
                    value={hashtagsStr} className="text-sm"
                    placeholder="#강릉 #강릉여행 ..."
                    onChange={(e) => setHashtagsStr(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline" className="w-full gap-1.5"
                  disabled={saveDraftMutation.isPending}
                  onClick={() => saveDraftMutation.mutate()}
                >
                  {saveDraftMutation.isPending ? "저장 중..." : "초안 저장"}
                </Button>
                {/* SNS 공유 버튼 */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">SNS에 공유하기</p>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-1.5 text-white bg-[#1877F2] hover:bg-[#1565C0]"
                      onClick={async () => {
                        await navigator.clipboard.writeText(`${fullDraftText}\n\n${contentUrl}`);
                        saveDraftMutation.mutate();
                        toast({ title: "텍스트+링크 복사됨 — 페이스북에 붙여넣기 하세요" });
                        setTimeout(() => window.open("https://www.facebook.com/", "_blank"), 600);
                      }}
                    >
                      페이스북
                    </Button>
                    <Button
                      className="flex-1 gap-1.5 text-white bg-[#E1306C] hover:bg-[#C2185B]"
                      onClick={async () => {
                        await navigator.clipboard.writeText(fullDraftText);
                        saveDraftMutation.mutate();
                        const imgUrl = `${BASE}/api/cards/${eventId}.png`;
                        const res = await fetch(imgUrl).catch(() => null);
                        if (res?.ok) {
                          const blob = await res.blob();
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `${eventId}.png`;
                          a.click();
                          toast({ title: "이미지 다운로드됨 · 텍스트 복사됨" });
                        } else {
                          toast({ title: "텍스트 복사됨 — 인스타그램에서 이미지를 첨부하세요" });
                        }
                        setTimeout(() => window.open("https://www.instagram.com/", "_blank"), 800);
                      }}
                    >
                      인스타그램
                    </Button>
                  </div>
                </div>

                {/* 발행완료 처리 */}
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">공유 후 처리</p>
                  {event.status === "published" ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200">
                      <Send className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-sm font-semibold text-blue-700">발행완료 — SNS 공유 처리됐습니다</span>
                    </div>
                  ) : (
                    <Button
                      className="w-full gap-2 bg-gray-800 hover:bg-gray-900 text-white"
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate("published")}
                    >
                      <Send className="w-4 h-4" />
                      {statusMutation.isPending ? "처리 중..." : "발행완료 처리 — SNS에 올렸어요"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {showDraft && !event.socialDraft && !draftInited && (
              <p className="text-sm text-muted-foreground">초안이 없습니다. 위 버튼으로 생성하세요.</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
