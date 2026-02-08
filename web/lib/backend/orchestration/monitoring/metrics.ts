export const metricsCollector = {
  getMetrics: async (executionId: string) => {
    return {
      duration: 0,
      steps: 0,
      errors: 0,
    };
  },
};
