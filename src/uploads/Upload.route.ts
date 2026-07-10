import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HTTP_STATUS } from "../utils/constants.js";

const router = Router();

/**
 * Route to upload a file to Cloudinary
 * Endpoint: POST /api/v1/uploads
 * Parameter: multipart form-data with key "file" and optional "folder"
 */
router.post(
  "/",
  authMiddleware as any,
  upload.single("file"),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const file = req.file;

    if (!file) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, "No file uploaded");
    }

    const folder = (req.body.folder as string) || "care-ganga";

    // Upload to Cloudinary
    const cloudinaryResponse = await uploadOnCloudinary(file.path, folder);

    if (!cloudinaryResponse) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "Failed to upload file to Cloudinary"
      );
    }

    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, "File uploaded successfully to Cloudinary", {
        url: cloudinaryResponse.secure_url,
        publicId: cloudinaryResponse.public_id,
        bytes: cloudinaryResponse.bytes,
        format: cloudinaryResponse.format,
      })
    );
  }) as any
);

export default router;
