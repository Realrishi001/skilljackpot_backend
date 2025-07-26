import express from 'express'
import { getTicketsByDrawTime } from '../controller/getWinningNumbers.controller.js';

const router = express.Router();

router.post("/get-winning-numbers", getTicketsByDrawTime);

export default router;
