/**
 * User Types
 * Users, roles, and permissions
 */

export type UserRole = 'admin' | 'manager' | 'user';

export interface User {
  id: string;
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  teamId?: string;
  clientIds: string[];
  preferences: UserPreferences;
  createdAt: Date;
}

export interface UserPreferences {
  morningBriefing: boolean;
  whatsappNotifications: boolean;
  emailNotifications: boolean;
  language: 'he' | 'en';
}

export interface PermissionContext {
  userId: string;
  role: UserRole;
  allowedClientIds: string[];
  teamMemberIds?: string[];
}

export interface IntegrationContext {
  allowed: string[];
  blocked: string[];
}

