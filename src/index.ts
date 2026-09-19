import express from 'express';
import { fileUploadRouter } from './routes/fileUpload';
import { errorHandler } from './errorHandler';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(fileUploadRouter);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
