import express from 'express'
import { getThirtyTicketNumbers } from '../controller/getWinningNumbers.controller.js';

const router = express.Router();

router.get("/thirty-tickets", getThirtyTicketNumbers);

export default router;
