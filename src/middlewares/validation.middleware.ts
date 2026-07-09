import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError, ZodIssue } from "zod";
import { ApiError } from "../utils/api-error.js";
import { HTTP_STATUS } from "../utils/constants.js";

/**
 * Express middleware to validate request body using a Zod schema
 */
export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((err: ZodIssue) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        
        return next(
          new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            "Validation failed",
            errorMessages
          )
        );
      }
      next(error);
    }
  };
};
