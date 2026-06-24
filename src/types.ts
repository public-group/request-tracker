export type Division = 'Home' | 'Entertainment' | 'Technology';

export type RequestStatus = 'Not Started' | 'In Progress' | 'Live' | 'Delayed' | 'Blocked';
export type QAStatus = 'Waiting' | 'Pending' | 'Approved' | 'Rejected';

export interface RequestComment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  userId: string;
}

export interface Request {
  id: string;
  requestId?: string;
  division: Division;
  category: string;
  requestType: string;
  priorityTier: number;
  submitter: string;
  valuesCount: number;
  brief: string; // URL
  description: string;
  status: RequestStatus;
  qaStatus: QAStatus;
  comments: string;
  commentsList?: RequestComment[];
  owner: string;
  createdAt: string; // ISO string
  slaDeadline: string; // ISO string
  updateDate: string; // ISO string
  isArchived: boolean;
  // Fixed per-request subtasks (same two for every request)
  subtaskRequestActions?: boolean;
  subtaskLockedValuelist?: boolean;
  // ISO timestamp set when "Request Actions" is ticked; '' when not completed. Freezes the SLA clock.
  requestActionsCompletedAt?: string;
}

export type RequestSubtaskKey = 'subtaskRequestActions' | 'subtaskLockedValuelist';

export const REQUEST_SUBTASKS: { key: RequestSubtaskKey; label: string }[] = [
  { key: 'subtaskRequestActions', label: 'Request Actions' },
  { key: 'subtaskLockedValuelist', label: 'Locked Valuelist' },
];

export interface Config {
  OWNERS: Record<Division, string>;
  REQUEST_TYPES: string[];
  PRIORITY_MAP: Record<string, number>;
  HOLIDAYS: string[];
  CAPACITY_MAP: Record<string, Record<number, number>>;
  OWNERS_LIST?: string[];
  SUBMITTERS_LIST?: string[];
  ROLES_LIST?: string[];
  ROLE_PERMISSIONS?: Record<string, string[]>;
}
