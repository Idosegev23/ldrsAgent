/**
 * Canva Connector
 * Interact with Canva Connect API
 */

import { getValidCanvaToken } from '../auth/canva-oauth.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'CanvaConnector' });

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';

export interface CanvaDesign {
  id: string;
  title: string;
  thumbnail?: {
    url: string;
    width: number;
    height: number;
  };
  urls: {
    edit_url: string;
    view_url: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CanvaAsset {
  id: string;
  name: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO';
  thumbnail?: {
    url: string;
  };
  tags: string[];
  uploaded_at: string;
}

export interface CanvaExportResult {
  url: string;
  expiresAt: Date;
}

/**
 * Make authenticated request to Canva API
 */
async function canvaRequest<T>(
  endpoint: string,
  userId: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getValidCanvaToken(userId);
  
  const url = `${CANVA_API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    log.error('Canva API error', new Error(error), { endpoint, status: response.status });
    throw new Error(`Canva API error: ${error}`);
  }

  return response.json();
}

/**
 * List user's designs
 */
export async function listDesigns(
  userId: string,
  options?: {
    search?: string;
    ownership?: 'any' | 'owned' | 'shared';
    sortBy?: 'relevance' | 'modified' | 'title';
    limit?: number;
    continuation?: string;
  }
): Promise<{ designs: CanvaDesign[]; continuation?: string }> {
  log.info('Listing Canva designs', { userId, options });

  const params = new URLSearchParams();
  if (options?.search) params.set('query', options.search);
  if (options?.ownership) params.set('ownership', options.ownership);
  if (options?.sortBy) params.set('sort_by', options.sortBy);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.continuation) params.set('continuation', options.continuation);

  const result = await canvaRequest<any>(
    `/designs?${params.toString()}`,
    userId
  );

  return {
    designs: result.items || [],
    continuation: result.continuation,
  };
}

/**
 * Get specific design
 */
export async function getDesign(
  designId: string,
  userId: string
): Promise<CanvaDesign> {
  log.info('Getting Canva design', { userId, designId });

  const result = await canvaRequest<any>(
    `/designs/${designId}`,
    userId
  );

  return result.design;
}

/**
 * Create design from template
 */
export async function createDesign(
  userId: string,
  options: {
    title?: string;
    assetId?: string; // Brand template ID
    width?: number;
    height?: number;
  }
): Promise<CanvaDesign> {
  log.info('Creating Canva design', { userId, options });

  const body: any = {};
  if (options.title) body.title = options.title;
  if (options.assetId) body.asset_id = options.assetId;
  if (options.width && options.height) {
    body.dimensions = {
      width: options.width,
      height: options.height,
      unit: 'px',
    };
  }

  const result = await canvaRequest<any>(
    '/designs',
    userId,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  return result.design;
}

/**
 * Export design to specific format
 */
export async function exportDesign(
  designId: string,
  userId: string,
  format: 'PNG' | 'JPG' | 'PDF' | 'GIF' | 'MP4' | 'PPTX'
): Promise<CanvaExportResult> {
  log.info('Exporting Canva design', { userId, designId, format });

  // Step 1: Create export job
  const exportJob = await canvaRequest<any>(
    `/designs/${designId}/export`,
    userId,
    {
      method: 'POST',
      body: JSON.stringify({
        format: {
          type: format,
        },
      }),
    }
  );

  const jobId = exportJob.job.id;

  // Step 2: Poll for completion (max 30 seconds)
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const status = await canvaRequest<any>(
      `/exports/${jobId}`,
      userId
    );

    if (status.job.status === 'success') {
      const url = status.job.result?.url;
      if (!url) {
        throw new Error('Export completed but no URL returned');
      }

      return {
        url,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };
    }

    if (status.job.status === 'failed') {
      throw new Error('Export failed');
    }
  }

  throw new Error('Export timeout');
}

/**
 * Upload asset (image/video)
 */
export async function uploadAsset(
  userId: string,
  options: {
    file?: Buffer;
    url?: string;
    name: string;
    tags?: string[];
  }
): Promise<CanvaAsset> {
  log.info('Uploading asset to Canva', { userId, name: options.name });

  // Step 1: Create upload job
  const uploadJob = await canvaRequest<any>(
    '/asset-uploads',
    userId,
    {
      method: 'POST',
      body: JSON.stringify({
        name_conflicts_policy: 'rename',
      }),
    }
  );

  const jobId = uploadJob.job.id;
  const uploadUrl = uploadJob.job.asset?.upload_url;

  if (!uploadUrl) {
    throw new Error('No upload URL received');
  }

  // Step 2: Upload file
  if (options.file) {
    await fetch(uploadUrl, {
      method: 'POST',
      body: options.file,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
  } else if (options.url) {
    // URL-based upload (if supported)
    throw new Error('URL-based upload not yet implemented');
  }

  // Step 3: Poll for completion
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const status = await canvaRequest<any>(
      `/asset-uploads/${jobId}`,
      userId
    );

    if (status.job.status === 'success') {
      const assetId = status.job.asset?.id;
      if (!assetId) {
        throw new Error('Upload completed but no asset ID returned');
      }

      // Update asset with name and tags
      if (options.tags && options.tags.length > 0) {
        await updateAsset(assetId, userId, {
          tags: options.tags,
        });
      }

      return await getAsset(assetId, userId);
    }

    if (status.job.status === 'failed') {
      throw new Error('Upload failed');
    }
  }

  throw new Error('Upload timeout');
}

/**
 * Get asset by ID
 */
export async function getAsset(
  assetId: string,
  userId: string
): Promise<CanvaAsset> {
  log.info('Getting Canva asset', { userId, assetId });

  const result = await canvaRequest<any>(
    `/assets/${assetId}`,
    userId
  );

  return result.asset;
}

/**
 * Update asset metadata
 */
export async function updateAsset(
  assetId: string,
  userId: string,
  updates: {
    name?: string;
    tags?: string[];
  }
): Promise<void> {
  log.info('Updating Canva asset', { userId, assetId, updates });

  await canvaRequest<any>(
    `/assets/${assetId}`,
    userId,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
}

/**
 * Delete asset
 */
export async function deleteAsset(
  assetId: string,
  userId: string
): Promise<void> {
  log.info('Deleting Canva asset', { userId, assetId });

  await canvaRequest<any>(
    `/assets/${assetId}`,
    userId,
    {
      method: 'DELETE',
    }
  );
}

/**
 * List brand templates
 */
export async function listBrandTemplates(
  userId: string,
  options?: {
    search?: string;
    limit?: number;
    continuation?: string;
  }
): Promise<{ templates: any[]; continuation?: string }> {
  log.info('Listing brand templates', { userId, options });

  const params = new URLSearchParams();
  if (options?.search) params.set('query', options.search);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.continuation) params.set('continuation', options.continuation);

  const result = await canvaRequest<any>(
    `/brand-templates?${params.toString()}`,
    userId
  );

  return {
    templates: result.items || [],
    continuation: result.continuation,
  };
}

/**
 * Get brand template
 */
export async function getBrandTemplate(
  templateId: string,
  userId: string
): Promise<any> {
  log.info('Getting brand template', { userId, templateId });

  const result = await canvaRequest<any>(
    `/brand-templates/${templateId}`,
    userId
  );

  return result.brand_template;
}

/**
 * List folders
 */
export async function listFolders(
  userId: string,
  options?: {
    limit?: number;
    continuation?: string;
  }
): Promise<{ folders: any[]; continuation?: string }> {
  log.info('Listing folders', { userId, options });

  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.continuation) params.set('continuation', options.continuation);

  const result = await canvaRequest<any>(
    `/folders?${params.toString()}`,
    userId
  );

  return {
    folders: result.items || [],
    continuation: result.continuation,
  };
}

/**
 * Search designs with filters
 */
export async function searchDesigns(
  userId: string,
  query: string,
  filters?: {
    ownership?: 'any' | 'owned' | 'shared';
    limit?: number;
  }
): Promise<CanvaDesign[]> {
  log.info('Searching Canva designs', { userId, query, filters });

  const result = await listDesigns(userId, {
    search: query,
    ...filters,
  });

  return result.designs;
}
