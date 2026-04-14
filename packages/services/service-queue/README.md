# @objectstack/service-queue

Queue Service for ObjectStack — implements `IQueueService` with in-memory and BullMQ adapters.

## Features

- **Multiple Adapters**: In-memory (development) and BullMQ/Redis (production)
- **Job Queues**: Organize work into named queues with priorities
- **Worker Pools**: Process jobs concurrently with configurable workers
- **Retry Logic**: Automatic retry with exponential backoff
- **Job Scheduling**: Delay job execution or schedule for future
- **Progress Tracking**: Track job progress and completion
- **Job Events**: Listen to job lifecycle events (active, completed, failed)
- **Rate Limiting**: Control job processing rate

## Installation

```bash
pnpm add @objectstack/service-queue
```

For BullMQ adapter (production):
```bash
pnpm add bullmq ioredis
```

## Basic Usage

```typescript
import { defineStack } from '@objectstack/spec';
import { ServiceQueue } from '@objectstack/service-queue';

const stack = defineStack({
  services: [
    ServiceQueue.configure({
      adapter: 'memory', // or 'bullmq'
      defaultQueue: 'default',
    }),
  ],
});
```

## Configuration

### In-Memory Adapter (Development)

```typescript
ServiceQueue.configure({
  adapter: 'memory',
  concurrency: 5, // Max concurrent jobs
});
```

### BullMQ Adapter (Production)

```typescript
ServiceQueue.configure({
  adapter: 'bullmq',
  redis: {
    host: 'localhost',
    port: 6379,
    password: process.env.REDIS_PASSWORD,
  },
  queues: {
    default: { concurrency: 10 },
    email: { concurrency: 5, rateLimit: { max: 100, duration: 60000 } },
    reports: { concurrency: 2 },
  },
});
```

## Service API

```typescript
// Get queue service
const queue = kernel.getService<IQueueService>('queue');
```

### Adding Jobs

```typescript
// Add a simple job
await queue.add('email', 'send_welcome', {
  to: 'user@example.com',
  template: 'welcome',
});

// Add job with options
await queue.add('reports', 'generate_monthly', {
  month: '2024-01',
  format: 'pdf',
}, {
  priority: 1, // Higher number = higher priority
  attempts: 3, // Retry up to 3 times
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
});

// Add delayed job (runs in 1 hour)
await queue.add('notifications', 'reminder', {
  userId: '123',
  message: 'Don't forget!',
}, {
  delay: 3600000, // 1 hour in milliseconds
});

// Schedule job for specific time
await queue.add('cleanup', 'old_files', {}, {
  timestamp: new Date('2024-12-31T23:59:59Z').getTime(),
});
```

### Processing Jobs

```typescript
// Register a job processor
queue.process('email', async (job) => {
  console.log('Processing email job:', job.data);

  // Access job data
  const { to, template } = job.data;

  // Update progress
  await job.updateProgress(25);

  // Send email
  await sendEmail(to, template);

  await job.updateProgress(100);

  // Return result
  return { sent: true, messageId: 'msg_123' };
});

// Process with concurrency
queue.process('reports', 5, async (job) => {
  // Up to 5 reports generated concurrently
  return await generateReport(job.data);
});

// Process with named handler
queue.process('default', 'calculate_metrics', async (job) => {
  return await calculateMetrics(job.data);
});
```

### Job Management

```typescript
// Get job by ID
const job = await queue.getJob('email', 'job_abc123');

// Get job status
const status = await job.getState();
// 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'

// Remove job
await queue.removeJob('email', 'job_abc123');

// Retry failed job
await queue.retryJob('email', 'job_abc123');

// Get job result
const result = await job.returnvalue;
```

### Queue Operations

```typescript
// Pause queue (stop processing new jobs)
await queue.pause('email');

// Resume queue
await queue.resume('email');

// Clear all jobs in queue
await queue.clear('email');

// Get queue statistics
const stats = await queue.getStats('email');
// {
//   waiting: 45,
//   active: 5,
//   completed: 1250,
//   failed: 12,
//   delayed: 3
// }
```

## Advanced Features

### Job Events

```typescript
// Listen to job lifecycle events
queue.on('email', 'completed', async (job, result) => {
  console.log(`Email sent: ${result.messageId}`);
});

queue.on('email', 'failed', async (job, error) => {
  console.error(`Email failed: ${error.message}`);
  // Send alert to admin
});

queue.on('email', 'progress', async (job, progress) => {
  console.log(`Email progress: ${progress}%`);
});

queue.on('email', 'active', async (job) => {
  console.log(`Email job started: ${job.id}`);
});
```

### Bulk Operations

```typescript
// Add multiple jobs at once
await queue.addBulk('email', [
  { name: 'send_welcome', data: { to: 'user1@example.com' } },
  { name: 'send_welcome', data: { to: 'user2@example.com' } },
  { name: 'send_welcome', data: { to: 'user3@example.com' } },
]);

// Get multiple jobs
const jobs = await queue.getJobs('email', ['waiting', 'active']);
```

### Job Patterns

#### Worker Pattern

```typescript
// Dedicated worker process
queue.process('heavy_processing', async (job) => {
  // CPU-intensive work
  const result = await processLargeDataset(job.data);
  return result;
});
```

#### Fan-Out Pattern

```typescript
// Split work across multiple jobs
await queue.add('orchestrator', 'process_batch', { batchId: '123' });

queue.process('orchestrator', async (job) => {
  const items = await loadBatchItems(job.data.batchId);

  // Create sub-jobs for each item
  for (const item of items) {
    await queue.add('worker', 'process_item', { item });
  }
});

queue.process('worker', async (job) => {
  return await processItem(job.data.item);
});
```

#### Priority Queues

```typescript
// High priority
await queue.add('tasks', 'urgent', data, { priority: 10 });

// Normal priority
await queue.add('tasks', 'normal', data, { priority: 5 });

// Low priority
await queue.add('tasks', 'background', data, { priority: 1 });
```

### Rate Limiting

```typescript
// Limit queue to 100 jobs per minute
ServiceQueue.configure({
  adapter: 'bullmq',
  queues: {
    api_calls: {
      concurrency: 5,
      rateLimit: {
        max: 100,
        duration: 60000, // 1 minute
      },
    },
  },
});
```

### Repeatable Jobs

```typescript
// Add cron-based repeatable job
await queue.addRepeatable('cleanup', 'old_sessions', {}, {
  cron: '0 2 * * *', // Daily at 2 AM
});

// Add interval-based repeatable job
await queue.addRepeatable('sync', 'data', {}, {
  every: 300000, // Every 5 minutes
});

// Remove repeatable job
await queue.removeRepeatable('cleanup', 'old_sessions');
```

## Common Use Cases

### Email Queue

```typescript
queue.process('email', async (job) => {
  const { to, subject, body, template } = job.data;

  try {
    const result = await emailProvider.send({
      to,
      subject,
      html: renderTemplate(template, job.data),
    });

    return { messageId: result.id, sentAt: new Date() };
  } catch (error) {
    // Throw error to trigger retry
    throw new Error(`Failed to send email: ${error.message}`);
  }
});

// Add email job
await queue.add('email', 'welcome', {
  to: 'newuser@example.com',
  template: 'welcome',
  name: 'John Doe',
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
});
```

### Report Generation

```typescript
queue.process('reports', async (job) => {
  const { reportType, userId, dateRange } = job.data;

  await job.updateProgress(10);

  // Fetch data
  const data = await fetchReportData(reportType, dateRange);

  await job.updateProgress(50);

  // Generate report
  const report = await generatePDF(data);

  await job.updateProgress(90);

  // Upload to storage
  const url = await uploadReport(report);

  await job.updateProgress(100);

  // Notify user
  await notifyUser(userId, { reportUrl: url });

  return { url, size: report.length };
});
```

### Webhook Processing

```typescript
queue.process('webhooks', async (job) => {
  const { url, payload, headers } = job.data;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status}`);
  }

  return { status: response.status, responseTime: Date.now() - job.timestamp };
});
```

## REST API Endpoints

```
POST   /api/v1/queues/:queue/jobs           # Add job
GET    /api/v1/queues/:queue/jobs/:id       # Get job
DELETE /api/v1/queues/:queue/jobs/:id       # Remove job
POST   /api/v1/queues/:queue/jobs/:id/retry # Retry failed job
GET    /api/v1/queues/:queue/stats          # Get queue stats
POST   /api/v1/queues/:queue/pause          # Pause queue
POST   /api/v1/queues/:queue/resume         # Resume queue
DELETE /api/v1/queues/:queue                # Clear queue
```

## Best Practices

1. **Idempotent Jobs**: Design jobs to be safely retried
2. **Error Handling**: Always handle errors and throw to trigger retry
3. **Progress Updates**: Update progress for long-running jobs
4. **Resource Limits**: Set appropriate concurrency limits
5. **Job Data**: Keep job data small (< 1MB)
6. **Monitoring**: Track queue metrics and job failure rates
7. **Cleanup**: Remove completed jobs periodically

## Performance Considerations

- **Concurrency**: Tune based on system resources and external API limits
- **Rate Limiting**: Prevent overwhelming external services
- **Job Size**: Keep job payloads small for faster serialization
- **Redis Connection**: Use connection pooling for BullMQ
- **Queue Organization**: Use separate queues for different job types

## Contract Implementation

Implements `IQueueService` from `@objectstack/spec/contracts`:

```typescript
interface IQueueService {
  add(queue: string, name: string, data: any, options?: JobOptions): Promise<Job>;
  addBulk(queue: string, jobs: JobDefinition[]): Promise<Job[]>;
  process(queue: string, handler: JobHandler): void;
  getJob(queue: string, jobId: string): Promise<Job | null>;
  removeJob(queue: string, jobId: string): Promise<void>;
  retryJob(queue: string, jobId: string): Promise<void>;
  getStats(queue: string): Promise<QueueStats>;
  pause(queue: string): Promise<void>;
  resume(queue: string): Promise<void>;
  clear(queue: string): Promise<void>;
  on(queue: string, event: JobEvent, handler: EventHandler): void;
}
```

## License

Apache-2.0

## See Also

- [BullMQ Documentation](https://docs.bullmq.io/)
- [@objectstack/spec/contracts](../../spec/src/contracts/)
- [Queue Patterns Guide](/content/docs/guides/queues/)
