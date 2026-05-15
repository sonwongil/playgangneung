import { useState } from "react";

const VIDEOS = [
  { id: "dQw4w9WgXcQ", title: "강릉 경포해변 드론 영상 4K", channel: "강릉VLOG", views: "12만", thumb: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80", tag: "드론" },
  { id: "3JmKNr4RCFU", title: "강릉 카페거리 브이로그 – 안목해변 커피 투어", channel: "여행하는밤", views: "8.4만", thumb: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80", tag: "브이로그" },
  { id: "LXb3EKWsInQ", title: "강릉 단오제 2025 현장 – 관노가면극 풀버전", channel: "강원문화TV", views: "5.1만", thumb: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80", tag: "축제" },
  { id: "9bZkp7q19f0", title: "강릉 중앙시장 맛집 투어 – 초당순두부부터 감자전까지", channel: "먹방강원도", views: "3.2만", thumb: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=600&q=80", tag: "맛집" },
  { id: "kJQP7kiw5Fk", title: "강릉 바다 ASMR – 경포, 사근진, 안목 파도소리", channel: "바다소리", views: "22만", thumb: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80", tag: "바다" },
];

const TAG_COLORS: Record<string, string> = { 드론: "#7c3aed", 브이로그: "#2563eb", 축제: "#ea580c", 맛집: "#059669", 바다: "#0891b2" };

export function Video() {
  const [playing, setPlaying] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  if (playing && !ended) {
    return (
      <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif", background: "#000", minHeight: "100vh", width: 390, margin: "0 auto" }}>
        {/* Player Header */}
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setPlaying(null)} style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer" }}>←</button>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>강릉 영상</span>
        </div>
        {/* YouTube iframe */}
        <div style={{ width: "100%", aspectRatio: "16/9", background: "#111" }}>
          <iframe
            width="390" height="219"
            src={`https://www.youtube.com/embed/${playing}?autoplay=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ border: "none", display: "block", width: "100%", height: 219 }}
          />
        </div>
        {/* Current video info */}
        {(() => { const v = VIDEOS.find((x) => x.id === playing)!; return (
          <div style={{ padding: "16px" }}>
            <span style={{ background: TAG_COLORS[v.tag], color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{v.tag}</span>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginTop: 8, lineHeight: 1.4 }}>{v.title}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{v.channel} · 조회 {v.views}</div>
          </div>
        ); })()}
        {/* More videos */}
        <div style={{ padding: "0 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#ccc", marginBottom: 10 }}>다른 강릉 영상</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {VIDEOS.filter((v) => v.id !== playing).map((v) => (
              <button key={v.id} onClick={() => setPlaying(v.id)}
                style={{ background: "#1a1a1a", border: "none", borderRadius: 12, display: "flex", gap: 10, padding: "10px", cursor: "pointer", textAlign: "left" }}>
                <img src={v.thumb} alt="" style={{ width: 90, height: 60, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#fff", lineHeight: 1.4 }}>{v.title}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{v.channel} · {v.views}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif", background: "#0f0f0f", minHeight: "100vh", width: 390, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src="/logo_transparent.png" alt="PLAY강릉" style={{ height: 34, objectFit: "contain" }} />
        <button style={{ background: "none", border: "none", fontSize: 20, color: "#888", cursor: "pointer" }}>🔍</button>
      </div>

      {/* Featured */}
      <div style={{ margin: "0 14px 16px", borderRadius: 16, overflow: "hidden", position: "relative", cursor: "pointer" }} onClick={() => setPlaying(VIDEOS[0].id)}>
        <img src={VIDEOS[0].thumb} alt="" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.8) 0%, transparent 55%)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 22, marginLeft: 3 }}>▶</span>
        </div>
        <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
          <span style={{ background: TAG_COLORS[VIDEOS[0].tag], color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{VIDEOS[0].tag}</span>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginTop: 4 }}>{VIDEOS[0].title}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)", marginTop: 2 }}>{VIDEOS[0].channel} · 조회 {VIDEOS[0].views}</div>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        {VIDEOS.slice(1).map((v) => (
          <button key={v.id} onClick={() => setPlaying(v.id)}
            style={{ background: "#1a1a1a", border: "none", borderRadius: 14, display: "flex", gap: 12, padding: "12px", cursor: "pointer", textAlign: "left" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img src={v.thumb} alt="" style={{ width: 110, height: 70, borderRadius: 10, objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 11, marginLeft: 2 }}>▶</span>
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ background: TAG_COLORS[v.tag], color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{v.tag}</span>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#fff", marginTop: 5, lineHeight: 1.4 }}>{v.title}</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{v.channel} · 조회 {v.views}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
