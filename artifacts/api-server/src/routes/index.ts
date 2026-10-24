import { Router, type IRouter } from "express";
import healthRouter from "./health";
import interviewsRouter from "./interviews";
import interviewAvatarsRouter from "./interview-avatars";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(reportsRouter);
router.use(interviewsRouter);
router.use(interviewAvatarsRouter);

export default router;
