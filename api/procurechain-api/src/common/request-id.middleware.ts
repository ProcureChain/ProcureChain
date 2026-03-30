import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const requestId = incoming ? String(incoming) : crypto.randomUUID();

  // Keep the same correlation id all the way through the request if the caller
  // already supplied one. That makes it possible to trace a single action
  // across the web app, API logs, and any downstream tooling.
  (req as any).requestId = requestId;

  // Always echo the request id back so support and QA can quote it directly
  // from the browser response when they need to trace a failing call.
  res.setHeader('x-request-id', requestId);

  next();
}
