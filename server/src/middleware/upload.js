import multer from 'multer';
import { AppError } from './errorHandler.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const excelMimeTypes = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
]);

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const fileFilter = (allowedMimes, allowedExtensions) => (req, file, cb) => {
  const ext = file.originalname?.split('.').pop()?.toLowerCase();
  if (!allowedExtensions.includes(ext) || !allowedMimes.has(file.mimetype)) {
    return cb(new AppError('Invalid file type.', 400));
  }
  return cb(null, true);
};

export const checkerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: fileFilter(excelMimeTypes, ['xlsx', 'csv']),
});

export const sliderUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: fileFilter(imageMimeTypes, ['jpg', 'jpeg', 'png', 'webp', 'gif']),
});
