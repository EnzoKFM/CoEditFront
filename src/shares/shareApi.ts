import { apiFetch } from '../lib/api';

export type SharePermission = 'read' | 'write' | 'delete';

export const sharePermissionLabels: Record<SharePermission, string> = {
  read: 'Lecture',
  write: 'Écriture',
  delete: 'Écriture et suppression',
};

export type FolderShare = {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  permission: SharePermission;
  createdAt: string;
  updatedAt: string;
};

export type SharedFolder = {
  id: number;
  name: string;
  type: 'folder';
  childrenCount: number;
  updatedAt: string;
  permission: SharePermission;
  owner: {
    id: number | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};

export async function listSharedFolders(): Promise<SharedFolder[]> {
  const { folders } = await apiFetch<{ folders: SharedFolder[] }>('/api/folders/shared');
  return folders;
}

export async function listFolderShares(folderId: number): Promise<FolderShare[]> {
  const { shares } = await apiFetch<{ shares: FolderShare[] }>(`/api/folders/${folderId}/shares`);
  return shares;
}

export function shareFolder(folderId: number, email: string, permission: SharePermission): Promise<FolderShare> {
  return apiFetch<FolderShare>(`/api/folders/${folderId}/shares`, {
    method: 'POST',
    body: JSON.stringify({ email, permission }),
  });
}

export function updateFolderShare(folderId: number, userId: number, permission: SharePermission): Promise<FolderShare> {
  return apiFetch<FolderShare>(`/api/folders/${folderId}/shares/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ permission }),
  });
}

export function deleteFolderShare(folderId: number, userId: number): Promise<void> {
  return apiFetch<void>(`/api/folders/${folderId}/shares/${userId}`, { method: 'DELETE' });
}
