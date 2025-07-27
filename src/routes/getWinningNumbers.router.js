import express from 'express'
import { getTicketsByDrawTime, getWinningNumbersByLoginId } from '../controller/getWinningNumbers.controller.js';

const router = express.Router();

router.post("/get-winning-numbers", getTicketsByDrawTime);
router.post("/get-winning-slots", getWinningNumbersByLoginId);

export default router;
