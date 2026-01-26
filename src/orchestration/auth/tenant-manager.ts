/**
 * Tenant Manager
 * Multi-tenancy support with workspaces
 */

import { logger } from '../../utils/logger.js';
import { supabase } from '../../db/client.js';
import { v4 as uuidv4 } from 'uuid';

export interface Workspace {
  id: string;
  name: string;
  createdAt: Date;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: Date;
}

export interface WorkspacePermission {
  workspaceId: string;
  resourceType: string;
  resourceId: string;
  permissions: string[];
}

export class TenantManager {
  private workspaces: Map<string, Workspace>;
  private members: Map<string, WorkspaceMember[]>; // workspaceId -> members
  private permissions: Map<string, WorkspacePermission[]>; // workspaceId -> permissions

  constructor() {
    this.workspaces = new Map();
    this.members = new Map();
    this.permissions = new Map();
  }

  /**
   * Create workspace
   */
  async createWorkspace(name: string, ownerId: string): Promise<Workspace> {
    const workspace: Workspace = {
      id: uuidv4(),
      name,
      createdAt: new Date()
    };

    // Save to database
    try {
      const { error } = await supabase
        .from('workspaces')
        .insert({
          id: workspace.id,
          name: workspace.name,
          created_at: workspace.createdAt.toISOString()
        });

      if (error) {
        throw error;
      }

      // Add owner as admin
      await this.addMember(workspace.id, ownerId, 'ADMIN');
    } catch (error) {
      logger.error('Failed to create workspace', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    this.workspaces.set(workspace.id, workspace);

    logger.info('Workspace created', {
      workspaceId: workspace.id,
      name: workspace.name
    });

    return workspace;
  }

  /**
   * Get workspace
   */
  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    // Check cache
    if (this.workspaces.has(workspaceId)) {
      return this.workspaces.get(workspaceId)!;
    }

    // Load from database
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error || !data) {
        return null;
      }

      const workspace: Workspace = {
        id: data.id,
        name: data.name,
        createdAt: new Date(data.created_at)
      };

      this.workspaces.set(workspaceId, workspace);

      return workspace;
    } catch (error) {
      logger.error('Failed to get workspace', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get user's workspace
   */
  async getUserWorkspace(userId: string): Promise<Workspace | null> {
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return this.getWorkspace(data.workspace_id);
    } catch (error) {
      logger.error('Failed to get user workspace', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Add member to workspace
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceMember['role']
  ): Promise<void> {
    const member: WorkspaceMember = {
      workspaceId,
      userId,
      role,
      createdAt: new Date()
    };

    try {
      const { error } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: member.workspaceId,
          user_id: member.userId,
          role: member.role,
          created_at: member.createdAt.toISOString()
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to add member', {
        workspaceId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    // Update cache
    if (!this.members.has(workspaceId)) {
      this.members.set(workspaceId, []);
    }
    this.members.get(workspaceId)!.push(member);

    logger.info('Member added to workspace', {
      workspaceId,
      userId,
      role
    });
  }

  /**
   * Remove member from workspace
   */
  async removeMember(workspaceId: string, userId: string): Promise<void> {
    try {
      await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);
    } catch (error) {
      logger.error('Failed to remove member', {
        workspaceId,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    // Update cache
    const members = this.members.get(workspaceId);
    if (members) {
      const index = members.findIndex(m => m.userId === userId);
      if (index >= 0) {
        members.splice(index, 1);
      }
    }

    logger.info('Member removed from workspace', {
      workspaceId,
      userId
    });
  }

  /**
   * Get workspace members
   */
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    // Check cache
    if (this.members.has(workspaceId)) {
      return this.members.get(workspaceId)!;
    }

    // Load from database
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (error) {
        throw error;
      }

      const members: WorkspaceMember[] = (data || []).map(row => ({
        workspaceId: row.workspace_id,
        userId: row.user_id,
        role: row.role,
        createdAt: new Date(row.created_at)
      }));

      this.members.set(workspaceId, members);

      return members;
    } catch (error) {
      logger.error('Failed to get members', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Check permission
   */
  async checkPermission(
    userId: string,
    action: string,
    resourceType?: string,
    resourceId?: string
  ): Promise<boolean> {
    // Get user's workspace
    const workspace = await this.getUserWorkspace(userId);

    if (!workspace) {
      return false;
    }

    // Get user's role
    const members = await this.getMembers(workspace.id);
    const member = members.find(m => m.userId === userId);

    if (!member) {
      return false;
    }

    // Admins can do everything
    if (member.role === 'ADMIN') {
      return true;
    }

    // Viewers can only read
    if (member.role === 'VIEWER' && action !== 'READ') {
      return false;
    }

    // Check specific permissions if resource specified
    if (resourceType && resourceId) {
      const permissions = await this.getPermissions(workspace.id);
      const resourcePerm = permissions.find(
        p => p.resourceType === resourceType && p.resourceId === resourceId
      );

      if (resourcePerm) {
        return resourcePerm.permissions.includes(action);
      }
    }

    // Members can read and write by default
    return member.role === 'MEMBER' && ['READ', 'WRITE'].includes(action);
  }

  /**
   * Set permissions
   */
  async setPermissions(
    workspaceId: string,
    resourceType: string,
    resourceId: string,
    permissions: string[]
  ): Promise<void> {
    try {
      await supabase
        .from('workspace_permissions')
        .upsert({
          workspace_id: workspaceId,
          resource_type: resourceType,
          resource_id: resourceId,
          permissions
        });
    } catch (error) {
      logger.error('Failed to set permissions', {
        workspaceId,
        resourceType,
        resourceId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    // Update cache
    if (!this.permissions.has(workspaceId)) {
      this.permissions.set(workspaceId, []);
    }

    const perms = this.permissions.get(workspaceId)!;
    const index = perms.findIndex(
      p => p.resourceType === resourceType && p.resourceId === resourceId
    );

    const perm: WorkspacePermission = {
      workspaceId,
      resourceType,
      resourceId,
      permissions
    };

    if (index >= 0) {
      perms[index] = perm;
    } else {
      perms.push(perm);
    }

    logger.info('Permissions set', {
      workspaceId,
      resourceType,
      resourceId,
      permissions
    });
  }

  /**
   * Get permissions
   */
  async getPermissions(workspaceId: string): Promise<WorkspacePermission[]> {
    // Check cache
    if (this.permissions.has(workspaceId)) {
      return this.permissions.get(workspaceId)!;
    }

    // Load from database
    try {
      const { data, error } = await supabase
        .from('workspace_permissions')
        .select('*')
        .eq('workspace_id', workspaceId);

      if (error) {
        throw error;
      }

      const permissions: WorkspacePermission[] = (data || []).map(row => ({
        workspaceId: row.workspace_id,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        permissions: row.permissions
      }));

      this.permissions.set(workspaceId, permissions);

      return permissions;
    } catch (error) {
      logger.error('Failed to get permissions', {
        workspaceId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Share agent between teams
   */
  async shareAgent(
    agentId: string,
    fromWorkspaceId: string,
    toWorkspaceId: string
  ): Promise<void> {
    // Set read permissions for target workspace
    await this.setPermissions(toWorkspaceId, 'AGENT', agentId, ['READ', 'EXECUTE']);

    logger.info('Agent shared', {
      agentId,
      fromWorkspaceId,
      toWorkspaceId
    });
  }

  /**
   * Get user workspaces
   */
  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      const workspaces: Workspace[] = [];

      for (const row of data || []) {
        const workspace = await this.getWorkspace(row.workspace_id);
        if (workspace) {
          workspaces.push(workspace);
        }
      }

      return workspaces;
    } catch (error) {
      logger.error('Failed to get user workspaces', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
}

export const tenantManager = new TenantManager();
