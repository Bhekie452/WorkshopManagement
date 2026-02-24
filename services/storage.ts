import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    uploadBytesResumable,
    UploadTask,
    UploadTaskSnapshot
} from 'firebase/storage';
import { storage } from './firebase';

export interface UploadProgress {
    bytesTransferred: number;
    totalBytes: number;
    progress: number;
}

export class StorageService {
    // Upload a file to Firebase Storage
    static async uploadFile(
        file: File,
        path: string,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<string> {
        try {
            // Create a storage reference
            const storageRef = ref(storage, path);

            if (onProgress) {
                // Upload with progress tracking
                const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);

                return new Promise((resolve, reject) => {
                    uploadTask.on(
                        'state_changed',
                        (snapshot: UploadTaskSnapshot) => {
                            const progress: UploadProgress = {
                                bytesTransferred: snapshot.bytesTransferred,
                                totalBytes: snapshot.totalBytes,
                                progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                            };
                            onProgress(progress);
                        },
                        (error) => {
                            console.error('Upload error:', error);
                            reject(error);
                        },
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            resolve(downloadURL);
                        }
                    );
                });
            } else {
                // Simple upload without progress
                const snapshot = await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(snapshot.ref);
                return downloadURL;
            }
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    }

    // Upload multiple files
    static async uploadMultipleFiles(
        files: File[],
        basePath: string,
        onProgress?: (fileIndex: number, progress: UploadProgress) => void
    ): Promise<string[]> {
        try {
            const uploadPromises = files.map((file, index) => {
                const filePath = `${basePath}/${Date.now()}_${file.name}`;
                return this.uploadFile(
                    file,
                    filePath,
                    onProgress ? (progress) => onProgress(index, progress) : undefined
                );
            });

            return await Promise.all(uploadPromises);
        } catch (error) {
            console.error('Multiple file upload error:', error);
            throw error;
        }
    }

    // Delete a file from Firebase Storage
    static async deleteFile(fileUrl: string): Promise<void> {
        try {
            // Extract the file path from the download URL
            const fileRef = ref(storage, fileUrl);
            await deleteObject(fileRef);
        } catch (error) {
            console.error('File deletion error:', error);
            throw error;
        }
    }

    // Delete multiple files
    static async deleteMultipleFiles(fileUrls: string[]): Promise<void> {
        try {
            const deletePromises = fileUrls.map(url => this.deleteFile(url));
            await Promise.all(deletePromises);
        } catch (error) {
            console.error('Multiple file deletion error:', error);
            throw error;
        }
    }

    // Generate a unique file path
    static generateFilePath(folder: string, fileName: string): string {
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        return `${folder}/${timestamp}_${sanitizedFileName}`;
    }

    // Compress and upload image
    static async uploadImage(
        file: File,
        folder: string,
        maxWidth: number = 1920,
        maxHeight: number = 1080,
        quality: number = 0.8
    ): Promise<string> {
        try {
            // Create a canvas to resize the image
            const compressedFile = await this.compressImage(file, maxWidth, maxHeight, quality);
            const filePath = this.generateFilePath(folder, file.name);
            return await this.uploadFile(compressedFile, filePath);
        } catch (error) {
            console.error('Image upload error:', error);
            throw error;
        }
    }

    // Compress image using canvas
    private static compressImage(
        file: File,
        maxWidth: number,
        maxHeight: number,
        quality: number
    ): Promise<File> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const compressedFile = new File([blob], file.name, {
                                    type: 'image/jpeg',
                                    lastModified: Date.now()
                                });
                                resolve(compressedFile);
                            } else {
                                reject(new Error('Image compression failed'));
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };

                img.onerror = () => reject(new Error('Image loading failed'));
            };

            reader.onerror = () => reject(new Error('File reading failed'));
        });
    }

    // Validate file type
    static validateFileType(file: File, allowedTypes: string[]): boolean {
        return allowedTypes.some(type => file.type.startsWith(type));
    }

    // Validate file size (in MB)
    static validateFileSize(file: File, maxSizeMB: number): boolean {
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        return file.size <= maxSizeBytes;
    }

    // Storage folder paths
    static readonly Folders = {
        CUSTOMER_ATTACHMENTS: 'customers/attachments',
        JOB_ATTACHMENTS: 'jobs/attachments',
        VEHICLE_PHOTOS: 'vehicles/photos',
        INVOICES: 'invoices',
        USER_AVATARS: 'users/avatars',
        DIAGNOSTICS: 'diagnostics'
    } as const;
}
