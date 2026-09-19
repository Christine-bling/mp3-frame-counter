import { Request, Response, NextFunction } from 'express';
import { InvalidMp3Error, UnsupportedFormatError } from './mp3/errors';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof InvalidMp3Error || err instanceof UnsupportedFormatError) {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
