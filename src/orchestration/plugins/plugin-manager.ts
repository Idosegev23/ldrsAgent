/**
 * Plugin Manager
 * Dynamic plugin loading and hook execution
 */

import type {
  Plugin,
  PluginConfig,
  PluginHook,
  HookContext,
  HookResult,
  HookName
} from '../../types/plugin.types.js';
import { logger } from '../../utils/logger.js';
import { supabase } from '../../db/client.js';

export class PluginManager {
  private plugins: Map<string, Plugin>;
  private hooks: Map<HookName, Array<{ plugin: Plugin; handler: Function }>>;

  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
  }

  /**
   * Install plugin
   */
  async install(plugin: Plugin): Promise<void> {
    logger.info('Installing plugin', {
      pluginId: plugin.id,
      name: plugin.name,
      type: plugin.type
    });

    // Validate plugin
    this.validatePlugin(plugin);

    // Save to database
    try {
      const { error } = await supabase
        .from('plugins')
        .insert({
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          plugin_type: plugin.type,
          config: JSON.stringify(plugin.config),
          enabled: plugin.enabled,
          installed_at: plugin.installedAt.toISOString()
        });

      if (error) {
        throw error;
      }

      // Save hooks
      for (const hook of plugin.hooks) {
        await supabase
          .from('plugin_hooks')
          .insert({
            plugin_id: plugin.id,
            hook_name: hook.name,
            execution_order: hook.executionOrder
          });
      }
    } catch (error) {
      logger.error('Failed to save plugin', {
        pluginId: plugin.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    // Register plugin
    this.plugins.set(plugin.id, plugin);

    // Register hooks
    for (const hook of plugin.hooks) {
      this.registerHook(plugin, hook);
    }

    logger.info('Plugin installed', {
      pluginId: plugin.id,
      hooks: plugin.hooks.length
    });
  }

  /**
   * Validate plugin
   */
  private validatePlugin(plugin: Plugin): void {
    if (!plugin.id || !plugin.name || !plugin.version) {
      throw new Error('Invalid plugin: missing required fields');
    }

    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} already installed`);
    }

    // Validate hooks
    for (const hook of plugin.hooks) {
      if (!hook.name) {
        throw new Error('Invalid hook: missing name');
      }
    }
  }

  /**
   * Register hook
   */
  private registerHook(plugin: Plugin, hook: PluginHook): void {
    if (!this.hooks.has(hook.name)) {
      this.hooks.set(hook.name, []);
    }

    // Create handler function (mock for now)
    const handler = this.createHandler(plugin, hook);

    this.hooks.get(hook.name)!.push({ plugin, handler });

    // Sort by execution order
    this.hooks.get(hook.name)!.sort((a, b) => {
      const orderA = a.plugin.hooks.find(h => h.name === hook.name)?.executionOrder || 0;
      const orderB = b.plugin.hooks.find(h => h.name === hook.name)?.executionOrder || 0;
      return orderA - orderB;
    });

    logger.debug('Hook registered', {
      pluginId: plugin.id,
      hookName: hook.name,
      order: hook.executionOrder
    });
  }

  /**
   * Create handler function
   */
  private createHandler(plugin: Plugin, hook: PluginHook): Function {
    // This would load the actual plugin code
    // For now, return a mock handler
    return async (context: HookContext): Promise<HookResult> => {
      logger.debug('Executing plugin hook', {
        pluginId: plugin.id,
        hookName: hook.name
      });

      return {
        success: true,
        modified: false
      };
    };
  }

  /**
   * Execute hook
   */
  async executeHook(
    hookName: HookName,
    context: HookContext
  ): Promise<HookContext> {
    const hookHandlers = this.hooks.get(hookName);

    if (!hookHandlers || hookHandlers.length === 0) {
      return context;
    }

    logger.debug('Executing hooks', {
      hookName,
      count: hookHandlers.length
    });

    let currentContext = { ...context };

    for (const { plugin, handler } of hookHandlers) {
      if (!plugin.enabled) {
        continue;
      }

      try {
        const result = await handler(currentContext);

        if (result.success && result.modified && result.data) {
          currentContext.data = result.data;
        }

        if (!result.success && result.error) {
          logger.error('Hook execution failed', {
            pluginId: plugin.id,
            hookName,
            error: result.error
          });
        }
      } catch (error) {
        logger.error('Hook execution error', {
          pluginId: plugin.id,
          hookName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return currentContext;
  }

  /**
   * Uninstall plugin
   */
  async uninstall(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error('Plugin not found');
    }

    logger.info('Uninstalling plugin', {
      pluginId,
      name: plugin.name
    });

    // Remove hooks
    for (const hook of plugin.hooks) {
      const hookHandlers = this.hooks.get(hook.name);
      if (hookHandlers) {
        const index = hookHandlers.findIndex(h => h.plugin.id === pluginId);
        if (index >= 0) {
          hookHandlers.splice(index, 1);
        }
      }
    }

    // Remove plugin
    this.plugins.delete(pluginId);

    // Delete from database
    try {
      await supabase
        .from('plugins')
        .delete()
        .eq('id', pluginId);
    } catch (error) {
      logger.error('Failed to delete plugin', {
        pluginId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info('Plugin uninstalled', { pluginId });
  }

  /**
   * Enable plugin
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error('Plugin not found');
    }

    plugin.enabled = true;

    try {
      await supabase
        .from('plugins')
        .update({ enabled: true })
        .eq('id', pluginId);
    } catch (error) {
      logger.error('Failed to enable plugin', {
        pluginId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info('Plugin enabled', { pluginId });
  }

  /**
   * Disable plugin
   */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);

    if (!plugin) {
      throw new Error('Plugin not found');
    }

    plugin.enabled = false;

    try {
      await supabase
        .from('plugins')
        .update({ enabled: false })
        .eq('id', pluginId);
    } catch (error) {
      logger.error('Failed to disable plugin', {
        pluginId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info('Plugin disabled', { pluginId });
  }

  /**
   * Get plugin
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by type
   */
  getPluginsByType(type: Plugin['type']): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.type === type);
  }

  /**
   * Discover plugins
   */
  async discover(): Promise<Plugin[]> {
    // TODO: Implement plugin discovery from plugin directory
    logger.info('Discovering plugins');
    return [];
  }

  /**
   * Load plugins from database
   */
  async loadPlugins(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('plugins')
        .select('*');

      if (error) {
        throw error;
      }

      for (const row of data || []) {
        const plugin: Plugin = {
          id: row.id,
          name: row.name,
          version: row.version,
          type: row.plugin_type,
          description: '',
          config: JSON.parse(row.config),
          hooks: [],
          enabled: row.enabled,
          installedAt: new Date(row.installed_at)
        };

        // Load hooks
        const { data: hooksData } = await supabase
          .from('plugin_hooks')
          .select('*')
          .eq('plugin_id', plugin.id);

        if (hooksData) {
          plugin.hooks = hooksData.map(h => ({
            name: h.hook_name as HookName,
            handler: '',
            executionOrder: h.execution_order,
            async: true
          }));
        }

        this.plugins.set(plugin.id, plugin);

        // Register hooks
        for (const hook of plugin.hooks) {
          this.registerHook(plugin, hook);
        }
      }

      logger.info('Plugins loaded', { count: this.plugins.size });
    } catch (error) {
      logger.error('Failed to load plugins', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalPlugins: number;
    enabledPlugins: number;
    byType: Record<string, number>;
    totalHooks: number;
  } {
    const byType: Record<string, number> = {};
    let enabledCount = 0;
    let totalHooks = 0;

    for (const plugin of this.plugins.values()) {
      byType[plugin.type] = (byType[plugin.type] || 0) + 1;
      if (plugin.enabled) enabledCount++;
      totalHooks += plugin.hooks.length;
    }

    return {
      totalPlugins: this.plugins.size,
      enabledPlugins: enabledCount,
      byType,
      totalHooks
    };
  }
}

export const pluginManager = new PluginManager();

// Load plugins on startup
pluginManager.loadPlugins();
