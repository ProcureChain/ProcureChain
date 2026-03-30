import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const requestId = incoming ? String(incoming) : crypto.randomUUID();

  // attach
  (req as any).requestId = requestId;

  // return to client
  res.setHeader('x-request-id', requestId);

  next();
}
