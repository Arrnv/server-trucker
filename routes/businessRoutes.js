import express from "express";
import authenticate from "../middlewares/authMiddleware.js";     // ⬅️ NEW universal middleware
import appAuthMiddleware from "../middlewares/appAuthMiddleware.js";


import {
  onboardBusiness,
  onboardBusiness1,
  getMyBusiness,
  getServiceById,
  updateService,
  addDetailForBusiness,
  getAlertsForService,
  getTodayFeedbacks,
} from "../controllers/businessController.js";

import { upload } from "../controllers/businessController.js";
import supabase from "../utils/supabaseClient.js";

const router = express.Router();

router.post(
  "/onboardapp",
  appAuthMiddleware,
  upload.single("logo"),
  onboardBusiness1
);

router.get("/myapp", appAuthMiddleware, getMyBusiness);

router.post(
  "/add-detailapp",
  appAuthMiddleware,
  upload.fields([
    { name: "galleryFiles" },
    { name: "videoFile", maxCount: 1 },
  ]),
  addDetailForBusiness
);

router.get("/alerts/app/:id", appAuthMiddleware, getAlertsForService);

router.post(
  "/onboard",
  authenticate,
  upload.single("logo"),
  onboardBusiness
);

router.get("/my", authenticate, getMyBusiness);

router.get("/service/:id", authenticate, getServiceById);

router.put("/service/:id", authenticate, updateService);

router.post(
  "/add-detail",
  authenticate,
  upload.fields([
    { name: "galleryFiles" },
    { name: "videoFile", maxCount: 1 },
  ]),
  addDetailForBusiness
);

router.get("/alerts/:id", authenticate, getAlertsForService);

router.get("/feedbacks/:detailId", getTodayFeedbacks);

router.get("/me", authenticate, async (req, res) => {
  const userEmail = req.user.email;

  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_email", userEmail)
    .single();

  if (error || !data) {
    return res.status(404).json({ message: "Business not found" });
  }

  res.json(data);
});

export default router;
