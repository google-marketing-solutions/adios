/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Injectable, signal, computed } from '@angular/core';
import { 
  Campaign, 
  AssetGroup, 
  CampaignAsset, 
  MerchantProduct, 
  SpellingError, 
  ReplacementLog, 
  CategoryPreset,
  ActiveSection
} from '../models/types';
import { 
  mockCampaigns, 
  mockAssetGroups, 
  mockCampaignAssets, 
  mockMerchantProducts, 
  mockReplacementLogs, 
  mockSpellingErrors, 
  defaultCategoryPresets 
} from '../models/mock-data';

@Injectable({
  providedIn: 'root'
})
export class CampaignStateService {
  // Navigation State
  readonly activeSection = signal<ActiveSection>('uploader');

  // Core Data Stores (Signals)
  readonly campaigns = signal<Campaign[]>(mockCampaigns);
  readonly assetGroups = signal<AssetGroup[]>([]);
  readonly campaignAssets = signal<Record<string, CampaignAsset[]>>(mockCampaignAssets);
  readonly merchantProducts = signal<MerchantProduct[]>(mockMerchantProducts);
  readonly replacementLogs = signal<ReplacementLog[]>(mockReplacementLogs);
  readonly spellingErrors = signal<SpellingError[]>(mockSpellingErrors);
  readonly presets = signal<CategoryPreset[]>(defaultCategoryPresets);

  // Selection state
  readonly selectedCampaign = signal<Campaign>(mockCampaigns[0]);
  readonly selectedAssetGroup = signal<AssetGroup>(mockAssetGroups[0]);

  // Computed Values
  readonly pendingErrorsCount = computed(() => 
    this.spellingErrors().filter(e => e.status === 'pending').length
  );

  readonly selectedGroupAssets = computed(() => {
    const group = this.selectedAssetGroup();
    return group ? (this.campaignAssets()[group.id] || []) : [];
  });

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
    const matchingGroups = this.assetGroups().filter(ag => ag.campaignId === campaign.id);
    if (matchingGroups.length > 0) {
      this.selectedAssetGroup.set(matchingGroups[0]);
    }
  }

  selectAssetGroup(group: AssetGroup): void {
    this.selectedAssetGroup.set(group);
  }

  addLog(newLog: ReplacementLog): void {
    this.replacementLogs.update(prev => [newLog, ...prev]);
  }

  updateAssets(groupId: string, assets: CampaignAsset[]): void {
    this.campaignAssets.update(prev => ({
      ...prev,
      [groupId]: assets
    }));
  }

  toggleAssetProtection(assetId: string): void {
    this.campaignAssets.update(prev => {
      const updated = { ...prev };
      
      // Find current protection state
      let currentIsProtected = false;
      for (const group of Object.keys(updated)) {
        const found = updated[group].find(a => a.id === assetId);
        if (found) {
          currentIsProtected = found.isProtected;
          break;
        }
      }
      
      const targetProtection = !currentIsProtected;
      
      // Toggle for all assets matching this ID in any group
      for (const group of Object.keys(updated)) {
        updated[group] = updated[group].map(asset => {
          if (asset.id === assetId) {
            return { ...asset, isProtected: targetProtection };
          }
          return asset;
        });
      }
      return updated;
    });
  }

  updateAssetGroupImageCount(groupId: string, count: number): void {
    this.assetGroups.update(prev => prev.map(ag => {
      if (ag.id === groupId) {
        return { ...ag, imageCount: count };
      }
      return ag;
    }));
    // Sync current selection if modified
    const currentSelected = this.selectedAssetGroup();
    if (currentSelected && currentSelected.id === groupId) {
      this.selectedAssetGroup.set({ ...currentSelected, imageCount: count });
    }
  }

  updateProduct(updatedProduct: MerchantProduct): void {
    this.merchantProducts.update(prev => prev.map(p => 
      p.id === updatedProduct.id ? updatedProduct : p
    ));
  }

  updateBulkProducts(updatedList: MerchantProduct[]): void {
    this.merchantProducts.set(updatedList);
  }

  updateSpellingError(updatedError: SpellingError): void {
    this.spellingErrors.update(prev => prev.map(e => 
      e.id === updatedError.id ? updatedError : e
    ));
  }

  updateBulkSpellingErrors(updatedList: SpellingError[]): void {
    this.spellingErrors.set(updatedList);
  }

  savePresets(updatedPresets: CategoryPreset[]): void {
    this.presets.set(updatedPresets);
  }
}
