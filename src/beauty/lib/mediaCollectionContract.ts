import type {
  CaptureSubmitMode,
  MediaAnalysisStatus,
  MediaCollectionTask,
  MediaKind,
  MediaSubmission,
} from '../types';

export const mediaCollectionEndpoints = {
  createTask: '/media-collection-tasks',
  updateTask: (taskId: string) => `/media-collection-tasks/${taskId}`,
  getTask: (taskId: string) => `/media-collection-tasks/${taskId}`,
  initUpload: '/media-submissions/init-upload',
  completeUpload: (submissionId: string) => `/media-submissions/${submissionId}/complete`,
  getAnalysis: (submissionId: string) => `/media-submissions/${submissionId}/analysis`,
  retryAnalysis: (submissionId: string) => `/media-submissions/${submissionId}/retry-analysis`,
  mediaAuditLogs: '/audit-logs?resourceType=media',
  materialAssets: '/material-library/assets',
  materialInsights: '/material-library/insights',
  analysisRuns: (assetId: string) => `/media-assets/${assetId}/analysis-runs`,
  materialCandidates: '/material-candidates',
  submitCandidateReview: (candidateId: string) => `/material-candidates/${candidateId}/submit-review`,
  publishGoldenMaterial: (materialId: string) => `/golden-materials/${materialId}/publish`,
  retireGoldenMaterial: (materialId: string) => `/golden-materials/${materialId}/retire`,
  draftDerivedAsset: '/derived-assets/draft-from-materials',
} as const;

export interface CreateMediaCollectionTaskRequest extends Omit<MediaCollectionTask, 'id' | 'status' | 'targetCount' | 'submittedCount' | 'consentDeniedCount' | 'analysisCompletedCount' | 'submissions'> {
  status?: 'draft' | 'scheduled' | 'active';
}

export interface InitMediaUploadRequest {
  taskId: string;
  baId: string;
  mediaKind: MediaKind;
  source: CaptureSubmitMode;
  fileName: string;
  mimeType: string;
  byteSize: number;
  consentRecordId: string;
}

export interface InitMediaUploadResponse {
  submissionId: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface CompleteMediaUploadRequest {
  durationSec: number;
  checksum: string;
}

export interface MediaAnalysisResult {
  submissionId: MediaSubmission['id'];
  status: MediaAnalysisStatus;
  transcript?: string;
  overallScore?: number;
  tags: string[];
  summary?: string;
  suggestions: string[];
  modelVersion?: string;
  confidence?: number;
  dimensions: Array<{
    rubricId: string;
    score: number;
    evidence: Array<{ startSec: number; endSec: number; quote: string }>;
  }>;
}
