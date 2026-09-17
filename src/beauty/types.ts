export type Role = 'Super Admin' | 'HQ Trainer' | 'Regional Manager' | 'Regional Training Manager' | 'Regional Trainer';

export type PhotoCheckinStatus = 'completed' | 'missing';
export type PhotoCheckinPhotoSource = 'camera' | 'album';

export interface PhotoCheckinPhoto {
  assetId: string;
  fileName: string;
  mimeType: string;
  source: PhotoCheckinPhotoSource;
  capturedAt: string;
  previewUrl: string;
  aiScore?: number;
}

export interface PhotoCheckinRecord {
  id: string;
  baId: string;
  baName: string;
  regionId: string;
  regionName: string;
  storeId: string;
  storeName: string;
  checkinDate: string;
  submittedAt?: string;
  status: PhotoCheckinStatus;
  makeupPhoto?: PhotoCheckinPhoto;
  counterPhoto?: PhotoCheckinPhoto;
}

export type MediaKind = 'audio' | 'video';

export type CaptureTarget =
  | {
      kind: 'product';
      productId: string;
      productVersion: string;
      productName: string;
      productDescription: string;
    }
  | {
      kind: 'scenario';
      title: string;
      description: string;
      successCriteria: string;
    };

export type CaptureSubmitMode = 'record' | 'upload';

export interface CaptureLimits {
  maxDurationSec: number;
  maxBytes: number;
  acceptedMimeTypes: string[];
}

export interface CaptureRequirement {
  enabled: boolean;
  mediaKind?: MediaKind;
  submitModes: CaptureSubmitMode[];
  fullInteractionRecording?: boolean;
  consentRequired: boolean;
  limits: CaptureLimits;
}

export interface PracticeCaptureConfig {
  enabled: boolean;
  mediaKind?: MediaKind;
  fullInteractionRecording: boolean;
  consentRequired: boolean;
  limits?: CaptureLimits;
}

export interface RubricDimension {
  id: string;
  name: string;
  description: string;
  weight: number;
  required: boolean;
}

export type MediaCollectionTaskStatus = '草稿' | '待开始' | '进行中' | '已结束' | '已停用';
export type MediaAnalysisStatus = 'processing' | 'completed' | 'needs_attention' | 'failed';
export type MaterialCandidateType = 'customer_pattern' | 'sales_method' | 'scenario_beat' | 'quote';
export type MaterialAssetStatus = 'processing' | 'ready' | 'needs_attention' | 'deleted';
export type MaterialCandidateStatus = 'pending_review' | 'nominated' | 'approved' | 'rejected';
export type GoldenMaterialStatus = 'active' | 'retired' | 'source_unavailable';
export type MaterialScope = '全国共享' | '区域可用';
export type DerivedAssetKind = 'avatar' | 'script' | 'quote';
export type MaterialTargetKind = 'product' | 'scenario';
export type MaterialReviewStatus = 'recommended' | 'approved' | 'dismissed';

/** A user-managed collection of reusable golden materials. */
export interface GoldenAlbum {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaSubmission {
  id: string;
  baId: string;
  baName: string;
  region: string;
  storeName: string;
  submittedAt: string;
  durationSec: number;
  source: CaptureSubmitMode;
  consentStatus: 'granted' | 'denied' | 'device_permission_failed';
  analysisStatus: MediaAnalysisStatus;
  overallScore?: number;
  tags: string[];
  mediaDeleted?: boolean;
}

export interface MediaCollectionTask {
  id: string;
  title: string;
  intro: string;
  targetAudienceIds: string[];
  targetAudienceLabel: string;
  target: CaptureTarget;
  capture: CaptureRequirement;
  rubric: RubricDimension[];
  startAt: string;
  deadline: string;
  frequency: string;
  scope: '全国' | '区域';
  region?: string;
  creatorId: string;
  creatorName: string;
  status: MediaCollectionTaskStatus;
  targetCount: number;
  submittedCount: number;
  consentDeniedCount: number;
  analysisCompletedCount: number;
  submissions: MediaSubmission[];
}

export interface SourceEvidence {
  id: string;
  mediaAssetId: string;
  startSec: number;
  endSec: number;
  transcript: string;
}

export interface MediaAsset {
  id: string;
  submissionId: string;
  taskId: string;
  taskTitle: string;
  mediaKind: MediaKind;
  fileName: string;
  durationSec: number;
  submittedAt: string;
  submitterName: string;
  region: string;
  scope: '全国' | '区域';
  productOrScenario: string;
  tags: string[];
  status: MaterialAssetStatus;
  analysisRunId?: string;
  sourceDeleted?: boolean;
  transcript?: string;
  aiCommentary?: string;
  insights?: string[];
  goldenMaterialId?: string;
}

export interface AnalysisRun {
  id: string;
  mediaAssetId: string;
  status: MediaAnalysisStatus;
  transcript: string;
  segments: SourceEvidence[];
  tags: string[];
  aiCommentary: string;
  insights: string[];
  modelVersion: string;
  confidence: number;
  completedAt?: string;
}

export interface MaterialCandidate {
  id: string;
  type: MaterialCandidateType;
  title: string;
  summary: string;
  targetLabel: string;
  region: string;
  tags: string[];
  evidence: SourceEvidence[];
  analysisRunId: string;
  status: MaterialCandidateStatus;
  aiCommentary: string;
  suggestedScope: MaterialScope;
  createdAt: string;
}

export interface MaterialRecommendation {
  id: string;
  mediaAssetId: string;
  transcript: string;
  aiSummary: string;
  recommendationReason: string;
  mediaKind: MediaKind;
  targetKind: MaterialTargetKind;
  targetLabel: string;
  region: string;
  status: MaterialReviewStatus;
  createdAt: string;
}

export interface GoldenMaterial {
  id: string;
  candidateId: string;
  type: MaterialCandidateType;
  title: string;
  summary: string;
  targetLabel: string;
  region: string;
  scope: MaterialScope;
  tags: string[];
  evidence: SourceEvidence[];
  reviewerName: string;
  reviewedAt: string;
  version: number;
  status: GoldenMaterialStatus;
  /** Optional so newly promoted materials can remain unfiled until assigned. */
  albumId?: string;
  quoteText?: string;
  sourceMediaAssetId?: string;
  transcript?: string;
  aiSummary?: string;
  mediaKind?: MediaKind;
  targetKind?: MaterialTargetKind;
}

export interface DerivedAssetReference {
  id: string;
  materialId: string;
  sourceMediaAssetId?: string;
  materialVersion: number;
  materialTitle: string;
  materialScope: MaterialScope;
  evidenceIds: string[];
  evidenceRanges: Array<{ startSec: number; endSec: number }>;
  transcriptSnapshot: string;
  derivedAssetKind: DerivedAssetKind;
  createdAt: string;
  sourceStatus: GoldenMaterialStatus;
}
