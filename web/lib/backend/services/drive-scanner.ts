/**
 * Drive Scanner Service
 * Placeholder for serverless
 */

export const driveScanner = {
  scanFolder: async (folderId: string) => {
    return {
      success: true,
      message: 'Drive scanning is not available in serverless mode',
      filesScanned: 0,
    };
  },
  getStatus: () => {
    return {
      isScanning: false,
      lastScan: null,
    };
  },
};
