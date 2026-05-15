import { useState } from "react";

const CATEGORIES = ["전체", "행사", "정보", "스토리", "영상"] as const;
type Cat = (typeof CATEGORIES)[number];

const CARDS = [
  {
    id: 1, category: "행사", badge: "행사",
    title: "2026 강릉 단오제 – 유네스코 무형유산 축제",
    desc: "강릉 남대천 일원에서 열리는 강릉단오제. 관노가면극·농악·씨름 등 전통 체험 가득.",
    date: "6월 5일 ~ 11일", image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80",
    color: "#2563eb",
  },
  {
    id: 2, category: "스토리", badge: "스토리",
    title: "오늘 안목 바다는 유난히 잔잔했다",
    desc: "파도 소리도 없이 수평선이 거울처럼. 커피 한 잔 들고 오래 앉아 있었다.",
    date: "방금", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80",
    color: "#7c3aed",
  },
  {
    id: 3, category: "정보", badge: "정보",
    title: "강릉 중앙시장 새벽 5시 – 아는 사람만 가는 곳",
    desc: "갓 나온 초당순두부·메밀전병·감자옹심이. 강릉 사람들이 진짜 먹는 아침.",
    date: "5월 14일", image: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=600&q=80",
    color: "#059669",
  },
  {
    id: 4, category: "영상", badge: "영상",
    title: "드론으로 본 경포해변 일출",
    desc: "매년 1월 1일 수만 명이 모이는 강릉 경포해변의 일출 장면.",
    date: "5월 12일", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
    color: "#ea580c",
  },
  {
    id: 5, category: "행사", badge: "행사",
    title: "강릉커피축제 2026 – 커피 도시의 축제",
    desc: "안목해변 일원에서 펼쳐지는 강릉 커피 문화 축제. 50여 개 카페 참여.",
    date: "10월 2일 ~ 6일", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
    color: "#2563eb",
  },
];

const badgeColors: Record<string, string> = {
  행사: "#2563eb", 정보: "#059669", 스토리: "#7c3aed", 영상: "#ea580c",
};

export function Feed() {
  const [active, setActive] = useState<Cat>("전체");
  const filtered = active === "전체" ? CARDS : CARDS.filter((c) => c.category === active);

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif", background: "#f8f8f8", minHeight: "100vh", width: 390, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "14px 16px 0", position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <img src="/logo2.png" alt="PLAY강릉" style={{ height: 34, objectFit: "contain" }} />
          <div style={{ display: "flex", gap: 12 }}>
            <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>🔍</button>
            <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>☰</button>
          </div>
        </div>
        {/* Category Tabs */}
        <div style={{ display: "flex", width: "100%" }}>
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setActive(cat)}
              style={{ flex: 1, background: "none", border: "none", padding: "10px 0", fontWeight: active === cat ? 700 : 500, fontSize: 15.5, color: active === cat ? "#2563eb" : "#888", cursor: "pointer", borderBottom: active === cat ? "2.5px solid #2563eb" : "2.5px solid transparent", whiteSpace: "nowrap", textAlign: "center" }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
        {filtered.map((card) => (
          <div key={card.id} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 8px rgba(0,0,0,.07)" }}>
            <div style={{ position: "relative", height: 200 }}>
              <img src={card.image} alt={card.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.6) 0%, transparent 55%)" }} />
              <span style={{ position: "absolute", top: 12, left: 12, background: card.color, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{card.badge}</span>
            </div>
            <div style={{ padding: "14px 16px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111", lineHeight: 1.4, marginBottom: 6 }}>{card.title}</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 10 }}>{card.desc}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#aaa" }}>{card.date}</span>
                <button style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>🔗</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
