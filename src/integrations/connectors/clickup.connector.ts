/**
 * ClickUp Connector
 * Manage tasks, lists, and spaces in ClickUp
 */

import { getConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ component: 'ClickUpConnector' });

const BASE_URL = 'https://api.clickup.com/api/v2';

function getHeaders(): Record<string, string> {
  const config = getConfig();
  if (!config.CLICKUP_API_TOKEN) {
    throw new Error('ClickUp API token not configured');
  }
  return {
    Authorization: config.CLICKUP_API_TOKEN,
    'Content-Type': 'application/json',
  };
}

export interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: {
    status: string;
    color: string;
  };
  priority?: {
    priority: string;
    color: string;
  };
  assignees: {
    id: number;
    username: string;
    email: string;
  }[];
  dueDate?: Date;
  startDate?: Date;
  timeEstimate?: number;
  tags: { name: string; tagFg: string; tagBg: string }[];
  url: string;
  listId: string;
  folderId?: string;
  spaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClickUpList {
  id: string;
  name: string;
  folderId?: string;
  spaceId: string;
  taskCount: number;
}

export interface CreateTaskOptions {
  listId: string;
  name: string;
  description?: string;
  assignees?: number[];
  tags?: string[];
  status?: string;
  priority?: number; // 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
  dueDate?: Date;
  startDate?: Date;
  timeEstimate?: number; // in milliseconds
}

/**
 * Get all workspaces/teams
 */
export async function getTeams(): Promise<{ id: string; name: string }[]> {
  log.info('Getting teams');

  const response = await fetch(`${BASE_URL}/team`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status}`);
  }

  const data = (await response.json()) as { teams: { id: string; name: string }[] };
  return data.teams;
}

/**
 * Get spaces in a team
 */
export async function getSpaces(
  teamId: string
): Promise<{ id: string; name: string; private: boolean }[]> {
  log.info('Getting spaces', { teamId });

  const response = await fetch(`${BASE_URL}/team/${teamId}/space`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status}`);
  }

  const data = (await response.json()) as { spaces: { id: string; name: string; private: boolean }[] };
  return data.spaces;
}

/**
 * Get lists in a space
 */
export async function getLists(spaceId: string): Promise<ClickUpList[]> {
  log.info('Getting lists', { spaceId });

  // Get folderless lists
  const folderlessResponse = await fetch(
    `${BASE_URL}/space/${spaceId}/list`,
    { headers: getHeaders() }
  );

  if (!folderlessResponse.ok) {
    throw new Error(`ClickUp API error: ${folderlessResponse.status}`);
  }

  const folderlessData = (await folderlessResponse.json()) as { lists: any[] };
  const lists: ClickUpList[] = folderlessData.lists.map((list: any) => ({
    id: list.id,
    name: list.name,
    spaceId: list.space.id,
    taskCount: list.task_count || 0,
  }));

  // Get folders and their lists
  const foldersResponse = await fetch(
    `${BASE_URL}/space/${spaceId}/folder`,
    { headers: getHeaders() }
  );

  if (foldersResponse.ok) {
    const foldersData = (await foldersResponse.json()) as { folders: any[] };
    for (const folder of foldersData.folders || []) {
      for (const list of folder.lists || []) {
        lists.push({
          id: list.id,
          name: list.name,
          folderId: folder.id,
          spaceId: list.space.id,
          taskCount: list.task_count || 0,
        });
      }
    }
  }

  return lists;
}

/**
 * Get tasks in a list
 */
export async function getTasks(
  listId: string,
  includeSubtasks: boolean = false,
  includeClosed: boolean = false
): Promise<ClickUpTask[]> {
  log.info('Getting tasks', { listId, includeSubtasks, includeClosed });

  const params = new URLSearchParams({
    subtasks: includeSubtasks.toString(),
    include_closed: includeClosed.toString(),
  });

  const response = await fetch(
    `${BASE_URL}/list/${listId}/task?${params}`,
    { headers: getHeaders() }
  );

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status}`);
  }

  const responseData = await response.json() as { tasks: any[] };
  return (responseData.tasks || []).map((t: any) => mapTask(t));
}

/**
 * Get a specific task
 */
export async function getTask(taskId: string): Promise<ClickUpTask | null> {
  log.info('Getting task', { taskId });

  const response = await fetch(
    `${BASE_URL}/task/${taskId}`,
    { headers: getHeaders() }
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status}`);
  }

  const data = await response.json();
  return mapTask(data);
}

/**
 * Create a new task
 */
export async function createTask(options: CreateTaskOptions): Promise<ClickUpTask> {
  log.info('Creating task', { listId: options.listId, name: options.name });

  const body: Record<string, any> = {
    name: options.name,
    description: options.description,
    assignees: options.assignees,
    tags: options.tags,
    status: options.status,
    priority: options.priority,
    due_date: options.dueDate?.getTime(),
    start_date: options.startDate?.getTime(),
    time_estimate: options.timeEstimate,
  };

  // Remove undefined values
  Object.keys(body).forEach((key) => {
    if (body[key] === undefined) delete body[key];
  });

  const response = await fetch(
    `${BASE_URL}/list/${options.listId}/task`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ClickUp API error: ${response.status} - ${error}`);
  }

  const taskData = await response.json() as any;
  log.info('Task created', { taskId: taskData.id });
  return mapTask(taskData);
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  updates: Partial<Omit<CreateTaskOptions, 'listId'>>
): Promise<ClickUpTask> {
  log.info('Updating task', { taskId });

  const body: Record<string, any> = {
    name: updates.name,
    description: updates.description,
    assignees: updates.assignees ? { add: updates.assignees } : undefined,
    status: updates.status,
    priority: updates.priority,
    due_date: updates.dueDate?.getTime(),
    start_date: updates.startDate?.getTime(),
    time_estimate: updates.timeEstimate,
  };

  // Remove undefined values
  Object.keys(body).forEach((key) => {
    if (body[key] === undefined) delete body[key];
  });

  const response = await fetch(
    `${BASE_URL}/task/${taskId}`,
    {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status}`);
  }

  const data = await response.json();
  return mapTask(data);
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  log.info('Deleting task', { taskId });

  const response = await fetch(
    `${BASE_URL}/task/${taskId}`,
    {
      method: 'DELETE',
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status}`);
  }
}

/**
 * Search tasks
 */
export async function searchTasks(
  teamId: string,
  query: string
): Promise<ClickUpTask[]> {
  log.info('Searching tasks', { teamId, query });

  // ClickUp search is done via filtered task view
  const params = new URLSearchParams({
    'search': query,
  });

  const response = await fetch(
    `${BASE_URL}/team/${teamId}/task?${params}`,
    { headers: getHeaders() }
  );

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status}`);
  }

  const searchData = await response.json() as { tasks: any[] };
  return (searchData.tasks || []).map((t: any) => mapTask(t));
}

/**
 * Add comment to a task
 */
export async function addComment(
  taskId: string,
  comment: string
): Promise<{ id: string }> {
  log.info('Adding comment', { taskId });

  const response = await fetch(
    `${BASE_URL}/task/${taskId}/comment`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ comment_text: comment }),
    }
  );

  if (!response.ok) {
    throw new Error(`ClickUp API error: ${response.status}`);
  }

  return response.json() as Promise<{ id: string }>;
}

function mapTask(task: any): ClickUpTask {
  return {
    id: task.id,
    name: task.name,
    description: task.description || undefined,
    status: {
      status: task.status?.status || 'unknown',
      color: task.status?.color || '#808080',
    },
    priority: task.priority
      ? {
          priority: task.priority.priority || 'normal',
          color: task.priority.color || '#808080',
        }
      : undefined,
    assignees: (task.assignees || []).map((a: any) => ({
      id: a.id,
      username: a.username,
      email: a.email,
    })),
    dueDate: task.due_date ? new Date(parseInt(task.due_date)) : undefined,
    startDate: task.start_date ? new Date(parseInt(task.start_date)) : undefined,
    timeEstimate: task.time_estimate || undefined,
    tags: (task.tags || []).map((t: any) => ({
      name: t.name,
      tagFg: t.tag_fg,
      tagBg: t.tag_bg,
    })),
    url: task.url,
    listId: task.list?.id || '',
    folderId: task.folder?.id || undefined,
    spaceId: task.space?.id || '',
    createdAt: new Date(parseInt(task.date_created)),
    updatedAt: new Date(parseInt(task.date_updated)),
  };
}
