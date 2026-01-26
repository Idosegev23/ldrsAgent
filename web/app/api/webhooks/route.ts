/**
 * Webhooks API
 * Manage webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { webhookManager } from '@backend/orchestration/webhooks/webhook-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const webhooks = await webhookManager.getUserWebhooks(userId);

    return NextResponse.json({
      webhooks
    });
  } catch (error) {
    console.error('Webhooks API error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch webhooks',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, trigger, action, workspaceId } = body;

    if (!userId || !name || !trigger || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const webhookId = await webhookManager.register(
      userId,
      name,
      trigger,
      action,
      workspaceId
    );

    return NextResponse.json({
      success: true,
      webhookId
    });
  } catch (error) {
    console.error('Webhooks API error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to create webhook',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
