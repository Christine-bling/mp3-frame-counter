import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { parseMp3FrameCount } from '../mp3/parseMp3FrameCount';

const upload = multer({ storage: multer.memoryStorage() });

export const fileUploadRouter = Router();

fileUploadRouter.post(
  '/file-upload',
  upload.single('file'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: 'No file uploaded. Expected multipart field "file".' });
      }

      const frameCount = parseMp3FrameCount(req.file.buffer);

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({ frameCount });
    } catch (err) {
      next(err);
    }
  },
);
