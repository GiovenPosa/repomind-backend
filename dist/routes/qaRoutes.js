"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const qaController_1 = require("../controllers/qaController");
const router = (0, express_1.Router)();
router.post("/:owner/:repo", qaController_1.askRepo);
exports.default = router;
