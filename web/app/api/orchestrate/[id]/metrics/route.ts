/**
 * Metrics API
 * Get execution metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '@backend/orchestration/monitoring/metrics';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const executionId = params.id;
    const { searchParams } = new URL(request.url);
    
    const startTime = searchParams.get('startTime') 
      ? new Date(searchParams.get('startTime')!)
      : new Date(Date.now() - 3600000); // Last hour
    
    const endTime = searchParams.get('endTime')
      ? new Date(searchParams.get('endTime')!)
      : new Date();

    const metrics = metricsCollector.getMetrics({ start: startTime, end: endTime });

    // Filter by execution (if we had execution-specific metrics)
    // For now, return all metrics

    return NextResponse.json({
      metrics,
      summary: {
        totalMetrics: metrics.length,
        timeRange: {
          start: startTime,
          end: endTime
        }
      }
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch metrics',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
