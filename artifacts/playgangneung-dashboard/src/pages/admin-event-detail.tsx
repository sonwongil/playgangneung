import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ExternalLink, ImageOff, Trash2, ChevronDown, Send, Download, RefreshCw, Upload, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
          link: editLink || undefined,
          source: editSource || undefined,
          location: editLocation || undefined,
          hashtags: editEventHashtags
            .split(/[\s,]+/)
            .map((h) => h.replace(/^#/, "").trim())
            .filter(Boolean),
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
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      toast({ title: "이미지 업로드 완료", description: slot === 0 ? "대표 이미지가 적용되었습니다." : `추가 이미지 ${slot}이 적용되었습니다.` });
    } catch (e: unknown) {
      toast({ title: "업로드 실패", description: e instanceof Error ? e.message : "다시 시도해 주세요.", variant: "destructive" });
    } finally {
      setIsUploadingSlot(null);
    }
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
        <div className="flex items-center gap-2 shrink-0">
          {isPublished && (
            <a
              href={`/content/${eventId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />강릉노트 보기
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

        {/* 썸네일 미리보기 */}
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

        {/* 강릉노트 내용 편집 */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <p className="text-sm font-semibold text-foreground">강릉노트 내용</p>

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
            <Label className="text-xs text-muted-foreground">장소/주소</Label>
            <Input
              value={editLocation}
              onChange={(e) => { setEditLocation(e.target.value); setIsDirty(true); }}
              className="text-sm"
              placeholder="예: 강릉시 남대천 행사장 일대"
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
            <Label className="text-xs text-muted-foreground">원본 링크</Label>
            <Input
              type="url"
              value={editLink}
              onChange={(e) => { setEditLink(e.target.value); setIsDirty(true); }}
              className="text-sm"
              placeholder="https://example.com/article"
            />
          </div>

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
              <Label className="text-xs text-muted-foreground">해시태그 (강릉노트 표시용)</Label>
              <Input
                value={editEventHashtags}
                onChange={(e) => { setEditEventHashtags(e.target.value); setIsDirty(true); }}
                className="text-sm"
                placeholder="강릉행사, 가족체험, 주말나들이"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">상세 내용</Label>
            <textarea
              rows={6}
              value={editDescription}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setEditDescription(e.target.value); setIsDirty(true); }}
              className="text-sm resize-none flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="내용을 입력하세요."
            />
          </div>

          {/* 대표 이미지 */}
          <div className="border-t border-dashed border-gray-200 pt-4 space-y-2.5">
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
          <div className="border-t border-dashed border-gray-200 pt-4 space-y-2">
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
            {/* 추가 이미지 URL 3번 이상 */}
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
          <div className="border-t border-dashed border-gray-200 pt-4 space-y-2">
            <Label className="text-xs text-muted-foreground">동영상 URL (선택)</Label>
            <Input
              value={editVideoUrl}
              onChange={(e) => { setEditVideoUrl(e.target.value); setIsDirty(true); }}
              className="text-sm"
              placeholder="https://youtu.be/... 또는 MP4 직접 URL"
            />
            <p className="text-[11px] text-muted-foreground">유튜브·쇼츠는 임베드 / MP4는 플레이어로 자동 표시됩니다.</p>
          </div>

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
        </div>

        {/* 원본 링크 */}
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
