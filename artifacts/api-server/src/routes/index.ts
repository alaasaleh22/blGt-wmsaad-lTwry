import { Router, type IRouter } from "express";
import healthRouter from "./health";
import interviewsRouter from "./interviews";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportsRouter);
router.use(interviewsRouter);

export default router;
