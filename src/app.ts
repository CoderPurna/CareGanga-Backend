import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
// import helmet from "helmet";

import { errorHandler } from "./middlewares/error.middleware.js";
import userRouter from "./user/User.route.js";
import campaignRouter from "./campaigns/Campaign.route.js";
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
  }),
);

app.use("/api/v1/users", userRouter);
app.use("/api/v1/campaigns", campaignRouter);

app.use("/api/v1/health", (req: Request, res: Response) => {
  res.status(HTTP_STATUS.OK).json({
    status: "success",
    message: "Server is running",
  });
});

app.use(errorHandler);

export default app;
