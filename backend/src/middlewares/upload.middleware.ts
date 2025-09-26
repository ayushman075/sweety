import multer, { FileFilterCallback, MulterError } from 'multer';
import { Request } from 'express';
import path from 'path';
import fs from 'fs';

// Allowed file types and extensions
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname).toLowerCase();
        cb(null, `sweet-${uniqueSuffix}${extension}`);
    }
});

// File filter for validation
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
        return cb(new Error(`Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
    
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(new Error(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
    
    cb(null, true);
};

// Configure multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
    },
    fileFilter: fileFilter
});

// Export the single upload function
export const uploadSweetImage = upload.single('image');

// Clean up uploaded files utility
export const cleanupUploadedFiles = (files: Express.Multer.File[]): void => {
    files.forEach(file => {
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
    });
};

export default upload;
