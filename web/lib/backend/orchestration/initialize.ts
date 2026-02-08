export async function getSystemStatus() {
  return {
    status: 'healthy',
    uptime: process.uptime(),
    version: '1.0.0',
  };
}
