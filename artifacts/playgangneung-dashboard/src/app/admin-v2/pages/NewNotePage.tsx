import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "../layout/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, ArrowLeft, Info } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

function extractTextFromContentBlocks(blocks: unknown[]): string {
  try {
    return blocks
      .map((block) => {
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.content === "string") return b.content;
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

// ─── 섹션 카드 래퍼 ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border bg-white shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b last:border-0 items-start">
      <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
      <div className="text-sm text-gray-800 flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── 스켈레톤 ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-60 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function NewNotePage() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(searchStr);
  const sourceId = params.get("sourceId") ?? "";

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

  const bodyDraft =
    event?.contentBlocks && Array.isArray(event.contentBlocks) && event.contentBlocks.length > 0
      ? extractTextFromContentBlocks(event.contentBlocks)
      : event?.description ?? "";

  return (
    <AdminLayout title="강릉노트 전환 미리보기">
      {/* 안내 배너 */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 mb-6">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800">저장 없는 미리보기 단계</p>
          <p className="text-xs text-blue-600 mt-0.5">
            이 화면은 수집함 항목을 강릉노트 초안으로 전환하기 전 미리보기입니다.
            아직 데이터를 변경하지 않으며, 저장 기능은 Phase 1-C2에서 구현됩니다.
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
          {/* ── 원본 정보 ── */}
          <SectionCard title="📥 원본 수집 정보">
            <div className="flex gap-5">
              {/* 썸네일 */}
              {event.thumbnail && (
                <div className="shrink-0">
                  <img
                    src={event.thumbnail}
                    alt="썸네일"
                    className="w-28 h-28 rounded-lg object-cover bg-gray-100 border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <FieldRow label="원본 제목">{event.title || "—"}</FieldRow>
                <FieldRow label="출처">{event.source || "—"}</FieldRow>
                <FieldRow label="원본 URL">
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
                  ) : (
                    "—"
                  )}
                </FieldRow>
                <FieldRow label="수집일">
                  {formatDate(event.crawledAt || event.updatedAt)}
                </FieldRow>
                <FieldRow label="카테고리">
                  <Badge variant="outline" className="text-xs font-normal">
                    {event.category}
                  </Badge>
                </FieldRow>
              </div>
            </div>
          </SectionCard>

          {/* ── 강릉노트 초안 ── */}
          <SectionCard title="📝 강릉노트 초안 (미리보기)">
            <div className="space-y-0">
              <FieldRow label="제목">
                <span className="font-medium">{event.title || "—"}</span>
              </FieldRow>
              <FieldRow label="한 줄 요약">
                {event.description
                  ? event.description.slice(0, 120) + (event.description.length > 120 ? "…" : "")
                  : "—"}
              </FieldRow>
              <FieldRow label="카테고리">
                <Badge variant="secondary" className="text-xs">
                  {event.category}
                </Badge>
              </FieldRow>
              <FieldRow label="대표 이미지">
                {event.thumbnail ? (
                  <div className="mt-1">
                    <img
                      src={event.thumbnail}
                      alt="대표 이미지"
                      className="h-36 rounded-lg object-cover border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <span className="text-gray-400 text-xs">이미지 없음</span>
                )}
              </FieldRow>
              <FieldRow label="출처 URL">
                {event.link ? (
                  <a
                    href={event.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    원본 보기
                  </a>
                ) : (
                  <span className="text-gray-400 text-xs">없음</span>
                )}
              </FieldRow>
              <FieldRow label="본문 초안">
                {bodyDraft ? (
                  <div className="mt-1 rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {bodyDraft}
                  </div>
                ) : (
                  <span className="text-gray-400 text-xs">본문 내용 없음</span>
                )}
              </FieldRow>
            </div>
          </SectionCard>

          {/* ── 버튼 영역 ── */}
          <div className="rounded-xl border bg-white shadow-sm p-5 flex flex-wrap items-center gap-3">
            <Button
              className="bg-orange-600 hover:bg-orange-600 opacity-50 cursor-not-allowed"
              disabled
              title="Phase 1-C2에서 구현 예정"
            >
              저장하기
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/v2/inbox")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              취소 — 수집함으로 돌아가기
            </Button>
            <span className="text-xs text-gray-400 ml-auto">
              * 저장 기능은 Phase 1-C2에서 구현 예정입니다.
            </span>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
