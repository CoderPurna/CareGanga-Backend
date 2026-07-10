import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configure Cloudinary SDK with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a local file to Cloudinary and cleans up the local temporary file
 * @param localFilePath Path to the file stored temporarily on server
 * @param folder Cloudinary folder designation (defaults to "care-ganga")
 * @returns Cloudinary upload response object or null
 */
export const uploadOnCloudinary = async (localFilePath: string, folder: string = "care-ganga") => {
  try {
    if (!localFilePath) return null;

    // Upload the file to Cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: folder,
    });

    // File uploaded successfully, remove the local file
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return response;
  } catch (error) {
    // Remove the local file since upload operation failed
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    console.error("Cloudinary upload failed: ", error);
    return null;
  }
};
