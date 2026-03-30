import { RequestContext } from './request-context';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request {
      ctx?: RequestContext;
      requestId?: string;
    }
  }
}

export {};
