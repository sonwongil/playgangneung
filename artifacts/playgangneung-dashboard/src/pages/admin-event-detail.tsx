import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, ExternalLink, ImageOff, Trash2, ChevronDown, ChevronUp,
  Send, Download, RefreshCw, Upload, Link, Sparkles, Check, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyImg(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/")) return `${BASE}${url}`;
  return `${BASE}/api/proxy/image?url=${encodeURIComponent(url)}`;
}

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
  hashtags?: string[] | null;
  contentBlocks?: unknown[] | null;
  status: string;
  crawledAt: string;
}

const CATEGORIES = ["강릉소식", "행사안내", "스토리", "영상", "행사", "맛집", "핫플", "지역소식"];

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

// ── BlockNote 안전 정규화 ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBlockNoteContent(blocks: unknown): any[] | undefined {
  try {
    if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valid = (blocks as any[]).every((b) =>
      b && typeof b === "object" &&
      typeof b.id === "string" &&
      typeof b.type === "string" &&
      "props" in b &&
      Array.isArray(b.content) &&
      Array.isArray(b.children)
    );
    if (!valid) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return blocks as any[];
  } catch {
    return undefined;
  }
}

// ── BlockNote 초안 블록 생성 ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeParagraph(text: string): any {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: text ? [{ type: "text", text, styles: {} }] : [],
    children: [],
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeHeading(text: string, level: 1 | 2 | 3 = 2): any {
  return {
    id: crypto.randomUUID(),
    type: "heading",
    props: { level, textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeBullet(text: string): any {
  return {
    id: crypto.randomUUID(),
    type: "bulletListItem",
    props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: [{ type: "text", text, styles: {} }],
    children: [],
  };
}

function buildDraftBlocks(data: {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  contact?: string;
  source?: string;
  link?: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks: any[] = [];

  if (data.title) blocks.push(makeHeading(data.title, 1));

  const infoItems: string[] = [];
  if (data.startDate) {
    const dateStr = data.endDate ? `${data.startDate} ~ ${data.endDate}` : data.startDate;
    infoItems.push(`일정: ${dateStr}`);
  }
  if (data.location) infoItems.push(`장소: ${data.location}`);
  if (data.contact) infoItems.push(`문의: ${data.contact}`);
  if (data.source) infoItems.push(`출처: ${data.source}`);

  if (infoItems.length > 0) {
    blocks.push(makeHeading("핵심 정보", 2));
    infoItems.forEach((item) => blocks.push(makeBullet(item)));
  }

  if (data.description && data.description.trim().length > 0) {
    blocks.push(makeHeading("소개", 2));
    blocks.push(makeParagraph(data.description.trim()));
  }

  blocks.push(makeHeading("방문 전 참고사항", 2));
  blocks.push(makeParagraph("운영 내용은 변경될 수 있으니 원본을 확인해 주세요."));

  if (data.link) {
    blocks.push(makeHeading("원본 보기", 2));
    blocks.push(makeParagraph(data.link));
  }

  return blocks;
}

// ── BlockNote ErrorBoundary ──
interface BNErrorState { hasError: boolean }
class BlockNoteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BNErrorState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): BNErrorState {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.error("[BlockNote] 에디터 오류:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          에디터를 불러올 수 없습니다. 새로고침 후 다시 시도해 주세요.
        </div>
      );
    }
    return this.props.children;
  }
}

// ── BlockNote 에디터 래퍼 ──
// initialContent는 useRef로 동결 → useCreateBlockNote가 매 렌더마다 재초기화되지 않음
function BlockNoteEditorWrapper({
  initialContent,
  onDirty,
  editorRef,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialContent: any[] | undefined;
  onDirty: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editorRef: React.MutableRefObject<any>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frozenContent = useRef<any[] | undefined>(initialContent);

  const editor = useCreateBlockNote({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: frozenContent.current as any,
  });

  useEffect(() => {
    editorRef.current = editor;
    return () => { editorRef.current = null; };
  }, [editor, editorRef]);

  const handleChange = useCallback(() => { onDirty(); }, [onDirty]);

  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      onChange={handleChange}
    />
  );
}

export default function AdminEventDetail() {
  const [, params] = useRoute("/admin/events/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const eventId = params?.id ?? "";

  // ── 편집 상태 ──
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editThumbnail, setEditThumbnail] = useState("");
  const [editExtraImages, setEditExtraImages] = useState<string[]>(["", ""]);
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editEventHashtags, setEditEventHashtags] = useState("");
  const [inited, setInited] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isUploadingSlot, setIsUploadingSlot] = useState<number | null>(null);
  const [imageTab, setImageTab] = useState<"url" | "upload">("url");

  // ── UI 상태 ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  // ── BlockNote 상태 ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [blockNoteInitial, setBlockNoteInitial] = useState<any[] | undefined>(undefined);
  const [blockNoteKey, setBlockNoteKey] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blockNoteEditorRef = useRef<any>(null);
  const onBlockNoteDirty = useCallback(() => setIsDirty(true), []);

  // 자동 추출 후 확인 대기 초안
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingDraft, setPendingDraft] = useState<any[] | null>(null);

  // ── 데이터 조회 ──
  const { data, isLoading } = useQuery<{ success: boolean; event: Event }>({
    queryKey: ["admin-event", eventId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/events/${eventId}`, { credentials: "include" });
      if (!r.ok) throw new Error("로드 실패");
      return r.json();
    },
    enabled: !!eventId,
  });

  const event = data?.event ?? null;

  useEffect(() => {
    if (event && !inited) {
      setEditTitle(event.title);
      setEditDescription(event.description ?? "");
      setEditContact(event.contact ?? "");
      setEditCategory(event.category ?? "강릉소식");
      setEditStartDate(event.startDate ?? event.date ?? "");
      setEditEndDate(event.endDate ?? "");
      setEditThumbnail(event.thumbnail ?? "");
      setEditExtraImages(
        event.extraImages && event.extraImages.length > 0
          ? [...event.extraImages]
          : ["", ""],
      );
      setEditVideoUrl(event.videoUrl ?? "");
      setEditLink(event.link ?? "");
      setEditSource(event.source ?? "");
      setEditLocation(event.location ?? "");
      setEditEventHashtags((event.hashtags ?? []).join(", "));
      setBlockNoteInitial(normalizeBlockNoteContent(event.contentBlocks));
      setInited(true);
    }
  }, [event, inited]);

  // ── URL 자동 추출 ──
  async function handleExtractUrl() {
    const url = editLink.trim();
    if (!url) { toast({ title: "원본 링크를 먼저 입력해 주세요.", variant: "destructive" }); return; }
    setIsExtracting(true);
    try {
      const r = await fetch(`${BASE}/api/events/extract-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "추출 실패");

      if (d.title) setEditTitle(d.title);
      if (d.description) setEditDescription(d.description);
      if (d.thumbnail) setEditThumbnail(d.thumbnail);
      if (d.startDate) setEditStartDate(d.startDate);
      if (d.endDate) setEditEndDate(d.endDate);
      if (d.location) setEditLocation(d.location);
      setIsDirty(true);

      const draft = buildDraftBlocks({
        title: d.title || editTitle,
        description: d.description || editDescription,
        startDate: d.startDate || editStartDate,
        endDate: d.endDate || editEndDate,
        location: d.location || editLocation,
        contact: editContact,
        source: editSource,
        link: url,
      });

      // 현재 에디터에 내용이 있으면 확인 대기
      const currentDoc = blockNoteEditorRef.current?.document;
      const hasCurrentContent =
        currentDoc && Array.isArray(currentDoc) &&
        currentDoc.some((b: { type: string; content?: unknown[] }) =>
          b.type !== "paragraph" ||
          (Array.isArray(b.content) && b.content.length > 0)
        );

      if (hasCurrentContent) {
        setPendingDraft(draft);
        toast({ title: "추출 완료 — 본문 초안 적용 여부를 선택해 주세요." });
      } else {
        setBlockNoteInitial(draft);
        setBlockNoteKey((k) => k + 1);
        toast({ title: "추출 완료 — 본문 초안이 자동 생성됐습니다." });
      }
    } catch (e: unknown) {
      toast({
        title: "추출 실패",
        description: e instanceof Error ? e.message : "다시 시도해 주세요.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  }

  function applyPendingDraft() {
    if (!pendingDraft) return;
    setBlockNoteInitial(pendingDraft);
    setBlockNoteKey((k) => k + 1);
    setPendingDraft(null);
    setIsDirty(true);
  }

  // ── 저장 ──
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
          link: editLink || undefined,
          source: editSource || undefined,
          location: editLocation || undefined,
          hashtags: editEventHashtags
            .split(/[\s,]+/)
            .map((h) => h.replace(/^#/, "").trim())
            .filter(Boolean),
          contentBlocks: (() => {
            const doc = blockNoteEditorRef.current?.document;
            return doc && doc.length > 0 ? doc : null;
          })(),
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
      qc.invalidateQueries({ queryKey: ["admin-event", eventId] });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  // ── 이미지 업로드 ──
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
          const next = [...prev];
          while (next.length < slot) next.push("");
          next[slot - 1] = d.imageUrl;
          return next;
        });
      }
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ["admin-event", eventId] });
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      toast({ title: "이미지 업로드 완료", description: slot === 0 ? "대표 이미지가 적용되었습니다." : `추가 이미지 ${slot}이 적용되었습니다.` });
    } catch (e: unknown) {
      toast({ title: "업로드 실패", description: e instanceof Error ? e.message : "다시 시도해 주세요.", variant: "destructive" });
    } finally {
      setIsUploadingSlot(null);
    }
  }

  // ── 삭제 ──
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/events/${eventId}`, { method: "DELETE" });
      if (!r.ok) throw new Error("삭제 실패");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "삭제 완료" });
      qc.invalidateQueries({ queryKey: ["admin-event", eventId] });
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
      {/* ── 헤더 ── */}
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
        <div className="flex items-center gap-2 shrink-0">
          {isPublished && (
            <a
              href={`/content/${eventId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />강릉노트
            </a>
          )}
          <Button
            size="sm" variant="ghost"
            className="gap-1.5 text-destructive hover:text-destructive/80"
            disabled={deleteMutation.isPending}
            onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate(); }}
          >
            <Trash2 className="w-3.5 h-3.5" />삭제
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── 썸네일 미리보기 ── */}
        {(editThumbnail || event.thumbnail) ? (
          <div className="rounded-2xl overflow-hidden border border-border shadow-sm bg-black">
            <img src={proxyImg(editThumbnail || event.thumbnail)} alt={event.title} className="w-full max-h-72 object-contain"
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

        {/* ── 강릉노트 편집 카드 ── */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">강릉노트 편집</p>

          {/* 원본 링크 + 자동 추출 */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">원본 링크</Label>
            <div className="flex gap-2">
              <Input
                type="url"
                value={editLink}
                onChange={(e) => { setEditLink(e.target.value); setIsDirty(true); }}
                className="text-sm flex-1"
                placeholder="https://example.com/article"
              />
              <button
                type="button"
                disabled={isExtracting || !editLink.trim()}
                onClick={handleExtractUrl}
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold transition-colors shrink-0"
              >
                {isExtracting
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <Sparkles className="w-3.5 h-3.5" />}
                {isExtracting ? "추출 중..." : "URL 자동 추출"}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              링크를 입력하고 추출하면 제목·이미지·설명·날짜·장소가 자동으로 채워지고 본문 초안이 생성됩니다.
            </p>
          </div>

          {/* 제목 */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">제목</Label>
            <Input
              value={editTitle}
              onChange={(e) => { setEditTitle(e.target.value); setIsDirty(true); }}
              className="text-sm"
              placeholder="제목"
            />
          </div>

          {/* 카테고리 */}
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

          {/* ── 강릉노트 본문 에디터 (BlockNote) ── */}
          <div className="border-2 border-blue-200 rounded-xl bg-blue-50/40 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-blue-800 font-bold">
                  📝 강릉노트 본문 에디터
                </Label>
                <p className="text-[11px] text-blue-600 mt-0.5">
                  /content 페이지에서 <b>간단 설명 대신</b> 표시됩니다. URL 자동 추출로 초안을 생성하고 자유롭게 수정하세요.
                </p>
              </div>
              {blockNoteInitial !== undefined && !pendingDraft && (
                <button
                  type="button"
                  onClick={() => {
                    setBlockNoteInitial(undefined);
                    setBlockNoteKey((k) => k + 1);
                    setIsDirty(true);
                  }}
                  className="text-[11px] text-red-500 hover:text-red-700 transition-colors flex-shrink-0 ml-2"
                >
                  초기화
                </button>
              )}
            </div>

            {/* 초안 적용 확인 배너 */}
            {pendingDraft && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 flex items-center justify-between gap-2">
                <p className="text-xs text-amber-800 font-medium">
                  자동 추출 초안이 준비됐습니다. 현재 본문을 덮어쓸까요?
                </p>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={applyPendingDraft}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
                  >
                    <Check className="w-3 h-3" />적용
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDraft(null)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium transition-colors"
                  >
                    <X className="w-3 h-3" />기존 유지
                  </button>
                </div>
              </div>
            )}

            {inited && (
              <BlockNoteErrorBoundary>
                <div className="rounded-lg border border-blue-200 bg-white" style={{ minHeight: 220 }}>
                  <BlockNoteEditorWrapper
                    key={blockNoteKey}
                    initialContent={blockNoteInitial}
                    onDirty={onBlockNoteDirty}
                    editorRef={blockNoteEditorRef}
                  />
                </div>
              </BlockNoteErrorBoundary>
            )}
          </div>

          {/* ── 저장 버튼 ── */}
          <Button
            className="w-full gap-2 h-11 font-bold bg-green-600 hover:bg-green-700 text-white"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Send className="w-4 h-4" />
            {saveMutation.isPending ? "저장 중..." : isDirty ? "저장 & 공개" : isPublished ? "공개 중 (다시 저장)" : "저장 & 공개"}
          </Button>

          {isPublished && (
            <button
              onClick={() => { window.location.href = `/content/${eventId}`; }}
              className="flex items-center justify-center gap-2 w-full h-10 rounded-xl border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              강릉노트에서 SNS 공유하기
            </button>
          )}

          {/* ── 추가 정보 (접힘) ── */}
          <div className="border-t border-dashed border-gray-200 pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors py-1"
            >
              <span>추가 정보 (날짜 · 장소 · 이미지 · 해시태그 등)</span>
              {showAdvanced
                ? <ChevronUp className="w-4 h-4" />
                : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4">

                {/* 시작일 / 종료일 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">시작일</Label>
                    <Input
                      value={editStartDate}
                      onChange={(e) => { setEditStartDate(e.target.value); setIsDirty(true); }}
                      className="text-sm"
                      placeholder="예: 2025.05.10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">종료일 (선택)</Label>
                    <Input
                      value={editEndDate}
                      onChange={(e) => { setEditEndDate(e.target.value); setIsDirty(true); }}
                      className="text-sm"
                      placeholder="비워두면 당일 행사"
                    />
                  </div>
                </div>

                {/* 장소 / 문의 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">장소/주소</Label>
                    <Input
                      value={editLocation}
                      onChange={(e) => { setEditLocation(e.target.value); setIsDirty(true); }}
                      className="text-sm"
                      placeholder="예: 강릉시 남대천 행사장"
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
                </div>

                {/* 출처 / 해시태그 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">출처 / 업체명</Label>
                    <Input
                      value={editSource}
                      onChange={(e) => { setEditSource(e.target.value); setIsDirty(true); }}
                      className="text-sm"
                      placeholder="예: 강릉시청"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">해시태그</Label>
                    <Input
                      value={editEventHashtags}
                      onChange={(e) => { setEditEventHashtags(e.target.value); setIsDirty(true); }}
                      className="text-sm"
                      placeholder="강릉행사, 가족체험"
                    />
                  </div>
                </div>

                {/* 간단 설명 */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">간단 설명 (공유 미리보기 · 본문 없을 때 표시)</Label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setEditDescription(e.target.value); setIsDirty(true); }}
                    className="text-sm resize-none flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="내용을 입력하세요."
                  />
                </div>

                {/* 대표 이미지 */}
                <div className="space-y-2.5">
                  <Label className="text-xs text-muted-foreground">대표 이미지</Label>
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
                      <img src={proxyImg(editThumbnail)} alt="대표 이미지" className="w-full h-full object-contain max-h-48"
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
                </div>

                {/* 추가 이미지 */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">추가 이미지 (최대 2장)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([1, 2] as const).map((slot) => (
                      <div key={slot} className="space-y-1.5">
                        <p className="text-[11px] text-muted-foreground font-medium">추가 {slot}</p>
                        <div
                          className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                          onClick={() => document.getElementById(`img-file-input-${slot}`)?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleImageUpload(file, slot); }}
                        >
                          <input
                            id={`img-file-input-${slot}`} type="file" accept="image/*" className="hidden"
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file, slot); e.target.value = ""; }}
                          />
                          {isUploadingSlot === slot ? (
                            <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mx-auto" />
                          ) : editExtraImages[slot - 1] ? (
                            <img
                              src={proxyImg(editExtraImages[slot - 1])}
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
                          <div className="flex gap-1">
                            <Input
                              value={editExtraImages[slot - 1]}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditExtraImages((prev) => {
                                  const next = [...prev];
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
                                  const next = [...prev];
                                  next[slot - 1] = "";
                                  return next;
                                });
                                setIsDirty(true);
                              }}
                              className="h-7 px-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-bold transition-colors"
                            >✕</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {editExtraImages.slice(2).map((url, i) => (
                    <div key={i + 2} className="flex gap-1">
                      <Input
                        value={url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditExtraImages((prev) => {
                            const next = [...prev];
                            next[i + 2] = val;
                            return next;
                          });
                          setIsDirty(true);
                        }}
                        className="text-[11px] h-8 flex-1"
                        placeholder={`추가 이미지 ${i + 3} URL`}
                      />
                      <button
                        onClick={() => {
                          setEditExtraImages((prev) => prev.filter((_, idx) => idx !== i + 2));
                          setIsDirty(true);
                        }}
                        className="h-8 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-bold transition-colors"
                      >✕</button>
                    </div>
                  ))}
                  <button
                    onClick={() => { setEditExtraImages((prev) => [...prev, ""]); setIsDirty(true); }}
                    className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-dashed border-gray-300 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors"
                  >+ 추가 이미지 URL 더 추가</button>
                </div>

                {/* 동영상 URL */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">동영상 URL (선택)</Label>
                  <Input
                    value={editVideoUrl}
                    onChange={(e) => { setEditVideoUrl(e.target.value); setIsDirty(true); }}
                    className="text-sm"
                    placeholder="https://youtu.be/... 또는 MP4 직접 URL"
                  />
                  <p className="text-[11px] text-muted-foreground">유튜브·쇼츠는 임베드 / MP4는 플레이어로 자동 표시됩니다.</p>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* ── 원본 링크 미리보기 ── */}
        {event.link && (
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold">원본 링크</p>
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />열기
              </a>
            </div>
            <OriginalPreview url={event.link} base={BASE} />
          </div>
        )}

      </div>
    </div>
  );
}
