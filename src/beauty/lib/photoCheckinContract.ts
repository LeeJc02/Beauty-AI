import type { PhotoCheckinRecord, PhotoCheckinStatus } from '../types';

export const photoCheckinEndpoints = {
  list: '/ba-photo-checkins',
  detail: (recordId: string) => `/ba-photo-checkins/${recordId}`,
  create: '/ba-photo-checkins',
} as const;

export interface PhotoCheckinListQuery {
  dateFrom?: string;
  dateTo?: string;
  regionId?: string;
  storeId?: string;
  baQuery?: string;
  status?: PhotoCheckinStatus | 'all';
  page?: number;
  pageSize?: number;
}

export interface PhotoCheckinListResponse {
  items: PhotoCheckinRecord[];
  summary: {
    totalBa: number;
    completedBa: number;
    missingBa: number;
    completionRate: number;
  };
  page: number;
  pageSize: number;
  total: number;
}

export interface CreatePhotoCheckinRequest {
  baId: string;
  checkinDate: string;
  makeupPhotoAssetId: string;
  counterPhotoAssetId: string;
}
