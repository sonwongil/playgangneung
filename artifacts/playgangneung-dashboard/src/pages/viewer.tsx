import { useState } from "react";
import { useSearch } from "wouter";

export default function Viewer() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const url = params.get("url") || "";
  const [loaded, setLoaded] = useState(false);

  function goBack() {
    const fallback = sessionStorage.getItem("playgangneung_return_url") || "/";
    if (window.history.length > 1 && document.referrer.includes(window.location.origin)) {
      window.history.back();
    } else {
      window.location.href = fallback;
    }
  }

  if (!url) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-white gap-4">
        <p className="text-gray-500 text-sm">잘못된 접근입니다.</p>
        <button onClick={goBack} className="text-blue-600 text-sm font-semibold">← PLAY강릉으로 돌아가기</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white" style={{ zIndex: 10 }}>
      {/* 상단 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0" style={{ minHeight: 48 }}>
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-full shrink-0"
          aria-label="PLAY강릉으로 돌아가기"
        >
          ← PLAY강릉
        </button>
        <span className="text-xs text-gray-400 truncate flex-1 min-w-0">{url}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full"
        >
          원문 보기 ↗
        </a>
      </div>

      {/* iframe 영역 */}
      <div className="flex-1 relative overflow-hidden bg-white">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 bg-white z-10">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm">페이지 불러오는 중...</span>
          </div>
        )}
        <iframe
          src={url}
          className="w-full h-full border-none"
          style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.2s" }}
          onLoad={() => setLoaded(true)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          title="원본 페이지"
        />
      </div>

      {/* 하단 안내 */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-yellow-50 border-t border-yellow-200">
        <span className="text-xs text-yellow-700">미리보기가 보이지 않으면</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-yellow-800 underline"
        >
          원문 보기
        </a>
      </div>
    </div>
  );
}
