import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
// import helmet from "helmet";

import { errorHandler } from "./middlewares/error.middleware.js";
import userRouter from "./service/user/User.route.js";
import campaignRouter from "./service/campaigns/Campaign.route.js";
import ngoRouter from "./service/ngo/NGO.route.js";
import donationRouter from "./service/donations/Donation.route.js";
import uploadRouter from "./service/uploads/Upload.route.js";
import paymentRouter from "./service/payments/Payment.route.js";
import membershipRouter from "./service/memberships/Membership.route.js";
import volunteerRouter from "./service/volunteers/Volunteer.route.js";
import csrRouter from "./service/csr/CSR.route.js";
import taskRouter from "./service/tasks/Task.route.js";
import publicRouter from "./service/public/Public.route.js";
import dashboardRouter from "./service/dashboard/Dashboard.route.js";
import adminRouter from "./service/admin/Admin.route.js";
import { HTTP_STATUS } from "./utils/constants.js";

const app = express();

app.set("trust proxy", 1);

// app.use(helmet());
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); // configure static file to save images locally
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
      : [process.env.CLIENT_URL || "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  })
);

app.use("/api/v1/users", userRouter);
app.use("/api/v1/campaigns", campaignRouter);
app.use("/api/v1/ngos", ngoRouter);
app.use("/api/v1/donations", donationRouter);
app.use("/api/v1/uploads", uploadRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/memberships", membershipRouter);
app.use("/api/v1/volunteers", volunteerRouter);
app.use("/api/v1/csr", csrRouter);
app.use("/api/v1/tasks", taskRouter);
app.use("/api/v1/public", publicRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/admin", adminRouter);

app.use("/api/v1/health", (req: Request, res: Response) => {
  res.status(HTTP_STATUS.OK).json({
    status: "success",
    message: "Server is running",
  });
});

app.use(errorHandler);

export default app;
