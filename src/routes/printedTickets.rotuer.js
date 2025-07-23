import { savePrintedTickets } from "../controller/printedTickets.controller.js";
import express from "express"

const router = express.Router();

router.post("/saveTicket", savePrintedTickets);

export default router;
