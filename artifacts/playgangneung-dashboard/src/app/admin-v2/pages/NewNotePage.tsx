import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "../layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, ArrowLeft, Save, Info, CheckCircle2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORY_OPTIONS = ["행사", "맛집", "핫플", "지역소식"];

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface EventItem {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceType: string;
  category: string;
  status: string;
  thumbnail: string | null;
  link: string;
  crawledAt: string;
  updatedAt: string;
  scheduleStatus: string;
  contentBlocks?: unknown[] | null;
}

interface EventDetailResponse {
  success: boolean;
  event: EventItem;
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function formatDate(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw.slice(0, 10) || "—";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

/** ContentBlocks → 편집 가능한 텍스트로 추출 */
function extractTextFromBlocks(blocks: unknown[]): string {
  try {
    return blocks
      .map((block) => {
        const b = block as Record<string, unknown>;
        // 레거시 포맷: { type: "text", content: "..." }
        if (b.type === "text" && typeof b.content === "string") return b.content;
        // BlockNote 포맷: { content: [{type:"text", text:"..."}] }
        if (Array.isArray(b.content)) {
          return (b.content as Array<Record<string, unknown>>)
            .map((c) => (typeof c.text === "string" ? c.text : ""))
            .join("");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return "";
  }
}

/** 텍스트 → BlockNote 호환 paragraph 배열로 변환 */
function textToBlockNoteContent(text: string): object[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) {
    return [{
      id: "p-1",
      type: "paragraph",
      props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [{ type: "text", text: "", styles: {} }],
      children: [],
    }];
  }
  return paragraphs.map((p, i) => ({
    id: `p-${i + 1}`,
    type: "paragraph",
    props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: [{ type: "text", text: p.trim(), styles: {} }],
    children: [],
  }));
}

// ─── 섹션 카드 ─────────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ReadOnlyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b last:border-0 items-start">
      <span className="text-xs text-gray-400 w-24 shrink-0 pt-1">{label}</span>
      <div className="text-sm text-gray-700 flex-1 min-w-0">{children}</div>
    </div>
  );
}

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b last:border-0 items-start">
      <span className="text-xs text-gray-500 w-24 shrink-0 font-medium pt-2">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── 스켈레톤 ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function NewNotePage() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = new URLSearchParams(searchStr);
  const sourceId = params.get("sourceId") ?? "";

  // ── 편집 폼 상태 ──
  const [title, setTitle]         = useState("");
  const [summary, setSummary]     = useState("");
  const [category, setCategory]   = useState("지역소식");
  const [thumbnail, setThumbnail] = useState("");
  const [source, setSource]       = useState("");
  const [link, setLink]           = useState("");
  const [bodyText, setBodyText]   = useState("");
  const [saved, setSaved]         = useState(false);

  // ── 원본 데이터 조회 ──
  const { data, isLoading, isError } = useQuery<EventDetailResponse>({
    queryKey: ["admin-v2-event-detail", sourceId],
    queryFn: async () => {
      if (!sourceId) throw new Error("sourceId 없음");
      const res = await fetch(`${BASE}/api/events/${encodeURIComponent(sourceId)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("이벤트 조회 실패");
      return res.json() as Promise<EventDetailResponse>;
    },
    enabled: !!sourceId,
    staleTime: 60_000,
  });

  const event = data?.event;

  // ── 폼 초기화 (데이터 로드 시 1회) ──
  useEffect(() => {
    if (!event) return;
    setTitle(event.title ?? "");
    setSummary(event.description ?? "");
    setCategory(event.category ?? "지역소식");
    setThumbnail(event.thumbnail ?? "");
    setSource(event.source ?? "");
    setLink(event.link ?? "");

    const blockText =
      event.contentBlocks && Array.isArray(event.contentBlocks) && event.contentBlocks.length > 0
        ? extractTextFromBlocks(event.contentBlocks)
        : event.description ?? "";
    setBodyText(blockText);
    setSaved(false);
  }, [event?.id]); // event.id 기준으로 1회만 초기화

  // ── 저장 mutation ──
  const { mutate: saveNote, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const contentBlocks = textToBlockNoteContent(bodyText);
      const body: Record<string, unknown> = {
        title,
        description: summary,
        category,
        source,
        link,
        contentBlocks,
      };
      // thumbnail: 빈 문자열이면 null로, 값 있으면 그대로
      body.thumbnail = thumbnail.trim() || null;

      // status는 전혀 보내지 않음 → 기존 상태 유지

      const res = await fetch(`${BASE}/api/events/${encodeURIComponent(sourceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "저장 실패");
      }
      return res.json() as Promise<{ success: boolean; id: string }>;
    },
    onSuccess: () => {
      setSaved(true);
      toast({
        title: "강릉노트 초안이 저장되었습니다.",
        description: "status는 변경되지 않았습니다. 계속 편집하거나 수집함으로 돌아가세요.",
      });
      // 수집함 캐시 무효화 (다음 방문 시 최신 데이터)
      queryClient.invalidateQueries({ queryKey: ["admin-v2-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["admin-v2-event-detail", sourceId] });
    },
    onError: (err: Error) => {
      toast({
        title: "저장 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AdminLayout title="강릉노트 초안 편집">
      {/* 안내 배너 */}
      <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 mb-6">
        <Info className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-orange-800">초안 저장 단계</p>
          <p className="text-xs text-orange-600 mt-0.5">
            수집함 항목에 강릉노트 초안을 저장합니다.
            저장해도 공개 상태가 바뀌지 않으며, 홈에 노출되지 않습니다.
            status는 현재 상태를 그대로 유지합니다.
          </p>
        </div>
      </div>

      {!sourceId ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-red-500">
          sourceId 파라미터가 없습니다. 수집함에서 항목을 선택해 주세요.
        </div>
      ) : isLoading ? (
        <PageSkeleton />
      ) : isError || !event ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-red-500">
          데이터를 불러오지 못했습니다. 항목이 존재하지 않거나 API 서버를 확인해 주세요.
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── 저장 완료 배너 ── */}
          {saved && (
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-sm text-green-800 font-medium">
                초안이 저장되었습니다. 계속 편집하거나 수집함으로 돌아가세요.
              </p>
            </div>
          )}

          {/* ── 원본 정보 (읽기 전용) ── */}
          <SectionCard title="📥 원본 수집 정보 (읽기 전용)">
            <div className="flex gap-5">
              {event.thumbnail && (
                <div className="shrink-0">
                  <img
                    src={event.thumbnail}
                    alt="원본 썸네일"
                    className="w-24 h-24 rounded-lg object-cover bg-gray-100 border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <ReadOnlyRow label="원본 제목">
                  <span className="font-medium">{event.title || "—"}</span>
                </ReadOnlyRow>
                <ReadOnlyRow label="출처">{event.source || "—"}</ReadOnlyRow>
                <ReadOnlyRow label="원본 URL">
                  {event.link ? (
                    <a
                      href={event.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm truncate max-w-full"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{event.link}</span>
                    </a>
                  ) : "—"}
                </ReadOnlyRow>
                <ReadOnlyRow label="수집일">
                  {formatDate(event.crawledAt || event.updatedAt)}
                </ReadOnlyRow>
                <ReadOnlyRow label="현재 status">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {event.status}
                  </Badge>
                  <span className="text-xs text-gray-400 ml-2">(저장 후에도 변경 안 됨)</span>
                </ReadOnlyRow>
              </div>
            </div>
          </SectionCard>

          {/* ── 강릉노트 초안 편집 ── */}
          <SectionCard title="✏️ 강릉노트 초안 편집">
            <div>
              <EditRow label="제목">
                <Input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
                  placeholder="강릉노트 제목"
                  className="text-sm"
                />
              </EditRow>

              <EditRow label="한 줄 요약">
                <Input
                  value={summary}
                  onChange={(e) => { setSummary(e.target.value); setSaved(false); }}
                  placeholder="한 줄 요약 (description)"
                  className="text-sm"
                />
              </EditRow>

              <EditRow label="카테고리">
                <Select
                  value={category}
                  onValueChange={(v) => { setCategory(v); setSaved(false); }}
                >
                  <SelectTrigger className="w-40 text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EditRow>

              <EditRow label="대표 이미지 URL">
                <Input
                  value={thumbnail}
                  onChange={(e) => { setThumbnail(e.target.value); setSaved(false); }}
                  placeholder="https://... (비우면 이미지 없음으로 저장)"
                  className="text-sm font-mono text-xs"
                />
                {thumbnail && (
                  <img
                    src={thumbnail}
                    alt="미리보기"
                    className="mt-2 h-28 rounded-lg object-cover border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
              </EditRow>

              <EditRow label="출처">
                <Input
                  value={source}
                  onChange={(e) => { setSource(e.target.value); setSaved(false); }}
                  placeholder="출처명"
                  className="text-sm"
                />
              </EditRow>

              <EditRow label="원본 URL">
                <Input
                  value={link}
                  onChange={(e) => { setLink(e.target.value); setSaved(false); }}
                  placeholder="https://..."
                  className="text-sm font-mono text-xs"
                />
              </EditRow>

              <EditRow label="본문 초안">
                <Textarea
                  value={bodyText}
                  onChange={(e) => { setBodyText(e.target.value); setSaved(false); }}
                  placeholder="본문 내용을 입력하세요. 단락은 빈 줄로 구분합니다."
                  rows={10}
                  className="text-sm leading-relaxed resize-y"
                />
                <p className="text-xs text-gray-400 mt-1">
                  빈 줄로 구분된 단락이 BlockNote paragraph 블록으로 저장됩니다.
                </p>
              </EditRow>
            </div>
          </SectionCard>

          {/* ── 버튼 영역 ── */}
          <div className="rounded-xl border bg-white shadow-sm p-5 flex flex-wrap items-center gap-3">
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => saveNote()}
              disabled={isSaving || !title.trim()}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {isSaving ? "저장 중..." : "초안 저장하기"}
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/admin/v2/inbox")}
              disabled={isSaving}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              수집함으로 돌아가기
            </Button>

            <div className="ml-auto flex flex-col items-end gap-1">
              <span className="text-xs text-gray-400">
                * 저장 후 status는 변경되지 않습니다.
              </span>
              <span className="text-xs text-gray-300">
                공개/SNS 발행은 별도 단계에서 진행합니다.
              </span>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
