/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Campaign {
  id: string;
  name: string;
  account: string;
}

export interface AssetGroup {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  account: string;
  imageCount: number;
  maxImages: number;
  currentKpiMetric: 'impressions' | 'ctr' | 'conversions' | 'value';
}

export interface ScheduledTiming {
  id: string;
  startDate: string;
  endDate: string;
  offerName: string;
  fallbackAssetId: string; // Image to go back to when special offer ends
}

export interface CampaignAsset {
  id: string;
  name: string;
  url: string;
  performanceScore: 'Low' | 'Good' | 'Best' | 'Pending';
  kpiValue: number; // e.g., CTR % or Impressions count
  isProtected: boolean;
  scheduledTiming?: ScheduledTiming;
  uploadDate: string;
}

export interface ReplacementLog {
  id: string;
  date: string;
  campaignName: string;
  assetGroupName: string;
  replacedAsset: {
    name: string;
    url: string;
  } | null;
  newAsset: {
    name: string;
    url: string;
  };
  reason: 'KPI' | 'Special Offer' | 'Manual';
  kpiMetric?: string;
  status: 'Success' | 'Error';
  errorMsg?: string;
}

export interface MerchantProduct {
  id: string;
  name: string;
  category: 'Food' | 'Non-Food' | 'Apparel' | 'Electronics';
  sku: string;
  originalImageUrl: string;
  generatedImageUrl?: string;
  bgGenerationStatus: 'idle' | 'generating' | 'completed' | 'rejected';
  animationUrl?: string; // Mock video/gif reference
  animationStatus: 'idle' | 'generating' | 'completed' | 'rejected';
  brandScore?: number;
  complianceDetails?: {
    technicalPassed: boolean;
    safeZonePassed: boolean;
    logoDetected: boolean;
    textDensityPassed: boolean;
    vibeScore: number;
  };
  rejectionComment?: string;
}

export interface SpellingError {
  id: string;
  campaignName: string;
  assetGroupName: string;
  type: 'headline' | 'long_headline' | 'description' | 'path';
  originalText: string;
  errorWord: string;
  suggestion: string;
  status: 'pending' | 'accepted' | 'denied' | 'modified';
  userModifiedText?: string;
}

export interface CategoryPreset {
  category: string;
  backgroundPrompt: string;
  animationPreset: string;
  minComplianceScore: number;
  maxTextOverlay: number; // Max % text overlay allowed
  safetyMargins: number; // Padding around elements
}

export type ActiveSection = 'uploader' | 'background' | 'animation' | 'spell' | 'settings' | 'protection';

