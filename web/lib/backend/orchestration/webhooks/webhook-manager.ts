export const webhookManager = {
  registerWebhook: async (url: string) => {
    return { id: `webhook-${Date.now()}`, url };
  },
  
  getWebhook: async (webhookId: string) => {
    return null;
  },
  
  deleteWebhook: async (webhookId: string) => {
    return { success: true };
  },
  
  listWebhooks: async () => {
    return [];
  },
};
