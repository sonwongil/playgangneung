import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SnsEditor, { type SnsEditorHandle } from "@/components/sns-editor";
import { htmlToSns, snsToHtml } from "@/lib/sns-utils";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ExternalLink, ImageOff, Trash2, ChevronDown, Send, Video, Image, Copy, MessageSquare, Download, RefreshCw, Package, CheckCircle, Upload, Link } from "lucide-react";
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
  extraImages?: string[] | null;
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
  const [editExtraImages, setEditExtraImages] = useState<[string, string]>(["", ""]);
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [inited, setInited] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isUploadingSlot, setIsUploadingSlot] = useState<number | null>(null);

  // SNS 게시 패키지
  const [editCaption, setEditCaption] = useState("");
  const [editHashtagsStr, setEditHashtagsStr] = useState("");
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageTab, setImageTab] = useState<"url" | "upload">("url");

  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const editorRef = useRef<SnsEditorHandle>(null);

  const contentPageUrl = `${window.location.origin}/content/${eventId}`;

  const EMOJI_GROUPS = [
    { label: "❤️ 감정", emojis: ["😊","🥰","😍","🤩","😆","😂","🙏","👏","🙌","❤️","💕","💯","🔥","✨","💫","🌟","😎","🥳","😋","🤗"] },
    { label: "📍 장소", emojis: ["📍","🗺️","🏖️","🏔️","🌊","🌸","🌿","🌲","🍃","🌺","🌻","🌈","⛰️","🏞️","🏙️","🌃","🚗","🚶","🛤️","🌅"] },
    { label: "🍜 음식", emojis: ["🍜","🍣","🥗","☕","🍰","🍺","🍷","🍕","🥘","🥩","🍱","🧋","🍦","🥪","🍤","🍛","🥐","🧁","🍻","🥂"] },
    { label: "🎉 이벤트", emojis: ["🎉","🎊","🎁","📢","📣","🎵","🎶","🎤","🎭","🎪","🏆","🥇","🎯","🎈","🎠","🎡","🎢","🎆","🎇","🪅"] },
    { label: "📸 SNS", emojis: ["📸","📷","🤳","💻","📱","🔗","✅","⭐","💡","📌","🔔","👀","💬","📝","🗓️","⏰","📊","🆕","🔖","💥"] },
  ];

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
      setEditExtraImages([
        event.extraImages?.[0] ?? "",
        event.extraImages?.[1] ?? "",
      ]);
      setEditVideoUrl(event.videoUrl ?? "");
      if (event.socialDraft) {
        setEditCaption(snsToHtml(event.socialDraft.caption));
        setEditHashtagsStr(event.socialDraft.hashtags.join(" "));
      } else if (event.description) {
        setEditCaption(snsToHtml(event.description));
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
          extraImages: editExtraImages.filter(Boolean),
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
      setEditCaption(snsToHtml(d.socialDraft.caption));
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
        body: JSON.stringify({ caption: htmlToSns(editCaption), hashtags }),
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


  async function handleImageUpload(file: File, slot = 0) {
    setIsUploadingSlot(slot);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const r = await fetch(`${BASE}/api/events/${eventId}/upload-image?slot=${slot}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "업로드 실패");
      if (slot === 0) {
        setEditThumbnail(d.imageUrl);
        setImageTab("url");
      } else {
        setEditExtraImages((prev) => {
          const next: [string, string] = [...prev] as [string, string];
          next[slot - 1] = d.imageUrl;
          return next;
        });
      }
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      toast({ title: "이미지 업로드 완료", description: slot === 0 ? "대표 이미지가 적용되었습니다." : `추가 이미지 ${slot}이 적용되었습니다.` });
    } catch (e: unknown) {
      toast({ title: "업로드 실패", description: e instanceof Error ? e.message : "다시 시도해 주세요.", variant: "destructive" });
    } finally {
      setIsUploadingSlot(null);
    }
  }

  function copyAll() {
    const hashtags = editHashtagsStr.split(/[\s,]+/).map((h) => h.startsWith("#") ? h : `#${h}`).filter(Boolean);
    const captionText = htmlToSns(editCaption);
    const footerParts: string[] = [];
    // 원문보기: event.link가 있고 caption에 없으면 추가
    if (event?.link && !captionText.includes(event.link)) {
      footerParts.push(`🔗 원문보기 👉 ${event.link}`);
    }
    // PLAY강릉 콘텐츠 링크: caption에 /content/ 경로가 없으면 추가
    if (!captionText.includes("/content/")) {
      footerParts.push(`📍 강릉 더보기 👉 ${contentPageUrl}`);
    }
    const parts = [captionText, hashtags.join(" "), ...footerParts].filter(Boolean);
    const text = parts.join("\n\n");
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

        {/* 썸네일 — editThumbnail로 실시간 미리보기 */}
        {(editThumbnail || event.thumbnail) ? (
          <div className="rounded-2xl overflow-hidden border border-border shadow-sm bg-black">
            <img src={editThumbnail || event.thumbnail!} alt={event.title} className="w-full max-h-72 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
            <textarea
              rows={6}
              value={editDescription}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setEditDescription(e.target.value); setIsDirty(true); }}
              className="text-sm resize-none flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                {event?.socialDraft ? "AI 재생성" : "AI 자동 생성"}
              </Button>
            </div>

            {/* 이모지 + 구분선 퀵 버튼 */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              {/* 이모지 피커 토글 */}
              <div className="relative">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowEmoji((v) => !v)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${showEmoji ? "bg-violet-200 text-violet-800" : "bg-white border border-violet-200 text-violet-600 hover:bg-violet-100"}`}
                >
                  😊 이모지
                </button>
                {showEmoji && (
                  <div className="absolute left-0 top-8 z-50 bg-white border border-border rounded-2xl shadow-xl w-72 p-3 space-y-2">
                    <div className="flex gap-1 overflow-x-auto pb-1">
                      {EMOJI_GROUPS.map((g, i) => (
                        <button key={i}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setEmojiTab(i)}
                          className={`shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${emojiTab === i ? "bg-violet-100 text-violet-700" : "text-muted-foreground hover:bg-gray-100"}`}
                        >{g.label}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-10 gap-0.5">
                      {EMOJI_GROUPS[emojiTab].emojis.map((em) => (
                        <button key={em}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { editorRef.current?.insertText(em); setShowEmoji(false); }}
                          className="text-lg w-7 h-7 flex items-center justify-center rounded hover:bg-violet-50 transition-colors"
                        >{em}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 구분선 삽입 */}
              <button type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorRef.current?.insertText("─────────────")}
                className="px-2 py-1 rounded-md text-xs font-medium bg-white border border-violet-200 text-violet-600 hover:bg-violet-100 transition-colors"
                title="구분선 삽입"
              >─ 구분선</button>

              {/* 글자수 */}
              <span className={`ml-auto text-[11px] font-mono font-semibold tabular-nums ${htmlToSns(editCaption).length > 2000 ? "text-red-500" : htmlToSns(editCaption).length > 1500 ? "text-orange-500" : "text-muted-foreground"}`}>
                {htmlToSns(editCaption).length} / 2200
              </span>
            </div>

            {/* TipTap 에디터 (Bold/Italic/취소선/목록/실행취소 툴바 내장) */}
            <SnsEditor
              ref={editorRef}
              value={editCaption}
              rows={7}
              placeholder="SNS 문구를 입력하세요."
              onChange={(html) => { setEditCaption(html); setIsDraftDirty(true); }}
            />

            {/* 해시태그 */}
            <Input
              value={editHashtagsStr}
              className="text-sm border-violet-200"
              placeholder="#강릉 #강릉여행 #PLAY강릉 #강릉맛집 ..."
              onChange={(e) => { setEditHashtagsStr(e.target.value); setIsDraftDirty(true); }}
            />


            {/* CTA 고정 미리보기 */}
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 space-y-1.5">
              <span className="text-[11px] font-bold text-violet-700">📢 공통 링크 문구 (항상 첨부)</span>
              <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed text-violet-800">
                {event?.link ? `🔗 원문보기 👉 ${event.link}\n` : ""}📍 강릉 더보기 👉 {contentPageUrl}
              </pre>
              <p className="text-[10px] text-violet-400">복사 시 문구에 자동 추가됩니다 (중복 시 생략).</p>
            </div>

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
          </div>

          {/* STEP 2 — 이미지 */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">② 사진</p>

            {/* 대표 이미지 */}
            <p className="text-xs font-semibold text-gray-600">대표 이미지</p>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                onClick={() => setImageTab("url")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${imageTab === "url" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Link className="w-3 h-3" />URL 입력
              </button>
              <button
                onClick={() => setImageTab("upload")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${imageTab === "upload" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Upload className="w-3 h-3" />파일 올리기
              </button>
            </div>
            {imageTab === "url" ? (
              <Input
                value={editThumbnail}
                onChange={(e) => { setEditThumbnail(e.target.value); setIsDirty(true); }}
                className="text-sm"
                placeholder="https://example.com/image.jpg"
              />
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                onClick={() => document.getElementById("img-file-input-0")?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleImageUpload(file, 0); }}
              >
                <input
                  id="img-file-input-0" type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file, 0); e.target.value = ""; }}
                />
                {isUploadingSlot === 0 ? (
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                    <p className="text-sm text-muted-foreground">업로드 중...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">클릭하거나 파일을 여기에 드래그</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG, WebP · 최대 20MB</p>
                  </div>
                )}
              </div>
            )}
            {editThumbnail && (
              <div className="rounded-xl overflow-hidden border bg-gray-50 max-h-48">
                <img src={editThumbnail} alt="대표 이미지" className="w-full h-full object-contain max-h-48"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            {editThumbnail && (
              <button
                className="flex items-center justify-center gap-1.5 w-full h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors"
                onClick={async () => {
                  const r = await fetch(`${BASE}/api/events/${eventId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ thumbnail: editThumbnail }),
                  });
                  if (!r.ok) { toast({ title: "저장 실패", variant: "destructive" }); return; }
                  toast({ title: "✅ 대표 이미지 저장 완료", description: "피드 카드에 바로 반영됩니다." });
                }}
              >
                <Download className="w-3.5 h-3.5" />대표 이미지 저장
              </button>
            )}

            {/* 추가 이미지 */}
            <div className="border-t border-dashed border-gray-200 pt-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600">추가 이미지 (최대 2장)</p>
              <div className="grid grid-cols-2 gap-2">
                {([1, 2] as const).map((slot) => (
                  <div key={slot} className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground font-medium">추가 {slot}</p>
                    <div
                      className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition-colors relative"
                      onClick={() => document.getElementById(`img-file-input-${slot}`)?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleImageUpload(file, slot); }}
                    >
                      <input
                        id={`img-file-input-${slot}`} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file, slot); e.target.value = ""; }}
                      />
                      {isUploadingSlot === slot ? (
                        <RefreshCw className="w-5 h-5 text-violet-500 animate-spin mx-auto" />
                      ) : editExtraImages[slot - 1] ? (
                        <img
                          src={editExtraImages[slot - 1]}
                          alt={`추가 이미지 ${slot}`}
                          className="w-full h-20 object-cover rounded-lg"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1 py-2">
                          <Upload className="w-5 h-5 text-gray-300" />
                          <p className="text-[11px] text-gray-400">클릭 또는 드래그</p>
                        </div>
                      )}
                    </div>
                    {editExtraImages[slot - 1] && (
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          <Input
                            value={editExtraImages[slot - 1]}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditExtraImages((prev) => {
                                const next: [string, string] = [...prev] as [string, string];
                                next[slot - 1] = val;
                                return next;
                              });
                              setIsDirty(true);
                            }}
                            className="text-[11px] h-7 flex-1"
                            placeholder="URL"
                          />
                          <button
                            onClick={() => {
                              setEditExtraImages((prev) => {
                                const next: [string, string] = [...prev] as [string, string];
                                next[slot - 1] = "";
                                return next;
                              });
                              setIsDirty(true);
                            }}
                            className="h-7 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-bold transition-colors"
                          >✕</button>
                        </div>
                        <button
                          className="flex items-center justify-center gap-1 w-full h-7 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold transition-colors"
                          onClick={async () => {
                            const imgUrl = editExtraImages[slot - 1];
                            const src = imgUrl.startsWith("/api/") ? `${BASE}${imgUrl}` : imgUrl;
                            try {
                              const r = await fetch(src, { credentials: "include" });
                              const blob = await r.blob();
                              const blobUrl = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = blobUrl; a.download = `photo-추가${slot}.jpg`; a.click();
                              setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                            } catch { window.open(src, "_blank"); }
                          }}
                        >
                          <Download className="w-3 h-3" />추가 {slot} 저장
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 3 — 동영상 */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">③ 동영상</p>
            <Input
              value={editVideoUrl}
              onChange={(e) => { setEditVideoUrl(e.target.value); setIsDirty(true); }}
              className="text-sm"
              placeholder="https://youtu.be/... 또는 MP4 직접 URL"
            />
            {editVideoUrl && (
              <div className="flex gap-2 items-center rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5">
                <Video className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="text-xs font-mono text-gray-600 flex-1 truncate">{editVideoUrl}</span>
                <button className="shrink-0 text-xs font-bold text-purple-600 hover:text-purple-800" onClick={copyVideoUrl}>
                  URL 복사
                </button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">유튜브·쇼츠는 임베드 / MP4는 플레이어 / 동영상은 URL 복사 후 앱에서 직접 업로드하세요.</p>
          </div>

          {/* 게시 가이드 */}
          <div className="space-y-2">
            {/* 페이스북 — 링크 미리보기 방식 */}
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 space-y-1.5">
              <p className="text-[11px] font-bold text-blue-700">📘 페이스북 — 링크 미리보기로 올리기</p>
              <p className="text-[11px] text-blue-600">사진 직접 업로드 ❌ → 클릭해도 Facebook 뷰어로만 열림</p>
              <p className="text-[11px] text-blue-600 font-semibold">✅ 올바른 방법:</p>
              <p className="text-[11px] text-blue-600">1. 아래 "PLAY강릉 링크 복사" 클릭</p>
              <p className="text-[11px] text-blue-600">2. 페이스북 게시창에 링크 붙여넣기</p>
              <p className="text-[11px] text-blue-600">3. 미리보기 카드(행사 사진+제목) 자동 생성 확인</p>
              <p className="text-[11px] text-blue-600">4. 링크 텍스트 지우고 문구 붙여넣기 → 게시</p>
              <p className="text-[11px] text-blue-500 italic">→ 독자가 사진 클릭 시 PLAY강릉 페이지로 이동!</p>
              <div className="flex gap-2 pt-0.5">
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors"
                  onClick={() => {
                    const contentUrl = `${window.location.origin}/content/${eventId}`;
                    navigator.clipboard.writeText(contentUrl).then(() =>
                      toast({ title: "PLAY강릉 링크 복사됨", description: "페이스북 게시창에 붙여넣으세요." })
                    );
                  }}
                >
                  🔗 PLAY강릉 링크 복사
                </button>
                <a
                  href="https://www.facebook.com/profile.php?id=61589314617028&locale=ko_KR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center h-8 rounded-lg text-[11px] font-bold text-white bg-[#1877F2] hover:bg-[#1565C0] transition-colors"
                >
                  페이스북 열기
                </a>
              </div>
            </div>

            {/* Meta Business Suite — 페북+인스타 동시 게시 */}
            <div className="rounded-xl bg-[#f0f2ff] border border-[#c7ccf5] px-4 py-3 space-y-1.5">
              <p className="text-[11px] font-bold text-[#3b5bdb]">🏢 Meta Business Suite — 페북 + 인스타 한 번에</p>
              <p className="text-[11px] text-[#4c6ef5] font-semibold">✅ 가장 빠른 방법 (PC 권장):</p>
              <p className="text-[11px] text-[#4c6ef5]">1. 위 "문구 전체 복사" 클릭</p>
              <p className="text-[11px] text-[#4c6ef5]">2. 아래 버튼 클릭 → 게시물 작성 창 열림</p>
              <p className="text-[11px] text-[#4c6ef5]">3. 캡션 붙여넣기 + 이미지 첨부 → 페북·인스타 동시 게시</p>
              <div className="flex gap-2 pt-0.5">
                <a
                  href="https://business.facebook.com/latest/composer?asset_id=1135888279600983&business_id=1004678568916594&ir_qe_exposed=1&nav_ref=internal_nav&ref=biz_web_content_manager_calendar_view&context_ref=CONTENT_CALENDAR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center h-8 rounded-lg text-[11px] font-bold text-white bg-[#3b5bdb] hover:bg-[#2f4ac4] transition-colors"
                >
                  Meta Business Suite 열기
                </a>
              </div>
            </div>

            {/* 인스타그램 — 이미지 업로드 방식 */}
            <div className="rounded-xl bg-pink-50 border border-pink-100 px-4 py-3 space-y-1.5">
              <p className="text-[11px] font-bold text-pink-700">📸 인스타그램 — 앱에서 올리기 (모바일)</p>
              <p className="text-[11px] text-pink-600">1. 위 "대표 이미지 다운로드" → 갤러리에 보관</p>
              <p className="text-[11px] text-pink-600">2. "문구 전체 복사" 클릭 (링크 포함)</p>
              <p className="text-[11px] text-pink-600">3. 인스타 앱 → 새 게시물 → 대표 이미지 선택</p>
              <p className="text-[11px] text-pink-600">4. 캡션란에 붙여넣기(길게 누르기) → 게시</p>
              <div className="flex gap-2 pt-0.5">
                <a
                  href="https://www.instagram.com/playgangneung/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center h-8 rounded-lg text-[11px] font-bold text-white bg-[#E1306C] hover:bg-[#C2185B] transition-colors"
                >
                  인스타그램 열기
                </a>
                <a
                  href="https://www.youtube.com/@playgangneung"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center h-8 rounded-lg text-[11px] font-bold text-white bg-[#FF0000] hover:bg-[#CC0000] transition-colors"
                >
                  유튜브 열기
                </a>
              </div>
            </div>
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
