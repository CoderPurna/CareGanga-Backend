import { Request, Response, NextFunction, RequestHandler } from "express";

function asyncHandler(
  requestHandler: (req: Request, res: Response, next: NextFunction) => any
): RequestHandler {
  return function (req: Request, res: Response, next: NextFunction) {
    Promise.resolve(requestHandler(req, res, next)).catch(function (err) {
      next(err);
    });
  };
}

export { asyncHandler };
