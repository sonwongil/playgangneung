import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ExternalLink, ImageOff, MessageSquare, Trash2, Copy, RefreshCw } from "lucide-react";
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
  status: string;
  socialDraft: SocialDraft | null;
  crawledAt: string;
}

export default function AdminEventDetail() {
  const [, params] = useRoute("/admin/events/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const eventId = params?.id ?? "";

  const [caption, setCaption] = useState("");
  const [hashtagsStr, setHashtagsStr] = useState("");
  const [draftInited, setDraftInited] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery<{ events: Event[] }>({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/events`, { credentials: "include" });
      if (!r.ok) throw new Error("로드 실패");
      return r.json();
    },
  });

  const event = data?.events.find((e) => e.id === eventId) ?? null;

  function initEdit(ev: Event) {
    if (!draftInited && ev.socialDraft) {
      setCaption(ev.socialDraft.caption);
      setHashtagsStr(ev.socialDraft.hashtags.map((h) => `#${h}`).join(" "));
      setDraftInited(true);
    }
  }

  // ── Mutations ─────────────────────────────────────────────────────────────
  const generateMutation = useMutation({
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
      toast({ title: "저장 완료" });
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

  if (event.socialDraft && !draftInited) initEdit(event);

  const dateRange = event.startDate
    ? event.endDate ? `${event.startDate} ~ ${event.endDate}` : event.startDate
    : event.date;

  const fullText = draftInited
    ? `${caption}\n\n${hashtagsStr}`
    : event.socialDraft
      ? `${event.socialDraft.caption}\n\n${event.socialDraft.hashtags.map((h) => `#${h}`).join(" ")}`
      : "";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate("/admin")}>
          <ArrowLeft className="w-4 h-4" />뒤로
        </Button>
        <div className="h-4 w-px bg-border" />
        <p className="text-sm font-medium truncate flex-1">{event.title}</p>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-destructive h-8 px-3 shrink-0"
          disabled={deleteMutation.isPending}
          onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(); }}
        >
          <Trash2 className="w-3.5 h-3.5" />삭제
        </Button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Hero image */}
        {event.thumbnail ? (
          <img src={event.thumbnail} alt={event.title} className="w-full rounded-2xl border border-border shadow-sm" />
        ) : (
          <div className="w-full aspect-video bg-gray-100 rounded-2xl border-dashed border-2 border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400">
            <ImageOff className="w-10 h-10" />
            <span className="text-sm">대표 이미지 없음</span>
          </div>
        )}

        {/* Title */}
        <h1 className="text-xl font-bold leading-snug">{event.title}</h1>

        {/* Meta */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {dateRange && <span>{dateRange}</span>}
          {event.source && <><span>·</span><span>{event.source}</span></>}
          {event.location && <><span>·</span><span>📍 {event.location}</span></>}
          {event.category && <><span>·</span><span>{event.category}</span></>}
        </div>

        {/* Original URL */}
        {event.link && (
          <a href={event.link} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white border border-blue-200 rounded-xl px-4 py-3 text-blue-600 hover:bg-blue-50 transition-colors">
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium truncate">{event.link}</span>
          </a>
        )}

        {/* Description */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold text-muted-foreground mb-2">행사 설명</p>
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
            {event.description || "설명이 수집되지 않았습니다."}
          </p>
        </div>

        {/* SNS 초안 */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />SNS 초안
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
              {event.socialDraft ? "재생성" : "초안 생성"}
            </Button>
          </div>

          {(event.socialDraft || draftInited) ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">SNS 문구</Label>
                <Textarea
                  rows={6}
                  value={caption}
                  className="text-sm resize-none"
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">해시태그</Label>
                <Input
                  value={hashtagsStr}
                  className="text-sm"
                  placeholder="#강릉 #강릉여행 ..."
                  onChange={(e) => setHashtagsStr(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 gap-1.5"
                  disabled={saveDraftMutation.isPending}
                  onClick={() => saveDraftMutation.mutate()}
                >
                  {saveDraftMutation.isPending ? "저장 중..." : "저장"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => navigator.clipboard.writeText(fullText).then(() => toast({ title: "복사 완료" }))}
                >
                  <Copy className="w-3.5 h-3.5" />복사
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">초안이 없습니다. 위 버튼으로 생성하세요.</p>
          )}
        </div>
      </div>
    </div>
  );
}
