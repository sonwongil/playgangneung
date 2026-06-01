---
name: 이미지 업로드 라우트 구조
description: admin.tsx에서 사용하는 이미지 업로드 API 엔드포인트 목록. 원복/리팩터 시 삭제 금지.
---

admin.tsx가 사용하는 이미지 업로드 라우트 3개는 반드시 서버에 존재해야 한다.

| 라우트 | 사용처 | 코드 위치 |
|--------|--------|-----------|
| `POST /api/upload-image` | TOP5 이미지 변경 다이얼로그 파일 업로드 | admin.tsx line ~7157 |
| `POST /api/events/:id/upload-image?slot=N` | 이벤트 대표(slot=0) / 추가 이미지(slot≥1) | admin.tsx 이벤트 편집 |
| `POST /api/ads/:id/upload-image?slot=N` | 광고 대표(slot=0) / 추가 이미지(slot≥1) | admin.tsx line ~6544 |

**Why:** /api/upload-image generic 라우트가 없으면 TOP5 이미지 변경 파일 업로드가 서버에 도달하지 못해 404로 조용히 실패한다. 오늘 원복 작업 중 이 라우트를 삭제했다가 관리자가 4번 업로드해도 thumbnail이 null로 유지되는 문제가 발생했다.

**How to apply:** events.ts 원복/수정 시 /upload-image generic 라우트가 제거되지 않았는지 반드시 확인한다. diskStorage 방식(multer)으로 /api/uploads/에 저장하고 { success, url } 반환.
