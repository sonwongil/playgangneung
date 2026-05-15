import { useState } from "react";

const STORIES = [
  {
    id: 1,
    author: "PLAY강릉",
    avatar: "🌊",
    time: "방금",
    title: "오늘 안목 바다는 유난히 잔잔했다",
    body: "파도 소리도 없이 수평선이 거울처럼.\n커피 한 잔 들고 오래 앉아 있었다.\n\n이상하게 오늘은 아무것도 하기 싫지 않았다.",
    images: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80",
      "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80",
    ],
    likes: 218, comments: 24,
  },
  {
    id: 2,
    author: "강릉로컬",
    avatar: "🌿",
    time: "1시간 전",
    title: "비 오는 경포호",
    body: "우산 없이 경포호 한 바퀴.\n빗소리가 생각보다 좋았다.\n\n연꽃은 아직 피지 않았지만,\n물 위 잔물결은 이미 여름이었다.",
    images: [
      "https://images.unsplash.com/photo-1446329813274-7c9036bd9a1f?w=600&q=80",
    ],
    likes: 94, comments: 11,
  },
  {
    id: 3,
    author: "강릉사람",
    avatar: "🍜",
    time: "3시간 전",
    title: "강릉 사람만 아는 새벽 중앙시장",
    body: "새벽 5시. 관광객은 한 명도 없었다.\n아주머니들이 갓 만든 메밀전병을 펼쳐 놓는다.\n\n뜨끈한 초당순두부 한 그릇으로 시작하는 강릉의 아침.",
    images: [
      "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=600&q=80",
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80",
    ],
    likes: 312, comments: 47,
  },
];

export function Story() {
  const [activeImg, setActiveImg] = useState<Record<number, number>>({});

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif", background: "#0f0f0f", minHeight: "100vh", width: 390, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo_transparent.png" alt="PLAY강릉" style={{ height: 26, objectFit: "contain" }} />
          <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "-0.5px" }}>스토리</span>
        </div>
        <button style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)", border: "none", borderRadius: 20, padding: "6px 14px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          + 스토리 올리기
        </button>
      </div>

      {/* Story Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {STORIES.map((story) => {
          const imgIdx = activeImg[story.id] ?? 0;
          return (
            <div key={story.id} style={{ background: "#1a1a1a" }}>
              {/* Author row */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 10px" }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#2563eb,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  {story.avatar}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{story.author}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{story.time}</div>
                </div>
              </div>

              {/* Image */}
              <div style={{ position: "relative" }}>
                <img src={story.images[imgIdx]} alt="" style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }} />
                {/* Image dots */}
                {story.images.length > 1 && (
                  <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
                    {story.images.map((_, i) => (
                      <button key={i} onClick={() => setActiveImg((p) => ({ ...p, [story.id]: i }))}
                        style={{ width: i === imgIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === imgIdx ? "#fff" : "rgba(255,255,255,.4)", border: "none", cursor: "pointer", transition: "all .2s" }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Text */}
              <div style={{ padding: "14px 16px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 8, letterSpacing: "-0.3px" }}>{story.title}</div>
                <div style={{ fontSize: 14, color: "#aaa", lineHeight: 1.8, whiteSpace: "pre-line" }}>{story.body}</div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
                  <button style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 5, color: "#aaa", fontSize: 13, cursor: "pointer" }}>
                    <span style={{ fontSize: 18 }}>🤍</span>{story.likes}
                  </button>
                  <button style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 5, color: "#aaa", fontSize: 13, cursor: "pointer" }}>
                    <span style={{ fontSize: 18 }}>💬</span>{story.comments}
                  </button>
                  <button style={{ background: "none", border: "none", marginLeft: "auto", color: "#aaa", fontSize: 18, cursor: "pointer" }}>↗</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
