# @objectstack/service-storage

Storage Service for ObjectStack — implements `IStorageService` with local filesystem and S3 adapter skeleton.

## Features

- **Multiple Adapters**: Local filesystem (development) and S3-compatible storage (production)
- **File Upload**: Upload files with automatic path management
- **File Download**: Retrieve files with streaming support
- **URL Generation**: Generate signed URLs for secure access
- **Metadata**: Store and retrieve file metadata
- **Directory Operations**: Create, list, and delete directories
- **Multipart Upload**: Support for large file uploads
- **Type-Safe**: Full TypeScript support

## Installation

```bash
pnpm add @objectstack/service-storage
```

For S3 adapter:
```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Basic Usage

```typescript
import { defineStack } from '@objectstack/spec';
import { ServiceStorage } from '@objectstack/service-storage';

const stack = defineStack({
  services: [
    ServiceStorage.configure({
      adapter: 'local', // or 's3'
      basePath: './uploads',
    }),
  ],
});
```

## Configuration

### Local Filesystem Adapter (Development)

```typescript
ServiceStorage.configure({
  adapter: 'local',
  basePath: './uploads',
  baseUrl: 'http://localhost:3000/uploads',
});
```

### S3 Adapter (Production)

```typescript
ServiceStorage.configure({
  adapter: 's3',
  s3: {
    bucket: 'my-bucket',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
  baseUrl: 'https://my-bucket.s3.amazonaws.com',
});
```

### S3-Compatible Services (Cloudflare R2, DigitalOcean Spaces, MinIO)

```typescript
ServiceStorage.configure({
  adapter: 's3',
  s3: {
    bucket: 'my-bucket',
    region: 'auto',
    endpoint: 'https://r2.cloudflarestorage.com/account-id',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  },
});
```

## Service API

```typescript
// Get storage service
const storage = kernel.getService<IStorageService>('storage');
```

### File Upload

```typescript
// Upload a file from buffer
await storage.upload({
  path: 'documents/contract.pdf',
  data: fileBuffer,
  contentType: 'application/pdf',
  metadata: {
    userId: 'user:123',
    category: 'contracts',
  },
});

// Upload from stream
await storage.uploadStream({
  path: 'videos/demo.mp4',
  stream: fileStream,
  contentType: 'video/mp4',
});

// Upload with automatic path generation
const path = await storage.uploadAuto({
  data: fileBuffer,
  fileName: 'profile.jpg',
  folder: 'avatars',
  contentType: 'image/jpeg',
});
// Returns: 'avatars/2024/01/15/abc123-profile.jpg'
```

### File Download

```typescript
// Download file as buffer
const file = await storage.download('documents/contract.pdf');
console.log(file.data); // Buffer
console.log(file.contentType); // 'application/pdf'
console.log(file.size); // File size in bytes

// Download as stream
const stream = await storage.downloadStream('videos/demo.mp4');
stream.pipe(res); // Pipe to HTTP response
```

### File Management

```typescript
// Check if file exists
const exists = await storage.exists('documents/contract.pdf');

// Get file metadata
const metadata = await storage.getMetadata('documents/contract.pdf');
// {
//   size: 1024000,
//   contentType: 'application/pdf',
//   lastModified: Date,
//   metadata: { userId: 'user:123', category: 'contracts' }
// }

// Delete file
await storage.delete('documents/contract.pdf');

// Copy file
await storage.copy({
  from: 'documents/contract.pdf',
  to: 'archive/2024/contract.pdf',
});

// Move file
await storage.move({
  from: 'temp/upload.pdf',
  to: 'documents/contract.pdf',
});
```

### Directory Operations

```typescript
// List files in directory
const files = await storage.list('documents', {
  recursive: false,
  limit: 100,
});
// Returns: ['contract.pdf', 'invoice.pdf', 'report.docx']

// List with metadata
const files = await storage.listDetailed('documents');
// Returns: [
//   { path: 'contract.pdf', size: 1024000, lastModified: Date },
//   { path: 'invoice.pdf', size: 512000, lastModified: Date },
// ]

// Delete directory and all contents
await storage.deleteDirectory('temp');
```

### URL Generation

```typescript
// Generate public URL (for public files)
const url = storage.getUrl('public/logo.png');
// 'https://my-bucket.s3.amazonaws.com/public/logo.png'

// Generate signed URL (for private files, expires in 1 hour)
const signedUrl = await storage.getSignedUrl('documents/contract.pdf', {
  expiresIn: 3600,
  operation: 'read', // or 'write'
});
// 'https://my-bucket.s3.amazonaws.com/documents/contract.pdf?X-Amz-Signature=...'

// Generate upload URL (for direct client uploads)
const uploadUrl = await storage.getUploadUrl('uploads/temp.pdf', {
  expiresIn: 900, // 15 minutes
  contentType: 'application/pdf',
  maxSize: 10485760, // 10MB
});
```

## Advanced Features

### Multipart Upload (Large Files)

```typescript
// Initialize multipart upload
const uploadId = await storage.initMultipartUpload({
  path: 'large-files/video.mp4',
  contentType: 'video/mp4',
});

// Upload parts (can be done in parallel)
const parts = [];
for (let i = 0; i < chunks.length; i++) {
  const part = await storage.uploadPart({
    uploadId,
    partNumber: i + 1,
    data: chunks[i],
  });
  parts.push(part);
}

// Complete multipart upload
await storage.completeMultipartUpload({
  uploadId,
  parts,
});

// Or abort if failed
await storage.abortMultipartUpload(uploadId);
```

### Direct Browser Upload

```typescript
// Server: Generate presigned POST URL
const presignedPost = await storage.getPresignedPost({
  path: 'uploads/${filename}',
  conditions: [
    ['content-length-range', 0, 10485760], // Max 10MB
    ['starts-with', '$Content-Type', 'image/'], // Only images
  ],
  expiresIn: 900, // 15 minutes
});

// Client: Upload directly to S3 from browser
const formData = new FormData();
Object.entries(presignedPost.fields).forEach(([key, value]) => {
  formData.append(key, value);
});
formData.append('file', file);

await fetch(presignedPost.url, {
  method: 'POST',
  body: formData,
});
```

### Image Processing Integration

```typescript
// Upload original image
await storage.upload({
  path: 'images/original/photo.jpg',
  data: imageBuffer,
  contentType: 'image/jpeg',
});

// Generate and upload thumbnails
const thumbnail = await resizeImage(imageBuffer, { width: 200, height: 200 });
await storage.upload({
  path: 'images/thumbnails/photo.jpg',
  data: thumbnail,
  contentType: 'image/jpeg',
});

const medium = await resizeImage(imageBuffer, { width: 800, height: 800 });
await storage.upload({
  path: 'images/medium/photo.jpg',
  data: medium,
  contentType: 'image/jpeg',
});
```

### File Attachments for Records

```typescript
// Attach file to a record
await storage.upload({
  path: `attachments/opportunity/${opportunityId}/proposal.pdf`,
  data: fileBuffer,
  contentType: 'application/pdf',
  metadata: {
    objectType: 'opportunity',
    recordId: opportunityId,
    uploadedBy: 'user:123',
  },
});

// List attachments for a record
const attachments = await storage.list(`attachments/opportunity/${opportunityId}`);

// Delete all attachments when record is deleted
await storage.deleteDirectory(`attachments/opportunity/${opportunityId}`);
```

## REST API Endpoints

```
POST   /api/v1/storage/upload              # Upload file
GET    /api/v1/storage/download/:path      # Download file
DELETE /api/v1/storage/:path               # Delete file
GET    /api/v1/storage/list                # List files
POST   /api/v1/storage/signed-url          # Generate signed URL
POST   /api/v1/storage/upload-url          # Generate upload URL
GET    /api/v1/storage/metadata/:path      # Get file metadata
```

## Client Integration

### React Component Example

```typescript
import { useStorage } from '@objectstack/client-react';

function FileUploader() {
  const { upload, uploading, progress } = useStorage();

  const handleUpload = async (file: File) => {
    const path = await upload({
      file,
      folder: 'documents',
      onProgress: (percent) => console.log(`Upload: ${percent}%`),
    });

    console.log('Uploaded to:', path);
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {uploading && <progress value={progress} max="100" />}
    </div>
  );
}
```

## Common Patterns

### User Avatar Upload

```typescript
async function uploadAvatar(userId: string, imageFile: Buffer) {
  // Upload original
  const path = `avatars/${userId}/original.jpg`;
  await storage.upload({
    path,
    data: imageFile,
    contentType: 'image/jpeg',
  });

  // Generate thumbnail
  const thumbnail = await resizeImage(imageFile, { width: 128, height: 128 });
  await storage.upload({
    path: `avatars/${userId}/thumbnail.jpg`,
    data: thumbnail,
    contentType: 'image/jpeg',
  });

  return {
    original: storage.getUrl(path),
    thumbnail: storage.getUrl(`avatars/${userId}/thumbnail.jpg`),
  };
}
```

### Document Management

```typescript
async function uploadDocument(doc: {
  recordId: string;
  file: Buffer;
  fileName: string;
  uploadedBy: string;
}) {
  const path = `documents/${doc.recordId}/${Date.now()}-${doc.fileName}`;

  await storage.upload({
    path,
    data: doc.file,
    contentType: getMimeType(doc.fileName),
    metadata: {
      recordId: doc.recordId,
      uploadedBy: doc.uploadedBy,
      fileName: doc.fileName,
    },
  });

  // Create signed URL for secure download
  const downloadUrl = await storage.getSignedUrl(path, { expiresIn: 86400 }); // 24 hours

  return { path, downloadUrl };
}
```

## Best Practices

1. **Path Organization**: Use hierarchical paths (e.g., `object/recordId/filename`)
2. **Content Types**: Always specify correct `contentType`
3. **Security**: Use signed URLs for private files
4. **Cleanup**: Delete files when records are deleted
5. **Validation**: Validate file types and sizes before upload
6. **Metadata**: Store useful metadata with files
7. **Backups**: Implement backup strategy for S3 buckets

## Performance Considerations

- **Streaming**: Use streams for large files to reduce memory usage
- **CDN**: Put CloudFront or similar CDN in front of S3
- **Compression**: Compress files before upload when appropriate
- **Caching**: Cache file URLs and metadata
- **Multipart**: Use multipart upload for files > 5MB

## Contract Implementation

Implements `IStorageService` from `@objectstack/spec/contracts`:

```typescript
interface IStorageService {
  upload(options: UploadOptions): Promise<void>;
  uploadStream(options: UploadStreamOptions): Promise<void>;
  download(path: string): Promise<FileData>;
  downloadStream(path: string): Promise<ReadableStream>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getMetadata(path: string): Promise<FileMetadata>;
  list(path: string, options?: ListOptions): Promise<string[]>;
  getUrl(path: string): string;
  getSignedUrl(path: string, options?: SignedUrlOptions): Promise<string>;
}
```

## License

Apache-2.0

## See Also

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [@objectstack/spec/contracts](../../spec/src/contracts/)
- [File Upload Guide](/content/docs/guides/storage/)
