import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "../layout/AdminLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink,
  Search,
  Plus,
  X,
  FileText,
  FileX,
  Info,
  CalendarDays,
  Save,
  CheckCircle2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── KST 오늘 날짜 ────────────────────────────────────────────────────────────

function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 3_600_000);
  return kst.toISOString().slice(0, 10);
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface EventItem {
  id: string;
  title: string;
  description: string;
  source: string;
  category: string;
  status: string;
  thumbnail: string | null;
  link: string;
  updatedAt: string;
  contentBlocks?: unknown[] | null;
}

interface EventsResponse {
  success: boolean;
  total: number;
  events: EventItem[];
}

interface Top5Item {
  rank: number;
  eventId: string;
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  category: string;
  source: string;
  link: string;
}

interface Top5Response {
  date: string;
  items: Top5Item[];
  isHistorical?: boolean;
  top5Date?: string;
}

/** 슬롯에 표시할 미니 이벤트 정보 */
interface SlotEvent {
  id: string;
  title: string;
  thumbnail: string | null;
  category: string;
  source: string;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const MAX_SLOTS = 5;
const STATUS_LABELS: Record<string, string> = {
  draft:     "수집됨",
  approved:  "승인됨",
  rejected:  "제외됨",
  published: "발행됨",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft:     "secondary",
  approved:  "default",
  rejected:  "destructive",
  published: "outline",
};
const CATEGORY_OPTIONS = ["전체", "행사", "맛집", "핫플", "지역소식"];

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function formatDate(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw.slice(0, 10) || "—";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

function hasBlocks(blocks: unknown[] | null | undefined): boolean {
  return Array.isArray(blocks) && blocks.length > 0;
}

// ─── 스켈레톤 ─────────────────────────────────────────────────────────────────

function SlotSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

// ─── 슬롯 카드 ────────────────────────────────────────────────────────────────

function SlotCard({
  rank,
  item,
  onRemove,
}: {
  rank: number;
  item: SlotEvent | null;
  onRemove: () => void;
}) {
  if (!item) {
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 min-h-[64px]">
        <span className="text-sm font-bold text-gray-300 w-6 text-center">{rank}</span>
        <span className="text-xs text-gray-300">빈 슬롯 — 아래 후보 목록에서 선택하세요</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white shadow-sm px-4 py-3 min-h-[64px]">
      <span className="text-sm font-bold text-orange-600 w-6 text-center">{rank}</span>
      {item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt=""
          className="w-10 h-10 rounded object-cover bg-gray-100 shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className="w-10 h-10 rounded bg-orange-50 flex items-center justify-center text-orange-300 shrink-0">
          📝
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          <Badge variant="outline" className="text-xs font-normal mr-1">{item.category}</Badge>
          {item.source}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0"
        onClick={onRemove}
        title="슬롯에서 제거 (local state만 변경)"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function TodayPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── 날짜 (local state only) ──
  const [selectedDate, setSelectedDate] = useState(todayKST());

  // ── 슬롯 (local state only, rank 1~5 대응) ──
  const [slots, setSlots] = useState<(SlotEvent | null)[]>(Array(MAX_SLOTS).fill(null));

  // ── 후보 목록 필터 ──
  const [search, setSearch]         = useState("");
  const [categoryFilter, setCategory] = useState("전체");

  // ── 현재 top5 조회 (읽기 전용 — local state 초기값 참고용) ──
  const { data: top5Data, isLoading: top5Loading } = useQuery<Top5Response>({
    queryKey: ["admin-v2-top5", selectedDate],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/top5?date=${selectedDate}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("top5 조회 실패");
      return res.json() as Promise<Top5Response>;
    },
    staleTime: 60_000,
  });

  // ── 이벤트 목록 조회 (후보용) ──
  const { data: eventsData, isLoading: eventsLoading } = useQuery<EventsResponse>({
    queryKey: ["admin-v2-today-events"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/events`, { credentials: "include" });
      if (!res.ok) throw new Error("이벤트 조회 실패");
      return res.json() as Promise<EventsResponse>;
    },
    staleTime: 30_000,
  });

  // ── 현재 top5를 슬롯에 불러오기 ──
  const loadCurrentTop5 = () => {
    if (!top5Data?.items?.length) return;
    const newSlots: (SlotEvent | null)[] = Array(MAX_SLOTS).fill(null);
    top5Data.items.slice(0, MAX_SLOTS).forEach((item, i) => {
      newSlots[i] = {
        id: item.id,
        title: item.title,
        thumbnail: item.thumbnail,
        category: item.category,
        source: item.source,
      };
    });
    setSlots(newSlots);
  };

  // ── 슬롯 선택/제거 ──
  const selectedIds = new Set(slots.filter(Boolean).map((s) => s!.id));
  const filledCount = slots.filter(Boolean).length;

  const addToSlot = (event: EventItem) => {
    if (selectedIds.has(event.id)) return;
    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx === -1) return; // 슬롯 꽉 참
    const newSlots = [...slots];
    newSlots[emptyIdx] = {
      id: event.id,
      title: event.title,
      thumbnail: event.thumbnail,
      category: event.category,
      source: event.source,
    };
    setSlots(newSlots);
  };

  const removeFromSlot = (idx: number) => {
    const newSlots = [...slots];
    newSlots[idx] = null;
    setSlots(newSlots);
  };

  const clearSlots = () => setSlots(Array(MAX_SLOTS).fill(null));

  // ── daily_top5 저장 (POST /api/top5/save-only — events 테이블 무수정) ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      const filledSlots = slots
        .map((s, i) => s ? { eventId: s.id, rank: i + 1 } : null)
        .filter((s): s is { eventId: string; rank: number } => s !== null);

      const res = await fetch(`${BASE}/api/top5/save-only`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, items: filledSlots }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "저장 실패");
      }
      return res.json() as Promise<{ success: boolean; date: string; count: number }>;
    },
    onSuccess: (data) => {
      toast({
        title: "저장 완료",
        description: `${data.date} 오늘의 강릉소식 ${data.count}개가 저장되었습니다.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-v2-top5", selectedDate] });
    },
    onError: (err: Error) => {
      toast({
        title: "저장 실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const filled = slots.filter(Boolean).length;
    if (filled === 0) {
      toast({ title: "선정 항목 없음", description: "1개 이상 선택 후 저장하세요.", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  // ── 저장된 데이터와 현재 슬롯 일치 여부 ──
  const isSynced = useMemo(() => {
    const savedItems = top5Data?.items ?? [];
    const filledSlots = slots.filter(Boolean);
    if (savedItems.length === 0 && filledSlots.length === 0) return true;
    if (savedItems.length !== filledSlots.length) return false;
    const sorted = [...savedItems].sort((a, b) => a.rank - b.rank);
    return sorted.every((item, i) => item.eventId === filledSlots[i]?.id);
  }, [top5Data, slots]);

  // ── 후보 목록 필터링 ──
  const candidates = useMemo(() => {
    const events = eventsData?.events ?? [];
    return events.filter((e) => {
      if (!e.title?.trim()) return false;
      if (e.status === "rejected") return false; // 제외된 항목 숨김
      const matchSearch   = search === "" || e.title.includes(search) || e.source.includes(search);
      const matchCategory = categoryFilter === "전체" || e.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [eventsData, search, categoryFilter]);

  return (
    <AdminLayout title="오늘의 강릉소식">
      {/* 안내 배너 */}
      <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 mb-6">
        <Info className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-orange-800">오늘의 강릉소식 선정 · 저장</p>
          <p className="text-xs text-orange-700 mt-0.5">
            오늘 홈 상단에 노출할 소식 1~5개를 선정하고 저장합니다.
            저장 시 <strong>events 테이블은 수정되지 않습니다</strong> (status 변경 없음).
            daily_top5 테이블에만 날짜별 슬롯이 기록됩니다.
          </p>
        </div>
      </div>

      {/* 날짜 선택 + 현재 top5 불러오기 */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-gray-500" />
          <label className="text-sm text-gray-600 font-medium">선정 날짜</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSlots(Array(MAX_SLOTS).fill(null)); // 날짜 변경 시 슬롯 초기화 (local state only)
            }}
            className="border rounded-md px-2 py-1 text-sm text-gray-700 h-9 focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
        {top5Data && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-sm"
            onClick={loadCurrentTop5}
            title="현재 저장된 top5를 슬롯에 불러옵니다 (저장은 하지 않음)"
          >
            현재 top5 불러오기
            {top5Data.isHistorical && (
              <span className="ml-1.5 text-xs text-amber-600">(최근 이력)</span>
            )}
          </Button>
        )}
        {filledCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 text-sm text-gray-400 hover:text-red-500"
            onClick={clearSlots}
          >
            슬롯 전체 초기화
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={`text-sm font-semibold ${filledCount === MAX_SLOTS ? "text-orange-600" : "text-gray-500"}`}
          >
            {filledCount} / {MAX_SLOTS}
          </span>
          <span className="text-xs text-gray-400">선정됨</span>
        </div>
      </div>

      {/* ── 현재 선정 슬롯 ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          📌 오늘의 강릉소식 슬롯 (1~5번)
        </h2>
        {top5Loading ? (
          <SlotSkeleton />
        ) : (
          <div className="space-y-2">
            {slots.map((item, i) => (
              <SlotCard
                key={i}
                rank={i + 1}
                item={item}
                onRemove={() => removeFromSlot(i)}
              />
            ))}
          </div>
        )}

        {/* 저장 버튼 + 일치 여부 */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border bg-orange-50 border-orange-200 px-4 py-3">
          <Button
            className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
            onClick={handleSave}
            disabled={saveMutation.isPending || filledCount === 0}
            title={filledCount === 0 ? "1개 이상 선택 후 저장하세요" : `${filledCount}개 슬롯을 daily_top5에 저장 (events 테이블 무수정)`}
          >
            {saveMutation.isPending ? (
              <>저장 중...</>
            ) : saveMutation.isSuccess ? (
              <><CheckCircle2 className="h-4 w-4" /> 저장 완료</>
            ) : (
              <><Save className="h-4 w-4" /> 오늘의 강릉소식 저장</>
            )}
          </Button>
          <Button
            className="opacity-40 cursor-not-allowed"
            variant="outline"
            disabled
            title="추후 구현 예정"
          >
            SNS 발행
          </Button>
          <Button
            className="opacity-40 cursor-not-allowed"
            variant="outline"
            disabled
            title="추후 구현 예정"
          >
            홈 반영
          </Button>
          {/* 저장 상태 표시 */}
          {filledCount > 0 && (
            <span
              className={`ml-2 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                isSynced
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-amber-100 text-amber-700 border border-amber-200"
              }`}
            >
              {isSynced ? (
                <><CheckCircle2 className="h-3 w-3" /> 저장 상태: 현재 선택과 저장된 데이터가 일치합니다</>
              ) : (
                <>⚠ 저장 상태: 현재 선택이 저장된 데이터와 다릅니다. 저장이 필요합니다</>
              )}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            저장 시 events 테이블 수정 없음 (status 변경 없음)
          </span>
        </div>
      </section>

      {/* ── 저장된 오늘의 강릉소식 미리보기 ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">
          🖥 저장된 오늘의 강릉소식 미리보기
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          기존 홈 화면 코드는 수정하지 않았습니다. 이 영역은 관리자용 미리보기입니다.
        </p>

        {top5Loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !top5Data?.items?.length ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center text-sm text-gray-400">
            {selectedDate}에 저장된 오늘의 강릉소식이 없습니다.
            <br />
            <span className="text-xs text-gray-300 mt-1 block">위 슬롯에서 선정 후 저장 버튼을 누르세요.</span>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">
                {top5Data.date} 기준 {top5Data.items.length}개 저장됨
              </span>
              {top5Data.isHistorical && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  최근 이력 ({top5Data.top5Date})
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...top5Data.items]
                .sort((a, b) => a.rank - b.rank)
                .map((item) => (
                  <div
                    key={item.eventId}
                    className="flex gap-3 rounded-xl border bg-white shadow-sm px-3 py-3 min-h-[80px]"
                  >
                    {/* 순번 */}
                    <span className="text-lg font-bold text-orange-500 w-6 shrink-0 mt-0.5">
                      {item.rank}
                    </span>
                    {/* 썸네일 */}
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-orange-50 flex items-center justify-center text-orange-200 text-xl shrink-0">
                        📝
                      </div>
                    )}
                    {/* 텍스트 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                        {item.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <Badge variant="outline" className="text-xs font-normal h-5">
                          {item.category}
                        </Badge>
                        <span className="text-xs text-gray-400">{item.source}</span>
                      </div>
                      <div className="flex gap-2 mt-1.5">
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            원본
                          </a>
                        )}
                        <a
                          href={`${BASE}/content/${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-xs text-orange-500 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          상세보기
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            <p className="mt-2 text-xs text-gray-300 text-right">
              홈에서는 이런 순서로 노출됩니다 (관리자 미리보기 전용)
            </p>
          </>
        )}
      </section>

      {/* ── 후보 목록 ── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          📋 선정 후보 목록
          <span className="ml-2 text-xs font-normal text-gray-400">
            ({candidates.length}건) — 선택 버튼으로 슬롯에 추가
          </span>
        </h2>

        {/* 후보 필터 */}
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="제목 또는 출처 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategory}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 후보 테이블 */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {eventsLoading ? (
            <div className="p-4">
              <TableSkeleton />
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              조건에 맞는 후보가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="w-16 text-xs">썸네일</TableHead>
                    <TableHead className="text-xs min-w-[180px]">제목</TableHead>
                    <TableHead className="text-xs w-24">카테고리</TableHead>
                    <TableHead className="text-xs w-20">상태</TableHead>
                    <TableHead className="text-xs w-24">본문 여부</TableHead>
                    <TableHead className="text-xs w-28">출처</TableHead>
                    <TableHead className="text-xs w-28">수정일</TableHead>
                    <TableHead className="text-xs w-24">선택</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((event) => {
                    const isSelected  = selectedIds.has(event.id);
                    const isFull      = filledCount >= MAX_SLOTS;
                    const isDisabled  = isSelected || isFull;

                    return (
                      <TableRow key={event.id} className={`align-top ${isSelected ? "bg-orange-50" : ""}`}>
                        {/* 썸네일 */}
                        <TableCell className="py-2.5">
                          {event.thumbnail ? (
                            <img
                              src={event.thumbnail}
                              alt=""
                              className="w-11 h-11 rounded object-cover bg-gray-100"
                              onError={(e) => {
                                (e.target as HTMLImageElement).className =
                                  "w-11 h-11 rounded bg-gray-100";
                                (e.target as HTMLImageElement).src = "";
                              }}
                            />
                          ) : (
                            <div className="w-11 h-11 rounded bg-gray-100 flex items-center justify-center text-gray-300">
                              📝
                            </div>
                          )}
                        </TableCell>

                        {/* 제목 */}
                        <TableCell className="py-2.5">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                            {event.title}
                          </p>
                          {event.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                              {event.description}
                            </p>
                          )}
                        </TableCell>

                        {/* 카테고리 */}
                        <TableCell className="py-2.5">
                          <Badge variant="outline" className="text-xs font-normal">
                            {event.category}
                          </Badge>
                        </TableCell>

                        {/* 상태 */}
                        <TableCell className="py-2.5">
                          <Badge
                            variant={STATUS_VARIANTS[event.status] ?? "secondary"}
                            className="text-xs"
                          >
                            {STATUS_LABELS[event.status] ?? event.status}
                          </Badge>
                        </TableCell>

                        {/* 본문 여부 */}
                        <TableCell className="py-2.5">
                          {hasBlocks(event.contentBlocks) ? (
                            <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                              <FileText className="h-3 w-3" />
                              본문 있음
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                              <FileX className="h-3 w-3" />
                              본문 없음
                            </span>
                          )}
                        </TableCell>

                        {/* 출처 */}
                        <TableCell className="py-2.5">
                          <span className="text-xs text-gray-600 truncate block max-w-[100px]">
                            {event.source || "—"}
                          </span>
                        </TableCell>

                        {/* 수정일 */}
                        <TableCell className="py-2.5">
                          <span className="text-xs text-gray-500">
                            {formatDate(event.updatedAt)}
                          </span>
                        </TableCell>

                        {/* 선택 버튼 */}
                        <TableCell className="py-2.5">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                              ✓ 선정됨
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => addToSlot(event)}
                              disabled={isFull}
                              title={isFull ? "슬롯이 꽉 찼습니다 (최대 5개)" : "슬롯에 추가 (local state만 변경)"}
                            >
                              <Plus className="h-3 w-3 mr-0.5" />
                              선택
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          {top5Data?.isHistorical && (
            <p className="text-xs text-amber-600">
              ⚠ 오늘({selectedDate}) 저장된 top5가 없어 최근 이력({top5Data.top5Date})을 참고 중입니다.
            </p>
          )}
          <p className="ml-auto text-xs text-gray-300">
            * 선택/제거는 local state만 변경합니다. DB에 저장되지 않습니다.
          </p>
        </div>
      </section>

      {/* 외부 링크 영역 — 참고용 */}
      <div className="mt-6 rounded-xl border bg-gray-50 px-4 py-3">
        <p className="text-xs text-gray-500 font-medium mb-1">📎 참고 링크</p>
        <div className="flex gap-4">
          <a
            href={`${BASE}/api/top5?date=${selectedDate}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            GET /api/top5?date={selectedDate}
          </a>
          <a
            href={`${BASE}/api/top5/history`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            GET /api/top5/history
          </a>
        </div>
      </div>
    </AdminLayout>
  );
}
