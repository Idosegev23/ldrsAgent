/**
 * Webhook Management API
 * Update and delete webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookManager } from '@/lib/backend/orchestration/webhooks/webhook-manager';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const webhookId = params.id;
    const body = await request.json();
    const { enabled } = body;

    if (enabled !== undefined) {
      if (enabled) {
        await webhookManager.enable(webhookId);
      } else {
        await webhookManager.disable(webhookId);
      }
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Webhook update error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to update webhook',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const webhookId = params.id;
    
    await webhookManager.delete(webhookId);

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted'
    });
  } catch (error) {
    console.error('Webhook delete error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to delete webhook',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
