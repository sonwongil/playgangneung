/**
 * 통합 발행 라우트
 *
 * POST /api/publish/single-feed  — 단일 피드 발행 (FACEBOOK_PAGE | INSTAGRAM)
 * POST /api/publish/carousel     — TOP5 캐러셀 발행 (FACEBOOK_PAGE | INSTAGRAM)
 */
import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import {
  publishSingleFeedToFacebook,
  publishSingleFeedToInstagram,
  publishCarouselToFacebook,
  publishCarouselToInstagram,
  type Channel,
  type PublishCard,
} from "../lib/metaPublish.js";

const router = Router();

// ─── POST /api/publish/single-feed ───────────────────────────────────────────
router.post("/publish/single-feed", requireAdmin, async (req, res) => {
  try {
    const { channel, card } = req.body as {
      channel: Channel;
      card: PublishCard;
    };

    if (!channel || !card) {
      return res.status(400).json({ error: "channel 과 card 필드 필수" });
    }
    if (!["FACEBOOK_PAGE", "INSTAGRAM"].includes(channel)) {
      return res.status(400).json({ error: "channel 은 FACEBOOK_PAGE 또는 INSTAGRAM 이어야 합니다" });
    }

    let result;
    if (channel === "FACEBOOK_PAGE") {
      const pageId = process.env["META_PAGE_ID"];
      if (!pageId) return res.status(503).json({ error: "META_PAGE_ID 환경변수 미설정" });
      result = await publishSingleFeedToFacebook(card, pageId);
    } else {
      const igId = process.env["INSTAGRAM_BUSINESS_ACCOUNT_ID"];
      if (!igId) return res.status(503).json({ error: "INSTAGRAM_BUSINESS_ACCOUNT_ID 환경변수 미설정" });
      result = await publishSingleFeedToInstagram(card, igId);
    }

    if (!result.ok) {
      return res.status(502).json({
        error       : result.error,
        tokenExpired: result.tokenExpired ?? false,
        devError    : result.devError,
      });
    }
    return res.json({ ok: true, postId: result.postId, channel, publishType: "SINGLE_FEED" });
  } catch (err) {
    req.log.error({ err }, "publish/single-feed 오류");
    return res.status(500).json({ error: "서버 오류" });
  }
});

// ─── POST /api/publish/carousel ───────────────────────────────────────────────
router.post("/publish/carousel", requireAdmin, async (req, res) => {
  try {
    const { channel, cards } = req.body as {
      channel: Channel;
      cards: PublishCard[];
    };

    if (!channel || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: "channel 과 cards 배열(1개 이상) 필수" });
    }
    if (!["FACEBOOK_PAGE", "INSTAGRAM"].includes(channel)) {
      return res.status(400).json({ error: "channel 은 FACEBOOK_PAGE 또는 INSTAGRAM 이어야 합니다" });
    }

    let result;
    if (channel === "FACEBOOK_PAGE") {
      const pageId = process.env["META_PAGE_ID"];
      if (!pageId) return res.status(503).json({ error: "META_PAGE_ID 환경변수 미설정" });
      result = await publishCarouselToFacebook(cards, pageId);
    } else {
      const igId = process.env["INSTAGRAM_BUSINESS_ACCOUNT_ID"];
      if (!igId) return res.status(503).json({ error: "INSTAGRAM_BUSINESS_ACCOUNT_ID 환경변수 미설정" });
      result = await publishCarouselToInstagram(cards, igId);
    }

    if (!result.ok) {
      return res.status(502).json({
        error       : result.error,
        tokenExpired: result.tokenExpired ?? false,
        devError    : result.devError,
      });
    }
    return res.json({
      ok        : true,
      postId    : result.postId,
      channel,
      publishType: "TOP5_CAROUSEL",
      photoCount: result.photoCount,
    });
  } catch (err) {
    req.log.error({ err }, "publish/carousel 오류");
    return res.status(500).json({ error: "서버 오류" });
  }
});

export default router;
