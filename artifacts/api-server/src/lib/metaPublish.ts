/**
 * Meta 통합 발행 레이어
 *
 * publishType : SINGLE_FEED | TOP5_CAROUSEL
 * channel     : FACEBOOK_PAGE | INSTAGRAM
 *
 * 모든 발행 함수는 구조화된 로그를 남기며 토큰 원문을 절대 노출하지 않는다.
 */
import { logger } from "./logger.js";
import {
  isTokenExpiredError,
  TOKEN_EXPIRED_USER_MSG,
  getPageAccessToken,
  getTokenSource,
  maskToken,
  uploadPagePhoto,
  createPageFeedPost,
  createPageCarouselPost,
  createIgMediaContainer,
  publishIgMedia,
} from "./metaApi.js";

// ─── 공개 타입 ────────────────────────────────────────────────────────────────

export type PublishType = "SINGLE_FEED" | "TOP5_CAROUSEL";
export type Channel    = "FACEBOOK_PAGE" | "INSTAGRAM";

export interface PublishCard {
  title    : string;
  summary  : string;
  imageUrl : string;
  linkUrl  : string;
}

export type PublishResult =
  | {
      ok          : true;
      postId      : string;
      channel     : Channel;
      publishType : PublishType;
      photoCount ?: number;
    }
  | {
      ok           : false;
      error        : string;
      tokenExpired?: boolean;
      devError    ?: string;
    };

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

function baseLog(
  publishType  : PublishType,
  channel      : Channel,
  functionName : string,
  extra        : Record<string, unknown> = {},
) {
  return {
    publishType,
    channel,
    tokenType  : "USER" as "USER" | "PAGE",   // Facebook 경로에서 PAGE로 업데이트
    tokenSource: getTokenSource(),
    tokenMasked: maskToken(),
    functionName,
    pageId                     : process.env["META_PAGE_ID"] ?? null,
    instagramBusinessAccountId : process.env["INSTAGRAM_BUSINESS_ACCOUNT_ID"] ?? null,
    ...extra,
  };
}

function toPublishError(
  error       : string,
  code       ?: number,
  channel     : Channel      = "FACEBOOK_PAGE",
  publishType : PublishType  = "SINGLE_FEED",
): PublishResult {
  const expired = isTokenExpiredError(error, code);
  return {
    ok          : false,
    error       : expired ? TOKEN_EXPIRED_USER_MSG : "Meta 게시 실패. 잠시 후 다시 시도해 주세요.",
    tokenExpired: expired,
    devError    : error,
  };
}

// ─── 1. SINGLE_FEED → FACEBOOK_PAGE ─────────────────────────────────────────

export async function publishSingleFeedToFacebook(
  card   : PublishCard,
  pageId : string,
): Promise<PublishResult> {
  const ctx = baseLog("SINGLE_FEED", "FACEBOOK_PAGE", "publishSingleFeedToFacebook", { pageId });

  const pageToken = await getPageAccessToken(pageId);
  ctx.tokenType   = pageToken ? "PAGE" : "USER";
  logger.info(ctx, "단일 피드 Facebook 발행 시작");

  const message = `${card.title}\n\n${card.summary}`;
  // picture 파라미터는 Meta가 link URL의 OG 태그에서 자동 스크랩
  // 외부 이미지 URL을 직접 지정하면 (#100) 오류 발생
  const result  = await createPageFeedPost(pageId, message, {
    link: card.linkUrl,
  });

  if (!result.ok) {
    logger.error({ ...ctx, devError: result.error, code: result.code }, "단일 피드 Facebook 발행 실패");
    return toPublishError(result.error, result.code, "FACEBOOK_PAGE", "SINGLE_FEED");
  }

  logger.info({ ...ctx, postId: result.data.id }, "단일 피드 Facebook 발행 완료");
  return { ok: true, postId: result.data.id, channel: "FACEBOOK_PAGE", publishType: "SINGLE_FEED" };
}

// ─── 2. SINGLE_FEED → INSTAGRAM ──────────────────────────────────────────────

export async function publishSingleFeedToInstagram(
  card        : PublishCard,
  igAccountId : string,
): Promise<PublishResult> {
  const ctx = baseLog("SINGLE_FEED", "INSTAGRAM", "publishSingleFeedToInstagram", {
    instagramBusinessAccountId: igAccountId,
  });
  logger.info(ctx, "단일 피드 Instagram 발행 시작");

  if (!card.imageUrl) {
    return {
      ok      : false,
      error   : "Instagram 발행에는 이미지 URL이 필수입니다.",
      devError: "imageUrl 없음",
    };
  }

  const caption = `${card.title}\n\n${card.summary}\n🔗 ${card.linkUrl}`;

  // 1단계: 미디어 컨테이너 생성
  const containerResult = await createIgMediaContainer(igAccountId, {
    imageUrl : card.imageUrl,
    caption,
    mediaType: "IMAGE",
  });

  if (!containerResult.ok) {
    logger.error({ ...ctx, devError: containerResult.error }, "Instagram 미디어 컨테이너 생성 실패");
    return toPublishError(containerResult.error, containerResult.code, "INSTAGRAM", "SINGLE_FEED");
  }

  // 2단계: 발행
  const publishResult = await publishIgMedia(igAccountId, containerResult.data.id);
  if (!publishResult.ok) {
    logger.error({ ...ctx, devError: publishResult.error }, "Instagram 미디어 발행 실패");
    return toPublishError(publishResult.error, publishResult.code, "INSTAGRAM", "SINGLE_FEED");
  }

  logger.info({ ...ctx, postId: publishResult.data.id }, "단일 피드 Instagram 발행 완료");
  return { ok: true, postId: publishResult.data.id, channel: "INSTAGRAM", publishType: "SINGLE_FEED" };
}

// ─── 3. TOP5_CAROUSEL → FACEBOOK_PAGE ────────────────────────────────────────

export async function publishCarouselToFacebook(
  cards  : PublishCard[],
  pageId : string,
): Promise<PublishResult> {
  const ctx = baseLog("TOP5_CAROUSEL", "FACEBOOK_PAGE", "publishCarouselToFacebook", { pageId });

  const pageToken = await getPageAccessToken(pageId);
  ctx.tokenType   = pageToken ? "PAGE" : "USER";
  logger.info({ ...ctx, cardCount: cards.length }, "TOP5 캐러셀 Facebook 발행 시작");

  // 각 카드 이미지 임시 업로드
  const photoIds: string[] = [];
  for (const card of cards) {
    if (card.imageUrl) {
      const r = await uploadPagePhoto(pageId, card.imageUrl, card.title);
      if (r.ok) {
        photoIds.push(r.data.id);
      } else {
        logger.warn({ ...ctx, title: card.title, devError: r.error }, "카드 이미지 업로드 실패 (skip)");
      }
    }
  }

  // 메시지 조합
  const message = [
    "🏖️ PLAY강릉 오늘의 TOP5",
    "",
    ...cards.map((c, i) => `${i + 1}. ${c.title}\n🔗 ${c.linkUrl}`),
  ].join("\n");

  const postResult = await createPageCarouselPost(pageId, message, photoIds);
  if (!postResult.ok) {
    logger.error({ ...ctx, devError: postResult.error, code: postResult.code }, "TOP5 캐러셀 Facebook 발행 실패");
    return toPublishError(postResult.error, postResult.code, "FACEBOOK_PAGE", "TOP5_CAROUSEL");
  }

  logger.info({ ...ctx, postId: postResult.data.id, photoCount: photoIds.length }, "TOP5 캐러셀 Facebook 발행 완료");
  return {
    ok         : true,
    postId     : postResult.data.id,
    channel    : "FACEBOOK_PAGE",
    publishType: "TOP5_CAROUSEL",
    photoCount : photoIds.length,
  };
}

// ─── 4. TOP5_CAROUSEL → INSTAGRAM ────────────────────────────────────────────

export async function publishCarouselToInstagram(
  cards       : PublishCard[],
  igAccountId : string,
): Promise<PublishResult> {
  const ctx = baseLog("TOP5_CAROUSEL", "INSTAGRAM", "publishCarouselToInstagram", {
    instagramBusinessAccountId: igAccountId,
    cardCount                 : cards.length,
  });
  logger.info(ctx, "TOP5 캐러셀 Instagram 발행 시작");

  const cardsWithImage = cards.filter((c) => c.imageUrl);
  if (cardsWithImage.length === 0) {
    return {
      ok      : false,
      error   : "Instagram 캐러셀 발행에는 이미지가 있는 카드가 1개 이상 필요합니다.",
      devError: "모든 카드에 imageUrl 없음",
    };
  }

  // 1단계: 각 카드를 캐러셀 아이템 컨테이너로 생성
  const itemIds: string[] = [];
  for (const card of cardsWithImage) {
    const r = await createIgMediaContainer(igAccountId, {
      imageUrl      : card.imageUrl,
      isCarouselItem: true,
    });
    if (r.ok) {
      itemIds.push(r.data.id);
    } else {
      logger.warn({ ...ctx, title: card.title, devError: r.error }, "IG 캐러셀 아이템 생성 실패 (skip)");
    }
  }

  if (itemIds.length === 0) {
    return { ok: false, error: "Instagram 캐러셀 아이템 생성에 모두 실패했습니다.", devError: "itemIds 없음" };
  }

  // 2단계: 캐러셀 컨테이너 생성
  const caption = [
    "🏖️ PLAY강릉 오늘의 TOP5",
    "",
    ...cards.map((c, i) => `${i + 1}. ${c.title}\n🔗 ${c.linkUrl}`),
  ].join("\n");

  const containerResult = await createIgMediaContainer(igAccountId, {
    mediaType: "CAROUSEL",
    children : itemIds,
    caption,
  });

  if (!containerResult.ok) {
    logger.error({ ...ctx, devError: containerResult.error }, "IG 캐러셀 컨테이너 생성 실패");
    return toPublishError(containerResult.error, containerResult.code, "INSTAGRAM", "TOP5_CAROUSEL");
  }

  // 3단계: 발행
  const publishResult = await publishIgMedia(igAccountId, containerResult.data.id);
  if (!publishResult.ok) {
    logger.error({ ...ctx, devError: publishResult.error }, "IG 캐러셀 발행 실패");
    return toPublishError(publishResult.error, publishResult.code, "INSTAGRAM", "TOP5_CAROUSEL");
  }

  logger.info({ ...ctx, postId: publishResult.data.id, itemCount: itemIds.length }, "TOP5 캐러셀 Instagram 발행 완료");
  return {
    ok         : true,
    postId     : publishResult.data.id,
    channel    : "INSTAGRAM",
    publishType: "TOP5_CAROUSEL",
    photoCount : itemIds.length,
  };
}
