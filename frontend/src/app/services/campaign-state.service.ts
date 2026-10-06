/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {computed, Injectable, signal} from '@angular/core';
import {
  defaultCategoryPresets,
  mockAssetGroups,
  mockCampaignAssets,
  mockCampaigns,
  mockMerchantProducts,
  mockSpellingErrors,
} from '../models/mock-data';
import {
  ActiveSection,
  AssetGroup,
  Campaign,
  CampaignAsset,
  CategoryPreset,
  MerchantProduct,
  ReplacementLog,
  SpellingError,
} from '../models/types';

@Injectable({
  providedIn: 'root',
})
export class CampaignStateService {
  // Navigation State
  readonly activeSection = signal<ActiveSection>('uploader');

  // Core Data Stores (Signals)
  readonly campaigns = signal<Campaign[]>(mockCampaigns);
  readonly assetGroups = signal<AssetGroup[]>([]);
  readonly campaignAssets =
    signal<Record<string, CampaignAsset[]>>(mockCampaignAssets);
  readonly merchantProducts = signal<MerchantProduct[]>(mockMerchantProducts);
  readonly replacementLogs = signal<ReplacementLog[]>([]);
  readonly spellingErrors = signal<SpellingError[]>(mockSpellingErrors);
  readonly presets = signal<CategoryPreset[]>(defaultCategoryPresets);

  // Configuration & Active Filters State
  readonly supportedFormats = signal<string[]>(['.jpg', '.jpeg', '.png']);
  readonly onlyActiveCampaigns = signal<boolean>(false);
  readonly onlyActiveAssetGroups = signal<boolean>(false);
  readonly accountSearchQuery = signal<string>('');

  // Selection state
  readonly selectedCampaign = signal<Campaign>(mockCampaigns[0]);
  readonly selectedAssetGroup = signal<AssetGroup>(mockAssetGroups[0]);

  // Computed Values
  readonly pendingErrorsCount = computed(
    () => this.spellingErrors().filter((e) => e.status === 'pending').length,
  );

  readonly selectedGroupAssets = computed(() => {
    const group = this.selectedAssetGroup();
    return group ? this.campaignAssets()[group.id] || [] : [];
  });

  // Actions / Reducers
  setSupportedFormats(formats: string[]): void {
    this.supportedFormats.set(formats);
  }

  toggleAssetProtection(assetIdentifier: string, isProtected?: boolean): void {
    // Account-wide protection toggle: updates asset across ALL asset groups
    this.campaignAssets.update((prevMap) => {
      const updatedMap: Record<string, CampaignAsset[]> = {};
      for (const groupKey of Object.keys(prevMap)) {
        updatedMap[groupKey] = prevMap[groupKey].map((asset) => {
          if (asset.id === assetIdentifier || asset.url === assetIdentifier) {
            const nextVal =
              isProtected !== undefined ? isProtected : !asset.isProtected;
            return {...asset, isProtected: nextVal};
          }
          return asset;
        });
      }
      return updatedMap;
    });
  }

  // Actions / Reducers
  setAssetGroups(groups: AssetGroup[]): void {
    this.assetGroups.set(groups);
  }

  setActiveSection(section: ActiveSection): void {
    this.activeSection.set(section);
  }

  selectCampaign(campaign: Campaign): void {
    this.selectedCampaign.set(campaign);
    // Auto-select first asset group matching this campaign
    const matchingGroups = this.assetGroups().filter(
      (ag) => ag.campaignId === campaign.id,
    );
    if (matchingGroups.length > 0) {
      this.selectedAssetGroup.set(matchingGroups[0]);
    }
  }

  selectAssetGroup(group: AssetGroup): void {
    this.selectedAssetGroup.set(group);
  }

  addLog(newLog: ReplacementLog): void {
    this.replacementLogs.update((prev) => [newLog, ...prev]);
  }

  updateAssets(groupId: string, assets: CampaignAsset[]): void {
    this.campaignAssets.update((prev) => ({
      ...prev,
      [groupId]: assets,
    }));
  }

  updateAssetGroupImageCount(groupId: string, count: number): void {
    this.assetGroups.update((prev) =>
      prev.map((ag) => {
        if (ag.id === groupId) {
          return {...ag, imageCount: count};
        }
        return ag;
      }),
    );
    // Sync current selection if modified
    const currentSelected = this.selectedAssetGroup();
    if (currentSelected && currentSelected.id === groupId) {
      this.selectedAssetGroup.set({...currentSelected, imageCount: count});
    }
  }

  updateProduct(updatedProduct: MerchantProduct): void {
    this.merchantProducts.update((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)),
    );
  }

  updateBulkProducts(updatedList: MerchantProduct[]): void {
    this.merchantProducts.set(updatedList);
  }

  updateSpellingError(updatedError: SpellingError): void {
    this.spellingErrors.update((prev) =>
      prev.map((e) => (e.id === updatedError.id ? updatedError : e)),
    );
  }

  updateBulkSpellingErrors(updatedList: SpellingError[]): void {
    this.spellingErrors.set(updatedList);
  }

  savePresets(updatedPresets: CategoryPreset[]): void {
    this.presets.set(updatedPresets);
  }
}
