import express from "express";
import { getWinningNumbersByLoginId } from "../controller/winningNumbers.controller.js";

const router = express.Router();

router.post("/show-winning-numbers", getWinningNumbersByLoginId);

export default router;