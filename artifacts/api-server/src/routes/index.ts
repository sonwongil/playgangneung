import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import eventsRouter from "./events.js";
import adminRouter from "./admin.js";
import adsRouter from "./ads.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(adminRouter);
router.use(adsRouter);

export default router;
