# @objectstack/service-ai

AI Service for ObjectStack — implements `IAIService` with LLM adapter layer, conversation management, tool registry, and REST/SSE routes.

## Features

- **Multi-Provider LLM Support**: Supports OpenAI, Anthropic, Google, and custom gateway providers via Vercel AI SDK
- **Conversation Management**: Track and manage AI conversations with full history
- **Tool Registry**: Register and execute tools that AI agents can call
- **Streaming Support**: Real-time streaming responses via Server-Sent Events (SSE)
- **REST API**: Auto-generated endpoints for AI operations
- **Type-Safe**: Full TypeScript support with type inference

## Installation

```bash
pnpm add @objectstack/service-ai
```

### Peer Dependencies

Install the LLM provider(s) you need:

```bash
# OpenAI
pnpm add @ai-sdk/openai

# Anthropic (Claude)
pnpm add @ai-sdk/anthropic

# Google (Gemini)
pnpm add @ai-sdk/google

# Custom Gateway
pnpm add @ai-sdk/gateway
```

All peer dependencies are optional — install only what you need.

## Basic Usage

```typescript
import { defineStack } from '@objectstack/spec';
import { ServiceAI } from '@objectstack/service-ai';
import { openai } from '@ai-sdk/openai';

const stack = defineStack({
  services: [
    ServiceAI.configure({
      models: {
        default: openai('gpt-4'),
        fast: openai('gpt-3.5-turbo'),
      },
    }),
  ],
});
```

## Configuration

```typescript
interface AIServiceConfig {
  /** Map of model IDs to AI SDK model instances */
  models: Record<string, LanguageModel>;

  /** Default model to use when not specified */
  defaultModel?: string;

  /** Maximum conversation history length */
  maxHistoryLength?: number;

  /** Enable streaming responses (default: true) */
  enableStreaming?: boolean;
}
```

## Service API

The `IAIService` interface provides:

### Conversation Management

```typescript
// Get AI service from kernel
const ai = kernel.getService<IAIService>('ai');

// Create a new conversation
const conversation = await ai.createConversation({
  model: 'default',
  systemPrompt: 'You are a helpful assistant.',
});

// Send a message
const response = await ai.sendMessage({
  conversationId: conversation.id,
  message: 'What is ObjectStack?',
});

// Stream a message
const stream = await ai.streamMessage({
  conversationId: conversation.id,
  message: 'Explain in detail...',
});

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

### Tool Registry

```typescript
// Register a tool
ai.registerTool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
  execute: async ({ location }) => {
    // Your tool implementation
    return { temperature: 72, condition: 'sunny' };
  },
});

// Tools are automatically available to AI agents
const response = await ai.sendMessage({
  conversationId: conversation.id,
  message: 'What is the weather in San Francisco?',
});
```

## REST API Endpoints

When used with `@objectstack/rest`, the following endpoints are auto-generated:

```
POST   /api/v1/ai/conversations          # Create conversation
GET    /api/v1/ai/conversations/:id      # Get conversation
POST   /api/v1/ai/conversations/:id/messages  # Send message
GET    /api/v1/ai/conversations/:id/stream    # Stream response (SSE)
GET    /api/v1/ai/tools                  # List available tools
POST   /api/v1/ai/tools/:name/execute    # Execute a tool
```

## Multi-Model Configuration

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

const stack = defineStack({
  services: [
    ServiceAI.configure({
      models: {
        // Fast model for simple tasks
        fast: openai('gpt-3.5-turbo'),

        // Default model for general use
        default: openai('gpt-4'),

        // Advanced reasoning
        reasoning: openai('gpt-4-turbo'),

        // Anthropic Claude
        claude: anthropic('claude-3-opus-20240229'),

        // Google Gemini
        gemini: google('gemini-pro'),
      },
      defaultModel: 'default',
    }),
  ],
});
```

## Advanced Features

### Custom System Prompts

```typescript
const conversation = await ai.createConversation({
  model: 'default',
  systemPrompt: `You are an expert in ObjectStack.
    Answer questions about the framework accurately and concisely.
    Always provide code examples when relevant.`,
});
```

### Conversation History

```typescript
// Get full conversation history
const history = await ai.getConversationHistory(conversationId);

// Clear conversation history
await ai.clearConversation(conversationId);

// Delete conversation
await ai.deleteConversation(conversationId);
```

### Error Handling

```typescript
try {
  const response = await ai.sendMessage({
    conversationId: conversation.id,
    message: 'Hello',
  });
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Handle rate limiting
  } else if (error.code === 'MODEL_NOT_FOUND') {
    // Handle missing model
  }
}
```

## Integration with ObjectStack Agents

The AI service integrates with the `@objectstack/spec/ai` agent protocol:

```typescript
import { defineAgent } from '@objectstack/spec';

const myAgent = defineAgent({
  name: 'code_assistant',
  model: 'default',
  systemPrompt: 'You help write ObjectStack code.',
  tools: ['create_object', 'create_field', 'create_view'],
});

// Agent automatically uses the AI service
const result = await myAgent.execute({
  input: 'Create a contact object with name and email fields',
});
```

## Architecture

The service follows a layered architecture:

1. **Adapter Layer**: Abstracts different LLM providers (OpenAI, Anthropic, Google)
2. **Conversation Manager**: Handles conversation state and history
3. **Tool Registry**: Manages tool registration and execution
4. **REST Routes**: Auto-generated HTTP endpoints
5. **SSE Streaming**: Real-time streaming support

## Contract Implementation

Implements `IAIService` from `@objectstack/spec/contracts`:

```typescript
interface IAIService {
  createConversation(options: ConversationOptions): Promise<Conversation>;
  sendMessage(options: MessageOptions): Promise<Message>;
  streamMessage(options: MessageOptions): AsyncIterable<MessageChunk>;
  registerTool(tool: AITool): void;
  getConversationHistory(conversationId: string): Promise<Message[]>;
  deleteConversation(conversationId: string): Promise<void>;
}
```

## Performance Considerations

- **Streaming**: Use streaming for long responses to improve perceived performance
- **Model Selection**: Choose appropriate models based on task complexity
- **Conversation History**: Limit history length to control token usage
- **Caching**: Provider-level caching is handled automatically

## Best Practices

1. **Model Selection**: Use fast models for simple tasks, advanced models for complex reasoning
2. **System Prompts**: Provide clear, specific instructions in system prompts
3. **Tool Design**: Keep tools focused and well-documented
4. **Error Handling**: Always handle rate limits and API errors gracefully
5. **Streaming**: Use streaming for better UX on long-running queries

## License

Apache-2.0

## See Also

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [@objectstack/spec/ai Protocol](../../spec/src/ai/)
- [AI Agent Guide](/content/docs/guides/ai/)
