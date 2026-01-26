/**
 * Plugin System Types
 */

export type PluginType = 
  | 'AGENT'
  | 'INTEGRATION'
  | 'MIDDLEWARE'
  | 'VALIDATOR';

export type HookName =
  | 'beforePlan'
  | 'afterPlan'
  | 'beforeStep'
  | 'afterStep'
  | 'beforeExecution'
  | 'afterExecution'
  | 'onError'
  | 'onApprovalRequired';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  description: string;
  author?: string;
  config: PluginConfig;
  hooks: PluginHook[];
  enabled: boolean;
  installedAt: Date;
}

export interface PluginConfig {
  settings: Record<string, any>;
  dependencies?: string[];
  permissions?: string[];
  resources?: PluginResource[];
}

export interface PluginResource {
  type: 'API_KEY' | 'DATABASE' | 'FILE_SYSTEM' | 'NETWORK';
  name: string;
  required: boolean;
}

export interface PluginHook {
  name: HookName;
  handler: string; // function name or path
  executionOrder: number;
  async: boolean;
}

export interface HookContext {
  executionId: string;
  userId: string;
  workspaceId?: string;
  data: any;
  metadata: Record<string, any>;
}

export interface HookResult {
  success: boolean;
  modified?: boolean;
  data?: any;
  error?: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  type: PluginType;
  description: string;
  author?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  main: string; // entry point
  config?: Record<string, PluginConfigField>;
  hooks: HookDefinition[];
  permissions: string[];
}

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
  validation?: string; // regex or validation rule
}

export interface HookDefinition {
  name: HookName;
  description: string;
  async: boolean;
  order?: number;
}

// Plugin Registry
export interface PluginRegistryEntry {
  pluginId: string;
  name: string;
  version: string;
  type: PluginType;
  downloadUrl?: string;
  verified: boolean;
  downloads: number;
  rating?: number;
  lastUpdated: Date;
}
