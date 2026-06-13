import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Search, Pencil, FileText, FileX } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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
  crawledAt: string;
  updatedAt: string;
  contentBlocks?: unknown[] | null;
}

interface EventsResponse {
  success: boolean;
  total: number;
  events: EventItem[];
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

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
const STATUS_OPTIONS   = ["전체", "draft", "approved", "rejected", "published"];

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function formatDate(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw.slice(0, 10) || "—";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

function hasContentBlocks(blocks: unknown[] | null | undefined): boolean {
  return Array.isArray(blocks) && blocks.length > 0;
}

// ─── 스켈레톤 ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-md" />
      ))}
    </div>
  );
}

// ─── 작업 버튼 ────────────────────────────────────────────────────────────────

function ActionButtons({ eventId }: { eventId: string }) {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-wrap gap-1 min-w-[220px]">
      {/* 편집 — 활성화 */}
      <Button
        size="sm"
        variant="default"
        className="text-xs h-7 bg-orange-600 hover:bg-orange-700"
        onClick={() =>
          navigate(`/admin/v2/notes/new?sourceId=${encodeURIComponent(eventId)}`)
        }
        title="강릉노트 편집"
      >
        <Pencil className="h-3 w-3 mr-1" />
        편집
      </Button>

      {/* 오늘의 강릉소식 선정 — disabled */}
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-7 opacity-40 cursor-not-allowed"
        disabled
        title="다음 단계에서 구현 예정"
      >
        오늘의 강릉소식
      </Button>

      {/* SNS 발행 — disabled */}
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-7 opacity-40 cursor-not-allowed text-purple-600 border-purple-200 hover:border-purple-200"
        disabled
        title="다음 단계에서 구현 예정"
      >
        SNS 발행
      </Button>

      {/* 공개 전환 — disabled */}
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-7 opacity-40 cursor-not-allowed text-green-600 border-green-200 hover:border-green-200"
        disabled
        title="다음 단계에서 구현 예정"
      >
        공개 전환
      </Button>
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function NoteListPage() {
  const [search, setSearch]         = useState("");
  const [categoryFilter, setCategory] = useState("전체");
  const [statusFilter, setStatus]   = useState("전체");
  const [bodyFilter, setBodyFilter] = useState("전체"); // 전체 / 있음 / 없음

  const { data, isLoading, isError } = useQuery<EventsResponse>({
    queryKey: ["admin-v2-notes-list"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/events`, { credentials: "include" });
      if (!res.ok) throw new Error("이벤트 목록 조회 실패");
      return res.json() as Promise<EventsResponse>;
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const events = data?.events ?? [];
    return events.filter((e) => {
      const matchSearch   = search === "" || e.title.includes(search) || e.source.includes(search);
      const matchCategory = categoryFilter === "전체" || e.category === categoryFilter;
      const matchStatus   = statusFilter === "전체" || e.status === statusFilter;
      const hasBlocks     = hasContentBlocks(e.contentBlocks);
      const matchBody =
        bodyFilter === "전체" ||
        (bodyFilter === "있음" && hasBlocks) ||
        (bodyFilter === "없음" && !hasBlocks);
      return matchSearch && matchCategory && matchStatus && matchBody;
    });
  }, [data, search, categoryFilter, statusFilter, bodyFilter]);

  const withBodyCount    = data?.events.filter((e) => hasContentBlocks(e.contentBlocks)).length ?? 0;
  const withoutBodyCount = (data?.total ?? 0) - withBodyCount;

  return (
    <AdminLayout title="강릉노트 관리">
      {/* 헤더 요약 */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mt-1">
          수집함 전환 및 직접 작성된 강릉노트를 관리합니다. 편집 버튼으로 초안을 수정할 수 있습니다.
        </p>
        <div className="flex gap-3 mt-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-3 py-1 text-xs font-medium text-orange-700">
            <FileText className="h-3 w-3" />
            본문 있음 {withBodyCount}건
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500">
            <FileX className="h-3 w-3" />
            본문 없음 {withoutBodyCount}건
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
            전체 {data?.total ?? 0}건
          </span>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-3 mb-4">
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
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-32 h-9 text-sm">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "전체" ? "전체 상태" : STATUS_LABELS[s] ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bodyFilter} onValueChange={setBodyFilter}>
          <SelectTrigger className="w-28 h-9 text-sm">
            <SelectValue placeholder="본문" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="전체">전체 본문</SelectItem>
            <SelectItem value="있음">본문 있음</SelectItem>
            <SelectItem value="없음">본문 없음</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 검색 결과 카운트 */}
      {!isLoading && (
        <p className="text-xs text-gray-400 mb-3">{filtered.length}건 표시 중</p>
      )}

      {/* 테이블 */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500">
            데이터를 불러오지 못했습니다. API 서버를 확인해 주세요.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            조건에 맞는 항목이 없습니다.
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
                  <TableHead className="text-xs w-20">원본 URL</TableHead>
                  <TableHead className="text-xs w-28">수정일</TableHead>
                  <TableHead className="text-xs min-w-[250px]">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((event) => {
                  const hasBlocks = hasContentBlocks(event.contentBlocks);
                  return (
                    <TableRow key={event.id} className="align-top">
                      {/* 썸네일 */}
                      <TableCell className="py-3">
                        {event.thumbnail ? (
                          <img
                            src={event.thumbnail}
                            alt=""
                            className="w-12 h-12 rounded object-cover bg-gray-100"
                            onError={(e) => {
                              (e.target as HTMLImageElement).className =
                                "w-12 h-12 rounded bg-gray-100";
                              (e.target as HTMLImageElement).src = "";
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-300 text-lg">
                            📝
                          </div>
                        )}
                      </TableCell>

                      {/* 제목 */}
                      <TableCell className="py-3">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                          {event.title || "제목 없음"}
                        </p>
                        {event.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                            {event.description}
                          </p>
                        )}
                      </TableCell>

                      {/* 카테고리 */}
                      <TableCell className="py-3">
                        <Badge variant="outline" className="text-xs font-normal">
                          {event.category}
                        </Badge>
                      </TableCell>

                      {/* 상태 */}
                      <TableCell className="py-3">
                        <Badge
                          variant={STATUS_VARIANTS[event.status] ?? "secondary"}
                          className="text-xs"
                        >
                          {STATUS_LABELS[event.status] ?? event.status}
                        </Badge>
                      </TableCell>

                      {/* 본문 여부 */}
                      <TableCell className="py-3">
                        {hasBlocks ? (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 font-medium">
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
                      <TableCell className="py-3">
                        <span className="text-xs text-gray-600 truncate block max-w-[100px]">
                          {event.source || "—"}
                        </span>
                      </TableCell>

                      {/* 원본 URL */}
                      <TableCell className="py-3">
                        {event.link ? (
                          <a
                            href={event.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            원본
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </TableCell>

                      {/* 수정일 */}
                      <TableCell className="py-3">
                        <span className="text-xs text-gray-500">
                          {formatDate(event.updatedAt)}
                        </span>
                      </TableCell>

                      {/* 작업 버튼 */}
                      <TableCell className="py-3">
                        <ActionButtons eventId={event.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* 안내 */}
      <p className="mt-4 text-xs text-gray-300 text-right">
        * 오늘의 강릉소식 선정 / SNS 발행 / 공개 전환 버튼은 다음 단계에서 활성화됩니다.
      </p>
    </AdminLayout>
  );
}
