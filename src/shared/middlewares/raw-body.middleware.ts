/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-namespace */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Extend Request interface to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only apply raw body handling to webhook routes
    if (req.path.includes('/webhooks/stripe')) {
      let data = '';
      req.setEncoding('utf8');

      req.on('data', (chunk) => {
        data += chunk;
      });

      req.on('end', () => {
        // Store raw body as Buffer for Stripe signature verification
        req.rawBody = Buffer.from(data, 'utf8');
        next();
      });
    } else {
      next();
    }
  }
}
