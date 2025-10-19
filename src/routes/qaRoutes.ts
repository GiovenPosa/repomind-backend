import { Router } from "express";
import { askRepo } from "../controllers/qaController";
const router = Router();

router.post("/:owner/:repo", askRepo);

export default router;