import express from 'express'
import { setWinningPercentage, getWinningPercentage } from '../controller/winningPercentage.controller.js';

const router = express.Router();

router.post("/winning-percentage", setWinningPercentage); 
router.get("/get-winning-percentage", getWinningPercentage);  

export default router;