/**
 * SSE Stream API
 * Real-time execution updates
 */

import { NextRequest } from 'next/server';
import { streamManager } from '@/lib/backend/orchestration/streaming/stream-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const executionId = params.id;

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Get or create stream
      const emitter = streamManager.createStream(executionId);

      // Send initial message
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Listen to events
      emitter.on('event', (event) => {
        sendEvent(event.type, event.data);
      });

      // Keep-alive
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        emitter.removeAllListeners();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
