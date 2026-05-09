import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  ImageOff,
  Send,
  Clock,
  MessageSquare,
  AlertTriangle,
  X,
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
  location?: string;
  category?: string;
  thumbnail?: string;
  status: "draft" | "approved" | "rejected" | "published";
  socialDraft: SocialDraft | null;
  crawledAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  draft:     { label: "검토 중",   icon: <Clock className="w-3.5 h-3.5" />,      cls: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  approved:  { label: "승인",     icon: <CheckCircle className="w-3.5 h-3.5" />, cls: "bg-green-100 text-green-700 border-green-200" },
  rejected:  { label: "반려",     icon: <XCircle className="w-3.5 h-3.5" />,     cls: "bg-red-100 text-red-700 border-red-200" },
  published: { label: "발행완료", icon: <Send className="w-3.5 h-3.5" />,        cls: "bg-blue-100 text-blue-700 border-blue-200" },
};

export default function AdminEventDetail() {
  const [, params] = useRoute("/admin/events/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const eventId = params?.id ?? "";

  const [editing, setEditing] = useState(false);
  const [editThumbnailUrl, setEditThumbnailUrl] = useState("");

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<{ events: Event[] }>({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/events`, { credentials: "include" });
      if (!r.ok) throw new Error("로드 실패");
      return r.json();
    },
  });

  const event = data?.events.find((e) => e.id === eventId) ?? null;

  // ── Mutations ────────────────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const r = await fetch(`${BASE}/api/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("상태 변경 실패");
      return r.json();
    },
    onSuccess: () => { toast({ title: "상태 변경 완료" }); qc.invalidateQueries({ queryKey: ["admin-events"] }); },
    onError: () => toast({ title: "상태 변경 실패", variant: "destructive" }),
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

  const editMutation = useMutation({
    mutationFn: async (patch: Partial<Event>) => {
      const r = await fetch(`${BASE}/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error("수정 실패");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "수정 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      setEditing(false);
    },
    onError: () => toast({ title: "수정 실패", variant: "destructive" }),
  });

  // ── Loading / Not found ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        불러오는 중...
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">콘텐츠를 찾을 수 없습니다.</p>
        <Button variant="outline" onClick={() => navigate("/admin")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />대시보드로 돌아가기
        </Button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[event.status];
  const dateRange = event.startDate
    ? event.endDate
      ? `${event.startDate} ~ ${event.endDate}`
      : event.startDate
    : event.date;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/admin")}>
          <ArrowLeft className="w-4 h-4" />뒤로
        </Button>
        <div className="h-4 w-px bg-border" />
        <p className="text-sm font-medium truncate flex-1">{event.title}</p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-blue-600 h-8 px-3"
            onClick={() => { setEditing(true); setEditThumbnailUrl(event.thumbnail ?? ""); }}
          >
            <Pencil className="w-3.5 h-3.5" />수정
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-destructive h-8 px-3"
            disabled={deleteMutation.isPending}
            onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(); }}
          >
            <Trash2 className="w-3.5 h-3.5" />삭제
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Hero image */}
        {event.thumbnail ? (
          <img
            src={event.thumbnail}
            alt={event.title}
            className="w-full aspect-video object-cover rounded-2xl border border-border shadow-sm"
          />
        ) : (
          <div className="w-full aspect-video bg-gray-100 rounded-2xl border-dashed border-2 border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400">
            <ImageOff className="w-10 h-10" />
            <span className="text-sm">대표 이미지 없음</span>
          </div>
        )}

        {/* Title + status */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-semibold ${sc.cls}`}>
              {sc.icon}{sc.label}
            </span>
            {event.category && <Badge variant="outline">{event.category}</Badge>}
            {event.socialDraft && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-600">
                <MessageSquare className="w-3 h-3" />초안 완료
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold leading-snug">{event.title}</h1>
        </div>

        {/* Meta info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground mb-0.5">날짜</p>
            <p className="font-medium">{dateRange || "미정"}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground mb-0.5">출처</p>
            <p className="font-medium truncate">{event.source}</p>
          </div>
          {event.location && (
            <div className="bg-white rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground mb-0.5">장소</p>
              <p className="font-medium">{event.location}</p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground mb-0.5">수집일</p>
            <p className="font-medium">{event.crawledAt?.slice(0, 10) ?? "-"}</p>
          </div>
        </div>

        {/* Original URL */}
        {event.link && (
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white border border-blue-200 rounded-xl px-4 py-3 text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium truncate">{event.link}</span>
          </a>
        )}

        {/* Description */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">행사 설명</p>
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
            {event.description || "설명이 수집되지 않았습니다. 수정 버튼으로 직접 입력할 수 있습니다."}
          </p>
        </div>

        {/* SNS draft preview */}
        {event.socialDraft && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">SNS 초안</p>
            <p className="text-sm leading-relaxed text-blue-800 mb-3">{event.socialDraft.caption}</p>
            <div className="flex gap-1.5 flex-wrap">
              {event.socialDraft.hashtags.map((h) => (
                <span key={h} className="text-xs text-blue-500 font-medium">#{h}</span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">빠른 액션</p>

          {event.status === "draft" && (
            <div className="flex gap-3">
              <Button
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("approved")}
              >
                <CheckCircle className="w-4 h-4" />승인
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 text-red-600 border-red-200 hover:bg-red-50"
                disabled={statusMutation.isPending}
                onClick={() => { statusMutation.mutate("rejected"); navigate("/admin"); }}
              >
                <XCircle className="w-4 h-4" />반려
              </Button>
            </div>
          )}
          {event.status === "approved" && (
            <Button
              variant="outline"
              className="w-full gap-2 text-yellow-700 border-yellow-300 hover:bg-yellow-50"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate("draft")}
            >
              <Clock className="w-4 h-4" />검토 중으로 되돌리기
            </Button>
          )}
          {event.status === "published" && (
            <div className="flex items-center gap-2 text-sm text-blue-700 font-semibold">
              <Send className="w-4 h-4" />SNS 발행 완료된 콘텐츠입니다.
            </div>
          )}
        </div>
      </div>

      {/* ── 수정 패널 (슬라이드 오버) ─────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(false)} />
          <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />이벤트 수정
              </h2>
              <button onClick={() => setEditing(false)} className="p-1.5 rounded-md hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              className="flex-1 p-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                editMutation.mutate({
                  title: fd.get("title") as string,
                  description: fd.get("description") as string,
                  thumbnail: (fd.get("thumbnail") as string) || undefined,
                  location: fd.get("location") as string,
                  category: fd.get("category") as string,
                  startDate: fd.get("startDate") as string,
                  endDate: fd.get("endDate") as string,
                });
              }}
            >
              {/* Thumbnail */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  대표 이미지 URL
                  {!editThumbnailUrl && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                      <AlertTriangle className="w-3 h-3" />이미지 없음
                    </span>
                  )}
                </Label>
                <Input
                  name="thumbnail"
                  value={editThumbnailUrl}
                  onChange={(e) => setEditThumbnailUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className={!editThumbnailUrl ? "border-orange-300" : ""}
                />
                {editThumbnailUrl && (
                  <div className="rounded-lg overflow-hidden border h-32 bg-gray-50">
                    <img src={editThumbnailUrl} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>제목</Label>
                <Input name="title" defaultValue={event.title} required />
              </div>
              <div className="space-y-1">
                <Label>설명</Label>
                <Textarea name="description" rows={5} defaultValue={event.description} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>장소</Label>
                  <Input name="location" defaultValue={event.location ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>카테고리</Label>
                  <select
                    name="category"
                    defaultValue={event.category ?? "행사"}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="행사">행사</option>
                    <option value="맛집">맛집</option>
                    <option value="핫플">핫플</option>
                    <option value="지역소식">지역소식</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>시작일</Label>
                  <Input name="startDate" type="date" defaultValue={event.startDate ?? event.date} />
                </div>
                <div className="space-y-1">
                  <Label>종료일</Label>
                  <Input name="endDate" type="date" defaultValue={event.endDate ?? ""} />
                </div>
              </div>

              <div className="flex gap-2 pt-2 sticky bottom-0 bg-white py-4 border-t border-border -mx-5 px-5 mt-auto">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>취소</Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={editMutation.isPending}>
                  {editMutation.isPending ? "저장 중..." : "저장"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
