import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Upload, X, ImageIcon, ChevronRight, Megaphone, Star, Zap, Plus } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Plan = "basic" | "main" | "premium";

const PLANS = [
  {
    id: "basic" as Plan,
    icon: <Megaphone className="w-5 h-5" />,
    name: "기본 광고",
    features: ["카드 이미지 제작", "SNS 업로드", "1일 노출"],
    color: "border-blue-200 bg-blue-50",
    activeColor: "border-blue-500 bg-blue-50 ring-2 ring-blue-400",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    id: "main" as Plan,
    icon: <Star className="w-5 h-5" />,
    name: "메인 광고",
    features: ["메인 노출", "반복 SNS 노출", "3일 노출"],
    color: "border-purple-200 bg-purple-50",
    activeColor: "border-purple-500 bg-purple-50 ring-2 ring-purple-400",
    badgeColor: "bg-purple-100 text-purple-700",
  },
  {
    id: "premium" as Plan,
    icon: <Zap className="w-5 h-5" />,
    name: "프리미엄 광고",
    features: ["릴스/영상 포함", "메인 고정 노출", "5일 노출"],
    color: "border-orange-200 bg-orange-50",
    activeColor: "border-orange-500 bg-orange-50 ring-2 ring-orange-400",
    badgeColor: "bg-orange-100 text-orange-700",
  },
];

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
  plan: Plan;
  agreed: boolean;
}

/** 브라우저 Canvas로 이미지 자동 리사이즈 (최대 1200px, JPEG 85%) */
async function resizeImage(file: File, maxPx = 1200, quality = 0.85): Promise<string> {
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
          <p className="text-[10px] text-muted-foreground mt-0.5">선택사항 · 자동 최적화</p>
        </>
      )}
    </div>
  );
}

export default function AdSubmit() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [images, setImages] = useState<[string | null, string | null, string | null]>([null, null, null]);
  const [form, setForm] = useState<FormData>({
    businessName: "", contactName: "", phone: "", email: "",
    category: "행사", title: "", description: "", date: "",
    location: "", url: "", plan: "basic", agreed: false,
  });

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

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        imageUrl: images[0] ?? null,
        extraImages: [images[1], images[2]].filter(Boolean),
      };
      const res = await fetch(`${BASE}/api/ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("접수 실패");
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
    onError: () => toast({ title: "접수 실패", description: "잠시 후 다시 시도해주세요.", variant: "destructive" }),
  });

  const set = (key: keyof FormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agreed) {
      toast({ title: "개인정보 동의 필요", description: "개인정보 활용에 동의해주세요.", variant: "destructive" });
      return;
    }
    if (!form.businessName || !form.title || !form.phone) {
      toast({ title: "필수 항목 누락", description: "업체명, 제목, 연락처를 입력해주세요.", variant: "destructive" });
      return;
    }
    mutation.mutate();
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
          <strong>📢 시범 운영 안내</strong><br />
          현재 PLAY강릉 광고 서비스는 시범 운영 기간으로 <strong>무료</strong> 제공되고 있습니다.<br />
          관리자 검수 후 SNS 및 웹 피드에 소개될 수 있습니다.
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Selection — 전체 무료 기간 중 숨김 */}
          <div className="hidden bg-white rounded-2xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-base mb-4">광고 상품 선택</h2>
            <div className="grid grid-cols-3 gap-3">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => set("plan", plan.id)}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${form.plan === plan.id ? plan.activeColor : plan.color}`}
                >
                  <div className="mb-2">{plan.icon}</div>
                  <p className="font-semibold text-sm mb-2">{plan.name}</p>
                  <ul className="space-y-1">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 flex-shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  <span className={`mt-2 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${plan.badgeColor}`}>
                    현재 무료
                  </span>
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
              <Textarea
                placeholder="광고하고 싶은 내용을 자유롭게 작성해주세요."
                rows={4}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
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
                {[images[0], images[1], images[2]].filter(Boolean).length} / 3장 · 자동 최적화
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
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "접수 중..." : "무료 광고 접수하기"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6 mb-8">
          문의: PLAY강릉 운영팀 | 강원특별자치도 강릉시
        </p>
      </div>
    </div>
  );
}
