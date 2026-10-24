import { randomBytes } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateReportBody,
  CreateReportResponse,
  GetReportParams,
  GetReportResponse,
  GetReportSummaryResponse,
} from "@workspace/api-zod";
import { db, reportsTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/reports", async (req, res): Promise<void> => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { latitude, longitude } = parsed.data;
  if ((latitude === null) !== (longitude === null)) {
    res.status(400).json({
      error: "Latitude and longitude must both be provided or both be empty.",
    });
    return;
  }

  const trackingCode = `ER-${randomBytes(10).toString("hex").toUpperCase()}`;
  const [report] = await db
    .insert(reportsTable)
    .values({
      ...parsed.data,
      trackingCode,
      status: "received",
    })
    .returning();

  res.status(201).json(CreateReportResponse.parse(report));
});

router.get("/reports/summary", async (_req, res): Promise<void> => {
  const [all] = await db.select({ value: count() }).from(reportsTable);
  const [resolved] = await db
    .select({ value: count() })
    .from(reportsTable)
    .where(eq(reportsTable.status, "resolved"));

  res.json(
    GetReportSummaryResponse.parse({
      total: all.value,
      active: all.value - resolved.value,
      resolved: resolved.value,
    }),
  );
});

router.get("/reports/:trackingCode", async (req, res): Promise<void> => {
  const params = GetReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.trackingCode, params.data.trackingCode));

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json(GetReportResponse.parse(report));
});

export default router;
