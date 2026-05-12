import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

declare const __BUILD_TIME__: string;

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/version", (_req, res) => {
  const buildTime = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : new Date().toISOString();
  res.json({ buildTime });
});

export default router;
