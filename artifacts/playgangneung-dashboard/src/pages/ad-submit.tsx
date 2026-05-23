import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Upload, X, ImageIcon, CreditCard, Bold, Plus } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AdProduct {
  id: string;
  name: string;
  description: string;
  amount: number;
  adDurationDays: number | null;
  productType: string;
  sortOrder: number;
}

const CATEGORIES = ["행사", "맛집", "카페", "숙소", "체험", "핫플", "지역소식", "기타"];

interface FormData {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  category: string;
  title: string;
  description: string;
  date: string;
  location: string;
  url: string;
  plan: string;
  isPremiumFeatured: boolean;
  agreed: boolean;
}

/** 브라우저 Canvas로 이미지 자동 리사이즈 (최대 1200px, JPEG 85%) */
async function resizeImage(file: File, maxPx = 800, quality = 0.70): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = objectUrl;
  });
}

const SPECIAL_CHARS = [
  "★", "☆", "✓", "✔", "▶", "◀", "■", "□", "●", "○",
  "→", "←", "↑", "↓", "※", "◈", "•", "·", "—", "…",
  "™", "®", "©", "♡", "♥", "🔥", "⭐", "🎉", "📍", "💯",
];

const MAX_DESC = 500;

/** 미니 서식 에디터 (굵게·폰트크기·특수문자·500자 제한) */
function RichTextEditor({ onChange }: { onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [showChars, setShowChars] = useState(false);
  const charPickerRef = useRef<HTMLDivElement>(null);

  // 특수문자 picker 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (charPickerRef.current && !charPickerRef.current.contains(e.target as Node)) {
        setShowChars(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getTextLen = () =>
    (editorRef.current?.innerText ?? "").replace(/\n$/, "").length;

  const handleInput = () => {
    const len = getTextLen();
    setCharCount(len);
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const handleBeforeInput = (e: React.FormEvent) => {
    const native = e.nativeEvent as InputEvent;
    if (
      getTextLen() >= MAX_DESC &&
      native.inputType !== "deleteContentBackward" &&
      native.inputType !== "deleteContentForward"
    ) {
      e.preventDefault();
    }
  };

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    handleInput();
  };

  const insertChar = (ch: string) => {
    editorRef.current?.focus();
    if (getTextLen() < MAX_DESC) {
      document.execCommand("insertText", false, ch);
      handleInput();
    }
    setShowChars(false);
  };

  const setSize = (size: "small" | "normal" | "large") => {
    const sizeMap = { small: "0.8em", normal: "1em", large: "1.3em" };
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    try {
      const span = document.createElement("span");
      span.style.fontSize = sizeMap[size];
      range.surroundContents(span);
      handleInput();
    } catch { /* 복잡한 selection은 무시 */ }
  };

  const over = charCount >= MAX_DESC;

  return (
    <div className="border border-input rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring">
      {/* 툴바 */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-input">
        {/* 굵게 */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}
          title="굵게 (Ctrl+B)"
          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* 폰트 크기 */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setSize("small"); }}
          title="작게"
          className="px-1.5 py-1 rounded hover:bg-gray-200 transition-colors text-[10px] font-semibold text-gray-600"
        >
          A
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setSize("normal"); }}
          title="보통"
          className="px-1.5 py-1 rounded hover:bg-gray-200 transition-colors text-[13px] font-semibold text-gray-600"
        >
          A
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setSize("large"); }}
          title="크게"
          className="px-1.5 py-1 rounded hover:bg-gray-200 transition-colors text-[17px] font-semibold text-gray-600"
        >
          A
        </button>

        <div className="w-px h-4 bg-gray-300 mx-1" />

        {/* 특수문자 */}
        <div className="relative" ref={charPickerRef}>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setShowChars((v) => !v); }}
            title="특수문자"
            className="px-2 py-1 rounded hover:bg-gray-200 transition-colors text-xs text-gray-600 font-medium"
          >
            특수
          </button>
          {showChars && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-border rounded-xl shadow-lg p-2 w-56">
              <div className="grid grid-cols-10 gap-0.5">
                {SPECIAL_CHARS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertChar(ch); }}
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-blue-50 text-sm transition-colors"
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto">
          <span className={`text-[11px] font-mono ${over ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
            {charCount}/{MAX_DESC}
          </span>
        </div>
      </div>

      {/* 편집 영역 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBeforeInput={handleBeforeInput}
        onKeyDown={(e) => {
          if (e.ctrlKey && e.key === "b") { e.preventDefault(); exec("bold"); }
        }}
        className="min-h-[100px] max-h-[200px] overflow-y-auto px-3 py-2.5 text-sm focus:outline-none leading-relaxed"
        data-placeholder="광고하고 싶은 내용을 자유롭게 작성해주세요."
        style={{ wordBreak: "keep-all" }}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

/** 단일 이미지 슬롯 컴포넌트 */
function ImageSlot({
  label,
  preview,
  onFile,
  onRemove,
  isMain = false,
}: {
  label: string;
  preview: string | null;
  onFile: (file: File) => void;
  onRemove: () => void;
  isMain?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { onFile(file); e.target.value = ""; }
  };

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) onFile(accepted[0]);
  }, [onFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
    noClick: true,
  });

  if (preview) {
    return (
      <div className="relative rounded-xl overflow-hidden group">
        <img
          src={preview}
          alt={label}
          className={`w-full object-cover ${isMain ? "h-48" : "h-32"}`}
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-semibold bg-black/50 text-white px-2 py-0.5 rounded-full">{label}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-2 right-2 bg-black/60 text-white rounded-lg px-2 py-1 text-[10px] font-medium hover:bg-black/80 transition-colors"
        >
          교체
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors select-none
        ${isMain ? "p-8" : "p-4"}
        ${isDragActive ? "border-primary bg-blue-50" : "border-border hover:border-primary/50 hover:bg-gray-50"}`}
    >
      <input {...getInputProps()} />
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      <div className={`bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2 ${isMain ? "w-12 h-12" : "w-8 h-8"}`}>
        {isDragActive
          ? <Upload className={`text-primary ${isMain ? "w-6 h-6" : "w-4 h-4"}`} />
          : isMain
            ? <ImageIcon className="w-6 h-6 text-gray-400" />
            : <Plus className="w-4 h-4 text-gray-400" />
        }
      </div>
      {isDragActive ? (
        <p className="text-primary font-medium text-xs">여기에 놓으세요!</p>
      ) : (
        <>
          <p className={`font-medium text-gray-600 ${isMain ? "text-sm mb-0.5" : "text-xs"}`}>{label}</p>
          {isMain && <p className="text-xs text-muted-foreground">클릭하거나 드래그해서 업로드</p>}
        </>
      )}
    </div>
  );
}

export default function AdSubmit() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [paidLoading, setPaidLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [images, setImages] = useState<[string | null, string | null, string | null]>([null, null, null]);
  const [form, setForm] = useState<FormData>({
    businessName: "", contactName: "", phone: "", email: "",
    category: "행사", title: "", description: "", date: "",
    location: "", url: "", plan: "basic", isPremiumFeatured: false, agreed: false,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: AdProduct[] }>({
    queryKey: ["ad-products-public"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ad-products/public`);
      if (!r.ok) return { products: [] };
      return r.json() as Promise<{ products: AdProduct[] }>;
    },
  });
  const adProducts = productsData?.products ?? [];

  // 상품 로드 시 첫 번째 상품 자동 선택
  useEffect(() => {
    if (!selectedProductId && adProducts.length > 0) {
      setSelectedProductId(adProducts[0].id);
    }
  }, [adProducts, selectedProductId]);

  // 전역 붙여넣기(Ctrl+V) — 빈 슬롯 순서대로 채움
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      const emptyIndex = ([0, 1, 2] as const).find((i) => images[i] === null);
      if (emptyIndex === undefined) return;
      try {
        const resized = await resizeImage(file);
        setImages((prev) => {
          const next = [...prev] as [string | null, string | null, string | null];
          next[emptyIndex] = resized;
          return next;
        });
      } catch { /* noop */ }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [images]);

  const handleImageFile = async (index: 0 | 1 | 2, file: File) => {
    try {
      const resized = await resizeImage(file);
      setImages((prev) => {
        const next = [...prev] as [string | null, string | null, string | null];
        next[index] = resized;
        return next;
      });
    } catch {
      toast({ title: "이미지 오류", description: "이미지를 불러올 수 없습니다.", variant: "destructive" });
    }
  };

  const removeImage = (index: 0 | 1 | 2) => {
    setImages((prev) => {
      const next = [...prev] as [string | null, string | null, string | null];
      next[index] = null;
      return next;
    });
  };

  const set = (key: keyof FormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agreed) {
      toast({ title: "개인정보 동의 필요", description: "개인정보 활용에 동의해주세요.", variant: "destructive" });
      return;
    }
    if (!form.businessName || !form.title || !form.phone) {
      toast({ title: "필수 항목 누락", description: "업체명, 제목, 연락처를 입력해주세요.", variant: "destructive" });
      return;
    }
    if (!selectedProductId) {
      toast({ title: "상품 선택 필요", description: "광고 상품을 선택해주세요.", variant: "destructive" });
      return;
    }
    setPaidLoading(true);
    try {
      const body = {
        ...form,
        imageUrl: images[0] ?? null,
        extraImages: [images[1], images[2]].filter(Boolean),
        isFreeAd: false,
        plan: selectedProductId,
        isPremiumFeatured: form.isPremiumFeatured,
      };
      const res = await fetch(`${BASE}/api/ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("접수 실패");
      const d = await res.json() as { id: string };
      navigate(`/checkout?productId=${selectedProductId}&adId=${d.id}`);
    } catch {
      toast({ title: "접수 실패", description: "잠시 후 다시 시도해주세요.", variant: "destructive" });
      setPaidLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-border p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-9 h-9 text-green-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">광고 접수 완료!</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            광고 접수가 완료되었습니다.<br />
            관리자 검수 후 PLAY강릉 SNS 및 웹 피드에 소개될 수 있습니다.
          </p>
          <a href={`${BASE}/`}>
            <Button className="w-full">메인으로 돌아가기</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 flex items-center" style={{ height: 50 }}>
          <a href={`${BASE}/`}>
            <img src={`${BASE}/logo2.png`} alt="PLAY강릉" style={{ height: 50, width: "auto" }} />
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">PLAY강릉 광고접수</h1>
          <p className="text-muted-foreground text-sm">강릉의 행사, 맛집, 카페, 숙소, 체험, 로컬 소식을 등록해보세요.</p>
        </div>

        {/* Notice */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800 leading-relaxed">
          <strong>📢 광고 안내</strong><br />
          광고 접수 후 관리자 검수를 거쳐 PLAY강릉 SNS 및 웹 피드에 소개됩니다.<br />
          결제 완료 후 영업일 기준 1일 이내 집행됩니다.
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 광고 상품 선택 */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-base mb-1">광고 상품 선택</h2>
            <p className="text-xs text-muted-foreground mb-4">원하시는 광고 상품을 선택해주세요.</p>
            <div className="space-y-2">
              {productsLoading && (
                <p className="text-xs text-muted-foreground py-4 text-center">상품을 불러오는 중...</p>
              )}
              {!productsLoading && adProducts.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">현재 등록된 광고 상품이 없습니다. 잠시 후 다시 확인해주세요.</p>
              )}
              {adProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProductId(p.id)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    selectedProductId === p.id ? "border-blue-500 bg-blue-50 ring-1 ring-blue-400" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedProductId === p.id ? "bg-blue-100" : "bg-gray-100"}`}>
                        <CreditCard className={`w-4 h-4 ${selectedProductId === p.id ? "text-blue-600" : "text-gray-500"}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.description}{p.adDurationDays ? ` · ${p.adDurationDays}일 노출` : ""}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${selectedProductId === p.id ? "text-blue-600" : "text-gray-800"}`}>
                      ₩{p.amount.toLocaleString("ko-KR")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-base">기본 정보</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">업체명 / 행사명 <span className="text-red-500">*</span></label>
                <Input placeholder="예: 경포 커피로스터스" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">담당자명</label>
                <Input placeholder="홍길동" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">연락처 <span className="text-red-500">*</span></label>
                <Input type="tel" placeholder="010-0000-0000" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">이메일</label>
                <Input type="email" placeholder="example@email.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">카테고리</label>
              <select
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-base">광고 내용</h2>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">광고 제목 <span className="text-red-500">*</span></label>
              <Input placeholder="예: 2026 강릉 커피축제 메인 스폰서" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">상세 설명</label>
              <RichTextEditor onChange={(html) => set("description", html)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">일정 / 기간</label>
                <Input placeholder="예: 2026.05.10 ~ 05.12" value={form.date} onChange={(e) => set("date", e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">위치</label>
                <Input placeholder="예: 강릉시 경포로 123" value={form.location} onChange={(e) => set("location", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">홈페이지 / SNS 링크</label>
              <Input placeholder="https://..." value={form.url} onChange={(e) => set("url", e.target.value)} />
            </div>
          </div>

          {/* Image Upload — 3장 */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-base">이미지</h2>
              <span className="text-[11px] text-muted-foreground">
                {[images[0], images[1], images[2]].filter(Boolean).length} / 3장
              </span>
            </div>

            {/* 대표 이미지 */}
            <ImageSlot
              label="대표 이미지"
              preview={images[0]}
              onFile={(f) => handleImageFile(0, f)}
              onRemove={() => removeImage(0)}
              isMain
            />

            {/* 추가 이미지 2장 */}
            <div className="grid grid-cols-2 gap-3">
              <ImageSlot
                label="추가 이미지 1"
                preview={images[1]}
                onFile={(f) => handleImageFile(1, f)}
                onRemove={() => removeImage(1)}
              />
              <ImageSlot
                label="추가 이미지 2"
                preview={images[2]}
                onFile={(f) => handleImageFile(2, f)}
                onRemove={() => removeImage(2)}
              />
            </div>
          </div>

          {/* 프리미엄 광고 노출 신청 */}
          <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-amber-500"
                checked={form.isPremiumFeatured}
                onChange={(e) => set("isPremiumFeatured", e.target.checked)}
              />
              <div>
                <p className="text-sm font-semibold text-amber-800">⭐ 프리미엄 광고 노출 신청</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  체크 시 메인 홈페이지 상단 <strong>「PLAY 추천 · 프리미엄 콘텐츠」</strong> 슬라이더에 노출됩니다.<br />
                  (관리자 승인 후 반영, 별도 추가 비용 없음)
                </p>
              </div>
            </label>
          </div>

          {/* Agreement */}
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-primary"
                checked={form.agreed}
                onChange={(e) => set("agreed", e.target.checked)}
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                광고 등록 및 개인정보 활용에 동의합니다. 수집된 정보는 광고 서비스 운영 목적으로만 사용됩니다.
              </span>
            </label>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold"
            disabled={paidLoading || !selectedProductId}
          >
            {paidLoading
              ? "처리 중..."
              : <><CreditCard className="w-4 h-4 mr-2 inline" />결제하기</>
            }
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6 mb-8">
          문의: PLAY강릉 운영팀 | 강원특별자치도 강릉시
        </p>
      </div>
    </div>
  );
}
