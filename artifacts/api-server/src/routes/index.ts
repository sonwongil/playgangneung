import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import eventsRouter from "./events.js";
import adminRouter from "./admin.js";
import adsRouter from "./ads.js";
import feedRouter from "./feed.js";
import authRouter from "./auth.js";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(eventsRouter);
router.use(adminRouter);
router.use(adsRouter);
router.use(feedRouter);

export default router;
