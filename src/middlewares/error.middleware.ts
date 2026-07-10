import { Request, Response, NextFunction } from "express";

import { ApiError } from "../utils/api-error.js";
import { Prisma } from "../generated/prisma/index.js";
import { HTTP_STATUS } from "../utils/constants.js";

const DB_CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
]);

function mapPrismaError(error: any): ApiError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (DB_CONNECTION_ERROR_CODES.has(error.code)) {
      return new ApiError(
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        "Database connection failed",
        [{ code: error.code }],
        error.stack
      );
    }

    switch (error.code) {
      case "P2002":
        return new ApiError(
          HTTP_STATUS.CONFLICT,
          "Unique constraint failed",
          [{ code: error.code, target: (error.meta as any)?.target }],
          error.stack
        );
      case "P2025":
        return new ApiError(
          HTTP_STATUS.NOT_FOUND,
          "Record not found",
          [{ code: error.code }],
          error.stack
        );
      case "P2003":
        return new ApiError(
          HTTP_STATUS.CONFLICT,
          "Foreign key constraint failed",
          [{ code: error.code, field: (error.meta as any)?.field_name }],
          error.stack
        );
      default:
        return new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          error.message || "Database request error",
          [{ code: error.code }],
          error.stack
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      "Invalid data provided",
      [error.message],
      error.stack
    );
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Database initialization failed",
      [],
      error.stack
    );
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "Database engine error",
      [],
      error.stack
    );
  }

  if (DB_CONNECTION_ERROR_CODES.has(error?.code)) {
    return new ApiError(
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      "Database connection failed",
      [{ code: error.code }],
      error?.stack
    );
  }

  return null;
}

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const prismaError = mapPrismaError(error);

    if (prismaError) {
      error = prismaError;
    } else {
      const statusCode = error?.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
      const message = error?.message || "Something went wrong";
      error = new ApiError(statusCode, message, error?.errors || [], error?.stack);
    }
  }

  const response = {
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors,
    success: false,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  console.error(`[ERROR] ${error.message}`);

  return res.status(error.statusCode).json(response);
};

export { errorHandler };
