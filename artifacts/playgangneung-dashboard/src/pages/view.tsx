import { useState, useCallback } from "react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function View() {
  const search = window.location.search;
  const params = new URLSearchParams(search);
  const frameUrl = params.get("url") ?? "";
  const title = params.get("title") ?? "원본 콘텐츠";

  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);

  const handleLoad = useCallback(() => setLoading(false), []);
  const handleError = useCallback(() => { setLoading(false); setBlocked(true); }, []);

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = `${BASE}/`;
    }
  }

  return (
    <div className="flex flex-col bg-white" style={{ height: "100dvh" }}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-white shrink-0 shadow-sm">
        <button
          onClick={goBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
          aria-label="뒤로"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <p className="flex-1 text-sm font-medium text-gray-800 line-clamp-1">{title}</p>
        {frameUrl && (
          <a
            href={frameUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium transition-colors shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            원문 보기
          </a>
        )}
      </div>

      {/* iframe 영역 */}
      <div className="relative flex-1 bg-gray-50 overflow-hidden">
        {loading && !blocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 pointer-events-none">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <p className="text-sm">페이지 불러오는 중...</p>
          </div>
        )}
        {blocked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <ExternalLink className="w-12 h-12 text-gray-300" />
            <p className="text-gray-600 font-medium">이 사이트는 페이지 내 표시를 차단합니다.</p>
            {frameUrl && (
              <a
                href={frameUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                새 탭에서 열기
              </a>
            )}
          </div>
        ) : frameUrl ? (
          <iframe
            src={frameUrl}
            title={title}
            className="w-full h-full border-0"
            onLoad={handleLoad}
            onError={handleError}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            URL이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
