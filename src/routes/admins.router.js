import { adminLogin, createAdmin, getAllAdmins } from '../controller/admins.controller.js';
import express from 'express'

const router = express.Router();

router.post('/create-admin', createAdmin);
router.get("/get-admins", getAllAdmins);
router.post("/login-admin", adminLogin);

export default router;