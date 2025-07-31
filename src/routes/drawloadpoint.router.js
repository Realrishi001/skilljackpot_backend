import express from 'express'
import { getTicketsBySeries, getTicketSummary } from '../controller/drawloadpoint.controller.js';

const router = express.Router();

router.get("/draw-details", getTicketSummary);
router.get("/table-draw-details", getTicketsBySeries);

export default router;