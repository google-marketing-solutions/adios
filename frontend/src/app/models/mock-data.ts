/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AssetGroup,
  Campaign,
  CampaignAsset,
  CategoryPreset,
  MerchantProduct,
  ReplacementLog,
  SpellingError,
} from './types';

export const mockCampaigns: Campaign[] = [
  {
    id: 'c1',
    name: 'Store_DE_PMax_Brand_2026',
    account: 'Retailer DE (100-000-0001)',
  },
  {
    id: 'c2',
    name: 'Store_AT_PMax_Generic_Dogs',
    account: 'Retailer AT (100-000-0002)',
  },
  {
    id: 'c3',
    name: 'Store_CH_PMax_Generic_Aquatics',
    account: 'Retailer CH (100-000-0003)',
  },
  {
    id: 'c4',
    name: 'Store_DE_Seasonal_SummerSale',
    account: 'Retailer DE (100-000-0001)',
  },
];

export const mockAssetGroups: AssetGroup[] = [
  {
    id: 'ag1',
    name: 'Premium Dog Food - Wet & Dry',
    campaignId: 'c1',
    campaignName: 'Store_DE_PMax_Brand_2026',
    account: 'Retailer DE',
    imageCount: 3,
    maxImages: 20,
    currentKpiMetric: 'ctr',
  },
  {
    id: 'ag2',
    name: 'Puppy Starter Bundles',
    campaignId: 'c2',
    campaignName: 'Store_AT_PMax_Generic_Dogs',
    account: 'Retailer AT',
    imageCount: 2,
    maxImages: 20,
    currentKpiMetric: 'ctr',
  },
  {
    id: 'ag3',
    name: 'Nano Aquariums & Aquascaping',
    campaignId: 'c3',
    campaignName: 'Store_CH_PMax_Generic_Aquatics',
    account: 'Retailer CH',
    imageCount: 2,
    maxImages: 20,
    currentKpiMetric: 'conversions',
  },
  {
    id: 'ag4',
    name: 'Cat Tree & Scratching Posts',
    campaignId: 'c1',
    campaignName: 'Store_DE_PMax_Brand_2026',
    account: 'Retailer DE',
    imageCount: 2,
    maxImages: 20,
    currentKpiMetric: 'impressions',
  },
  {
    id: 'ag5',
    name: 'Summer Special - Dog Pools',
    campaignId: 'c4',
    campaignName: 'Store_DE_Seasonal_SummerSale',
    account: 'Retailer DE',
    imageCount: 1,
    maxImages: 20,
    currentKpiMetric: 'value',
  },
];

// Existing assets inside each asset group to mock the replace functionality
export const mockCampaignAssets: Record<string, CampaignAsset[]> = {
  ag1: [
    {
      id: 'a101',
      name: 'DogFood_MainHero_Protected',
      url: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&q=80',
      performanceScore: 'Best',
      kpiValue: 4.8,
      isProtected: true,
      uploadDate: '2026-05-10',
    },
    {
      id: 'a102',
      name: 'DogFood_BowlCloseUp',
      url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&q=80',
      performanceScore: 'Good',
      kpiValue: 3.2,
      isProtected: false,
      uploadDate: '2026-05-12',
    },
    {
      id: 'a103',
      name: 'DogFood_BadPerformance',
      url: 'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=400&q=80',
      performanceScore: 'Low',
      kpiValue: 1.1,
      isProtected: false,
      uploadDate: '2026-05-15',
    },
  ],
  ag2: [
    {
      id: 'a201',
      name: 'Puppy_Starter_LogoText_Protected',
      url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&q=80',
      performanceScore: 'Best',
      kpiValue: 5.2,
      isProtected: true,
      uploadDate: '2026-06-01',
    },
    {
      id: 'a202',
      name: 'Puppy_Starter_Basket_BadKPI',
      url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&q=80',
      performanceScore: 'Low',
      kpiValue: 0.9,
      isProtected: false,
      uploadDate: '2026-06-03',
    },
  ],
  ag3: [
    {
      id: 'a301',
      name: 'Aquarium_Aesthetic_HighKPI',
      url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80',
      performanceScore: 'Best',
      kpiValue: 420,
      isProtected: false,
      uploadDate: '2026-06-10',
    },
    {
      id: 'a302',
      name: 'Aquarium_Nano_WorstKPI',
      url: 'https://images.unsplash.com/photo-1520301255226-85d1f40d4274?w=400&q=80',
      performanceScore: 'Low',
      kpiValue: 45,
      isProtected: false,
      uploadDate: '2026-06-12',
    },
  ],
  ag4: [
    {
      id: 'a401',
      name: 'CatTree_Standard_Protected',
      url: 'https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=400&q=80',
      performanceScore: 'Best',
      kpiValue: 98000,
      isProtected: true,
      uploadDate: '2026-04-20',
    },
    {
      id: 'a402',
      name: 'CatTree_SisalPost_LowImpressions',
      url: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400&q=80',
      performanceScore: 'Low',
      kpiValue: 12000,
      isProtected: false,
      uploadDate: '2026-04-22',
    },
  ],
  ag5: [
    {
      id: 'a501',
      name: 'DogPool_ActionShot',
      url: 'https://images.unsplash.com/photo-1541599540903-216a46ca1fc0?w=400&q=80',
      performanceScore: 'Good',
      kpiValue: 850,
      isProtected: false,
      uploadDate: '2026-07-01',
    },
  ],
};

export const mockMerchantProducts: MerchantProduct[] = [
  {
    id: 'p1',
    name: 'Premium Dog Pâté Beef 400g',
    category: 'Food',
    sku: 'SKU-DOG-PAT-001',
    originalImageUrl:
      'https://images.unsplash.com/photo-1608454504242-a27a7ab0d296?w=400&q=80',
    bgGenerationStatus: 'idle',
    animationStatus: 'idle',
  },
  {
    id: 'p2',
    name: 'Cat Kibble Tender Salmon 1.5kg',
    category: 'Food',
    sku: 'SKU-CAT-KIB-002',
    originalImageUrl:
      'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&q=80',
    bgGenerationStatus: 'idle',
    animationStatus: 'idle',
  },
  {
    id: 'p3',
    name: 'ClearView LED Glass Aquarium 30L',
    category: 'Non-Food',
    sku: 'SKU-AQ-LED-30L',
    originalImageUrl:
      'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=400&q=80',
    bgGenerationStatus: 'idle',
    animationStatus: 'idle',
  },
  {
    id: 'p4',
    name: 'Orthopedic Dog Bed "Lounge" Grey L',
    category: 'Non-Food',
    sku: 'SKU-DOG-BED-M9',
    originalImageUrl:
      'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=400&q=80',
    bgGenerationStatus: 'idle',
    animationStatus: 'idle',
  },
  {
    id: 'p5',
    name: 'Deluxe Sisal Cat Scratching Post Cream 120cm',
    category: 'Non-Food',
    sku: 'SKU-CAT-SCR-120',
    originalImageUrl:
      'https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=400&q=80',
    bgGenerationStatus: 'idle',
    animationStatus: 'idle',
  },
];

export const mockReplacementLogs: ReplacementLog[] = [
  {
    id: 'l1',
    date: '2026-07-13 14:32',
    campaignName: 'Store_DE_PMax_Brand_2026',
    assetGroupName: 'Premium Dog Food - Wet & Dry',
    replacedAsset: {
      name: 'DogFood_OldPromo',
      url: 'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=400&q=80',
    },
    newAsset: {
      name: 'DogFood_GourmetBeef_July_AI',
      url: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400&q=80',
    },
    reason: 'KPI',
    kpiMetric: 'CTR (1.1% vs 4.8%)',
    status: 'Success',
  },
  {
    id: 'l2',
    date: '2026-07-13 11:15',
    campaignName: 'Store_DE_Seasonal_SummerSale',
    assetGroupName: 'Summer Special - Dog Pools',
    replacedAsset: {
      name: 'DogPool_GeneralBanner',
      url: 'https://images.unsplash.com/photo-1541599540903-216a46ca1fc0?w=400&q=80',
    },
    newAsset: {
      name: 'DogPool_WeekendSpecial_Offer',
      url: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&q=80',
    },
    reason: 'Special Offer',
    kpiMetric: 'Scheduled Promotion',
    status: 'Success',
  },
  {
    id: 'l3',
    date: '2026-07-12 09:00',
    campaignName: 'Store_CH_PMax_Generic_Aquatics',
    assetGroupName: 'Nano Aquariums & Aquascaping',
    replacedAsset: null,
    newAsset: {
      name: 'Aqua_Flora_Premium',
      url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80',
    },
    reason: 'Manual',
    kpiMetric: 'Direct Upload',
    status: 'Success',
  },
  {
    id: 'l4',
    date: '2026-07-11 16:45',
    campaignName: 'Store_AT_PMax_Generic_Dogs',
    assetGroupName: 'Puppy Starter Bundles',
    replacedAsset: {
      name: 'Puppy_Starter_Basket_BadKPI',
      url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&q=80',
    },
    newAsset: {
      name: 'Puppy_Starter_Deluxe_New',
      url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&q=80',
    },
    reason: 'KPI',
    kpiMetric: 'CTR (0.9% replacement threshold)',
    status: 'Error',
    errorMsg: 'Google Ads API Timeout - Resubmitted in next sync batch',
  },
];

export const mockSpellingErrors: SpellingError[] = [
  {
    id: 'e1',
    campaignName: 'Store_DE_PMax_Brand_2026',
    assetGroupName: 'Premium Dog Food - Wet & Dry',
    type: 'headline',
    originalText: 'Premium Dog Food - Best choice for your pupy!',
    errorWord: 'pupy',
    suggestion: 'puppy',
    status: 'pending',
  },
  {
    id: 'e2',
    campaignName: 'Store_CH_PMax_Generic_Aquatics',
    assetGroupName: 'Nano Aquariums & Aquascaping',
    type: 'description',
    originalText:
      'Keep your aquarium clean and halthy with our filters. Made from 100% bio-degradable components.',
    errorWord: 'halthy',
    suggestion: 'healthy',
    status: 'pending',
  },
  {
    id: 'e3',
    campaignName: 'Store_DE_PMax_Brand_2026',
    assetGroupName: 'Cat Tree & Scratching Posts',
    type: 'long_headline',
    originalText:
      'Cat Scratching Post: Extreemly durable sisal structure and plush elements.',
    errorWord: 'Extreemly',
    suggestion: 'Extremely',
    status: 'pending',
  },
  {
    id: 'e4',
    campaignName: 'Store_AT_PMax_Generic_Dogs',
    assetGroupName: 'Puppy Starter Bundles',
    type: 'description',
    originalText:
      'Delicious organic kibbles and toys that your puppy will absolutly adore every single day!',
    errorWord: 'absolutly',
    suggestion: 'absolutely',
    status: 'pending',
  },
  {
    id: 'e5',
    campaignName: 'Store_DE_Seasonal_SummerSale',
    assetGroupName: 'Summer Special - Dog Pools',
    type: 'path',
    originalText: 'pools/disconts',
    errorWord: 'disconts',
    suggestion: 'discounts',
    status: 'pending',
  },
];

export const defaultCategoryPresets: CategoryPreset[] = [
  {
    category: 'Food',
    backgroundPrompt:
      'Elegant minimal stone kitchen countertop, warm soft lighting, clean studio background, depth of field, premium look',
    animationPreset:
      'Bowl Physics: Product elements gently fall into a beautiful modern ceramic bowl with natural bounce, floating pieces in air',
    minComplianceScore: 90,
    maxTextOverlay: 10,
    safetyMargins: 15,
  },
  {
    category: 'Non-Food',
    backgroundPrompt:
      'Bright scandinavian cozy living room corner, soft natural light, clean modern furniture, cinematic lens, blurred background',
    animationPreset:
      'Water Elements: Clean, pure water bubbling or filling up elegantly in a slow motion splash around the container',
    minComplianceScore: 85,
    maxTextOverlay: 15,
    safetyMargins: 20,
  },
  {
    category: 'Apparel',
    backgroundPrompt:
      'Abstract premium texture backdrop, pastel gradients, professional studio lighting, high fashion catalog aesthetic',
    animationPreset:
      'Elegant Rotate: Smooth 360 rotation with floating brand logo and sparkles',
    minComplianceScore: 92,
    maxTextOverlay: 5,
    safetyMargins: 10,
  },
  {
    category: 'Electronics',
    backgroundPrompt:
      'Sleek dark futuristic podium, neon edge lighting, dark industrial environment, isometric view, cinematic shadows',
    animationPreset:
      'Tech Pulse: Pulse zoom with soft glowing rays and technical telemetry graphics fading in',
    minComplianceScore: 88,
    maxTextOverlay: 20,
    safetyMargins: 15,
  },
];
