import express from 'express'
import { getTodaysTicketNumbers, saveWinningNumbers } from '../controller/winnermaster.controller.js';

const router = express.Router();

router.get("/winner-master-manual", getTodaysTicketNumbers);
router.post("/winner-master-manual-save", saveWinningNumbers);

export default router;