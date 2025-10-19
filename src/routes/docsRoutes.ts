import { Router } from "express";
import { generateRepoDocsLocal } from "../controllers/docsController";

const router = Router();
// POST /api/docs/:owner/:repo/:commit
router.post("/:owner/:repo/:commit", generateRepoDocsLocal);

export default router;