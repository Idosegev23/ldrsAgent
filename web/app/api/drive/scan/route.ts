/**
 * Drive Scan API
 * POST /api/drive/scan - Start a new scan
 * GET /api/drive/scan - Get scan status/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { driveScanner } from '@backend/services/drive-scanner';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { folderId } = body;

    console.log('[DriveScanner] Starting scan...', { folderId });

    // Start scan in background (don't await)
    const scanPromise = driveScanner.fullScan(folderId);
    
    // Return immediately with scan started message
    // The scan will continue in the background
    scanPromise.then(result => {
      console.log('[DriveScanner] Scan completed:', result);
    }).catch(err => {
      console.error('[DriveScanner] Scan failed:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Scan started',
      note: 'The scan is running in the background. Use GET /api/drive/scan to check status.',
    });
  } catch (error) {
    console.error('[API] Failed to start scan:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    if (action === 'stats') {
      // Get file statistics
      const stats = await driveScanner.getStats();
      return NextResponse.json({ success: true, stats });
    }

    // Get latest scan status
    const latestScan = await driveScanner.getLatestScan();
    const stats = await driveScanner.getStats();

    return NextResponse.json({
      success: true,
      latestScan,
      stats,
    });
  } catch (error) {
    console.error('[API] Failed to get scan status:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
