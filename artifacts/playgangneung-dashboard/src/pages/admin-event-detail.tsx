import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ExternalLink, ImageOff, Trash2, ChevronDown, Send, Video, Image, Copy, MessageSquare, Download, RefreshCw, Package, CheckCircle } from "lucide-react";
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
  thumbnail?: string | null;
  videoUrl?: string | null;
  socialDraft?: SocialDraft | null;
  status: string;
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

export default function AdminEventDetail() {
  const [, params] = useRoute("/admin/events/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const eventId = params?.id ?? "";

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editThumbnail, setEditThumbnail] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [inited, setInited] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // SNS 게시 패키지
  const [editCaption, setEditCaption] = useState("");
  const [editHashtagsStr, setEditHashtagsStr] = useState("");
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<{ events: Event[] }>({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/events`, { credentials: "include" });
      if (!r.ok) throw new Error("로드 실패");
      return r.json();
    },
  });

  const event = data?.events.find((e) => e.id === eventId) ?? null;

  useEffect(() => {
    if (event && !inited) {
      setEditTitle(event.title);
      setEditDescription(event.description ?? "");
      setEditContact(event.contact ?? "");
      setEditCategory(event.category ?? "지역소식");
      setEditStartDate(event.startDate ?? event.date ?? "");
      setEditEndDate(event.endDate ?? "");
      setEditThumbnail(event.thumbnail ?? "");
      setEditVideoUrl(event.videoUrl ?? "");
      if (event.socialDraft) {
        setEditCaption(event.socialDraft.caption);
        setEditHashtagsStr(event.socialDraft.hashtags.join(" "));
      }
      setInited(true);
    }
  }, [event, inited]);

  const saveMutation = useMutation({
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
          thumbnail: editThumbnail || null,
          videoUrl: editVideoUrl || null,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "저장 실패"); }
      await fetch(`${BASE}/api/events/${eventId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
    },
    onSuccess: () => {
      toast({ title: "저장 완료 — 공개 피드에 반영됐습니다" });
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/${eventId}/draft`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "초안 생성 실패");
      return d as { socialDraft: SocialDraft };
    },
    onSuccess: (d) => {
      setEditCaption(d.socialDraft.caption);
      setEditHashtagsStr(d.socialDraft.hashtags.join(" "));
      setIsDraftDirty(false);
      toast({ title: "SNS 문구 자동 생성 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: "생성 실패", description: e.message, variant: "destructive" }),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const hashtags = editHashtagsStr.split(/[\s,]+/).map((h) => h.replace(/^#/, "").trim()).filter(Boolean);
      const r = await fetch(`${BASE}/api/events/${eventId}/draft`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ caption: editCaption, hashtags }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "저장 실패");
      return d;
    },
    onSuccess: () => {
      setIsDraftDirty(false);
      toast({ title: "문구 저장 완료" });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: "저장 실패", description: e.message, variant: "destructive" }),
  });

  const cardMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/${eventId}/card`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "카드 생성 실패");
      return d as { cardUrl: string };
    },
    onSuccess: (d) => {
      setCardUrl(`${BASE}${d.cardUrl}?t=${Date.now()}`);
      toast({ title: "카드이미지 생성 완료", description: "아래에서 다운로드하세요." });
    },
    onError: (e: Error) => toast({ title: "카드 생성 실패", description: e.message, variant: "destructive" }),
  });

  function copyAll() {
    const hashtags = editHashtagsStr.split(/[\s,]+/).map((h) => h.startsWith("#") ? h : `#${h}`).filter(Boolean);
    const text = `${editCaption}\n\n${hashtags.join(" ")}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({ title: "캡션 복사 완료", description: "인스타·페북 게시창에 붙여넣으세요." });
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function copyVideoUrl() {
    if (!event?.videoUrl) return;
    navigator.clipboard.writeText(event.videoUrl).then(() => toast({ title: "동영상 URL 복사 완료" }));
  }

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

  const isPublished = event.status === "approved" || event.status === "published";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost" size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => navigate("/admin")}
        >
          <ArrowLeft className="w-4 h-4" />뒤로
        </Button>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <p className="text-sm font-medium truncate">{event.title}</p>
          {isPublished && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
              공개중
            </span>
          )}
        </div>
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

        {/* 썸네일 */}
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

        {/* 미디어 첨부 */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Image className="w-4 h-4 text-blue-500" />사진 / 동영상
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">대표 이미지 URL</Label>
            <Input
              value={editThumbnail}
              onChange={(e) => { setEditThumbnail(e.target.value); setIsDirty(true); }}
              className="text-sm"
              placeholder="https://example.com/image.jpg"
            />
            {editThumbnail && (
              <div className="rounded-xl overflow-hidden border bg-gray-50 max-h-48">
                <img
                  src={editThumbnail}
                  alt="미리보기"
                  className="w-full h-full object-contain max-h-48"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-purple-500" />동영상 URL
            </Label>
            <Input
              value={editVideoUrl}
              onChange={(e) => { setEditVideoUrl(e.target.value); setIsDirty(true); }}
              className="text-sm"
              placeholder="https://youtu.be/... 또는 MP4 직접 URL"
            />
            {editVideoUrl && (
              <p className="text-xs text-muted-foreground">
                유튜브·유튜브 쇼츠는 자동 임베드 / MP4·WebM은 플레이어 / 그 외는 링크로 표시됩니다.
              </p>
            )}
          </div>
        </div>

        {/* 내용 편집 */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">내용</p>

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
            <Label className="text-xs text-muted-foreground">상세 내용 (SNS에 그대로 게시됩니다)</Label>
            <Textarea
              rows={6}
              value={editDescription}
              onChange={(e) => { setEditDescription(e.target.value); setIsDirty(true); }}
              className="text-sm resize-none"
              placeholder="내용을 입력하세요. 이 내용이 SNS에 그대로 올라갑니다."
            />
          </div>

          <Button
            className="w-full gap-2 h-11 font-bold bg-green-600 hover:bg-green-700 text-white"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Send className="w-4 h-4" />
            {saveMutation.isPending ? "저장 중..." : isDirty ? "저장 & 공개" : isPublished ? "공개 중 (다시 저장)" : "저장 & 공개"}
          </Button>
        </div>

        {/* ══ SNS 게시 패키지 ════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border-2 border-violet-200 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-bold text-violet-700">SNS 게시 패키지</p>
            <span className="ml-auto text-[10px] text-violet-400 font-medium bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">인스타·페북 복사 게시</span>
          </div>

          {/* STEP 1 — 캡션 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">① SNS 문구</p>
              <Button
                size="sm" variant="outline"
                className="h-7 px-2.5 text-xs gap-1 text-violet-700 border-violet-300 hover:bg-violet-50"
                disabled={draftMutation.isPending}
                onClick={() => draftMutation.mutate()}
              >
                <RefreshCw className={`w-3 h-3 ${draftMutation.isPending ? "animate-spin" : ""}`} />
                {event?.socialDraft ? "재생성" : "자동 생성"}
              </Button>
            </div>
            {event?.socialDraft || editCaption ? (
              <>
                <Textarea
                  rows={5}
                  value={editCaption}
                  className="text-sm resize-none border-violet-200 focus:border-violet-400"
                  placeholder="SNS 문구를 입력하세요."
                  onChange={(e) => { setEditCaption(e.target.value); setIsDraftDirty(true); }}
                />
                <Input
                  value={editHashtagsStr}
                  className="text-sm border-violet-200"
                  placeholder="#강릉 #강릉여행 #PLAY강릉 ..."
                  onChange={(e) => { setEditHashtagsStr(e.target.value); setIsDraftDirty(true); }}
                />
                <div className="flex gap-2">
                  {isDraftDirty && (
                    <Button
                      size="sm" variant="outline"
                      className="h-8 text-xs gap-1 border-violet-300 text-violet-700"
                      disabled={saveDraftMutation.isPending}
                      onClick={() => saveDraftMutation.mutate()}
                    >
                      {saveDraftMutation.isPending ? "저장 중..." : "문구 저장"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className={`h-8 text-xs gap-1.5 flex-1 font-bold ${copied ? "bg-green-600 hover:bg-green-700" : "bg-violet-600 hover:bg-violet-700"}`}
                    onClick={copyAll}
                  >
                    {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "복사됨! 인스타·페북에 붙여넣기" : "문구 전체 복사"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 text-center">
                <MessageSquare className="w-6 h-6 text-violet-300 mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">자동 생성 버튼을 눌러 SNS 문구를 만들어보세요.</p>
              </div>
            )}
          </div>

          {/* STEP 2 — 이미지 */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">② 이미지</p>
            <div className="flex flex-col gap-2">
              {(editThumbnail || event?.thumbnail) && (
                <a
                  href={editThumbnail || event?.thumbnail || ""}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors text-sm text-gray-700 font-medium"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  대표 이미지 다운로드
                </a>
              )}
              <Button
                size="sm" variant="outline"
                className="w-full h-9 text-sm gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
                disabled={cardMutation.isPending}
                onClick={() => cardMutation.mutate()}
              >
                <Image className={`w-3.5 h-3.5 ${cardMutation.isPending ? "animate-spin" : ""}`} />
                {cardMutation.isPending ? "카드이미지 생성 중..." : "1080×1080 카드이미지 생성"}
              </Button>
              {cardUrl && (
                <div className="rounded-xl overflow-hidden border border-teal-200 bg-black">
                  <img src={cardUrl} alt="카드이미지" className="w-full object-cover" />
                  <a
                    href={cardUrl}
                    download={`card-${eventId}.png`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />카드이미지 저장 (1080×1080 PNG)
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* STEP 3 — 동영상 */}
          {event?.videoUrl && (
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">③ 동영상</p>
              <div className="flex gap-2 items-center rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5">
                <Video className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="text-xs font-mono text-gray-600 flex-1 truncate">{event.videoUrl}</span>
                <button
                  className="shrink-0 text-xs font-bold text-purple-600 hover:text-purple-800"
                  onClick={copyVideoUrl}
                >
                  URL 복사
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">* 동영상은 URL을 복사 후 직접 앱에서 파일 업로드 방식으로 게시하세요.</p>
            </div>
          )}

          {/* 게시 가이드 */}
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 space-y-1">
            <p className="text-[11px] font-bold text-blue-700 mb-1">📱 인스타그램 게시 방법</p>
            <p className="text-[11px] text-blue-600">1. 카드이미지 저장 → 갤러리에 보관</p>
            <p className="text-[11px] text-blue-600">2. 문구 전체 복사 버튼 클릭</p>
            <p className="text-[11px] text-blue-600">3. 인스타 앱 → 새 게시물 → 이미지 선택</p>
            <p className="text-[11px] text-blue-600">4. 캡션 입력란에 붙여넣기(길게 누르기) → 게시</p>
          </div>
        </div>

        {/* 원본 링크 */}
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

      </div>
    </div>
  );
}
