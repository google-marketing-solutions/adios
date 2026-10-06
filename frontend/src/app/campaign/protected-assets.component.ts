/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {CommonModule} from '@angular/common';
import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {AssetGroup, CampaignAsset} from '../models/types';
import {AccountItem, ApiService} from '../services/api.service';
import {CampaignStateService} from '../services/campaign-state.service';

@Component({
  selector: 'app-protected-assets',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="protection-container p-8 space-y-6 select-none animate-fade-in">
      <!-- Header banner -->
      <div class="header-banner flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border p-6 rounded-2xl shadow-xs">
        <div>
          <h2 class="font-bold text-base text-slate-800 m-0">Image Protector</h2>
          <p class="text-xs text-muted mt-1 leading-normal m-0 max-w-xl">
            Configure account-wide protected visual assets. Protected assets are guarded against automated eviction and rotation algorithms across all PMax asset groups.
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4">
        <!-- Quick stats counters (Interactive Filter Buttons) -->
        <div class="flex flex-wrap items-center gap-3">
          <!-- Button 1: Total -->
          <button
            (click)="activeFilter.set('all')"
            [class]="'stat-pill transition-all duration-150 flex items-center gap-2 cursor-pointer ' + 
              (activeFilter() === 'all' ? 'pill-all-active shadow-xs' : '')"
          >
            <mat-icon class="icon-size-small">photo_library</mat-icon>
            <span>All Account Assets:</span>
            <span class="font-extrabold">{{ totalCount() }}</span>
          </button>

          <!-- Button 2: Protected -->
          <button
            (click)="activeFilter.set('protected')"
            [class]="'stat-pill transition-all duration-150 flex items-center gap-2 cursor-pointer ' + 
              (activeFilter() === 'protected' ? 'pill-protected-active shadow-xs' : 'text-indigo hover:bg-indigo-50/40')"
          >
            <mat-icon class="icon-size-small">security</mat-icon>
            <span>Protected Assets:</span>
            <span class="font-extrabold">{{ protectedCount() }}</span>
          </button>

          <!-- Button 3: Unprotected -->
          <button
            (click)="activeFilter.set('unprotected')"
            [class]="'stat-pill transition-all duration-150 flex items-center gap-2 cursor-pointer ' + 
              (activeFilter() === 'unprotected' ? 'pill-unprotected-active shadow-xs' : 'text-slate-500 hover:bg-slate-50')"
          >
            <mat-icon class="icon-size-small">no_encryption</mat-icon>
            <span>Unprotected Assets:</span>
            <span class="font-extrabold">{{ unprotectedCount() }}</span>
          </button>
        </div>

        <!-- Account Selector Dropdown -->
        <div class="relative inline-block text-left select-none" [style.z-index]="isAccountDropdownOpen() ? 100 : 1">
          @if (isAccountDropdownOpen()) {
            <!-- Backdrop overlay to dismiss dropdown -->
            <div
              class="fixed inset-0 z-40 cursor-default"
              (click)="isAccountDropdownOpen.set(false); $event.stopPropagation()"
            ></div>
          }

          <button
            type="button"
            (click)="isAccountDropdownOpen.set(!isAccountDropdownOpen())"
            class="dropdown-trigger"
            style="min-width: 250px;"
          >
            <div class="flex items-center gap-2">
              <mat-icon class="icon-size-small text-indigo">account_circle</mat-icon>
              <span>{{ selectedAccount() ? (selectedAccount()?.descriptive_name || selectedAccount()?.name) : 'Select Account...' }}</span>
            </div>
            <mat-icon class="icon-size-small text-slate-400">arrow_drop_down</mat-icon>
          </button>

          <!-- Dropdown Panel (Overlay) -->
          @if (isAccountDropdownOpen()) {
            <div
              class="dropdown-panel animate-fade-in"
              (click)="$event.stopPropagation()"
            >
              <!-- Dropdown Search Box -->
              <div class="dropdown-search-container">
                <mat-icon class="text-slate-400 absolute left-6 text-sm" style="font-size: 16px; width: 16px; height: 16px; top: 20px;">search</mat-icon>
                <input
                  type="text"
                  [ngModel]="accountSearchQuery()"
                  (ngModelChange)="accountSearchQuery.set($event)"
                  class="dropdown-search-input"
                  placeholder="Search account..."
                />
              </div>

              <!-- Accounts List -->
              <div class="dropdown-list">
                @for (acc of filteredAccountsForDropdown(); track acc.id) {
                  <button
                    type="button"
                    (click)="onAccountChange(acc)"
                    [class]="'dropdown-item ' + (selectedAccount()?.id === acc.id ? 'dropdown-item-active' : '')"
                  >
                    <div class="flex flex-col gap-0.5">
                      <span class="dropdown-item-title">{{ acc.descriptive_name || acc.name }}</span>
                      <span class="dropdown-item-subtitle">{{ acc.id }}</span>
                    </div>
                    @if (selectedAccount()?.id === acc.id) {
                      <mat-icon class="text-indigo text-xs" style="font-size: 14px; width: 14px; height: 14px;">check</mat-icon>
                    }
                  </button>
                } @empty {
                  @if (isLoadingAccounts()) {
                    <div class="px-4 py-6 flex flex-col items-center justify-center gap-2">
                      <mat-icon class="animate-spin text-slate-400" style="font-size: 20px; width: 20px; height: 20px;">refresh</mat-icon>
                      <span class="text-xs text-slate-400">Loading accounts...</span>
                    </div>
                  } @else if (accessibleAccounts().length === 0) {
                    <div class="px-4 py-4 text-xs text-slate-400 text-center">No Accounts</div>
                  } @else {
                    <div class="px-4 py-4 text-xs text-slate-400 text-center">No matching accounts</div>
                  }
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Search & Table Panel -->
      <div class="panel bg-white border rounded-2xl shadow-xs overflow-hidden flex flex-col">
        <!-- Interactive Search Bar -->
        <div class="search-bar p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div class="relative grow max-w-md flex items-center">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Search assets by name or ID..."
              class="search-input"
            />
            @if (searchQuery()) {
              <button
                (click)="searchQuery.set('')"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer flex items-center justify-center p-0"
              >
                <mat-icon class="text-xs">close</mat-icon>
              </button>
            }
          </div>
          <div class="text-[11px] text-muted font-medium">
            Showing {{ filteredAssets().length }} of {{ allAssets().length }} assets
          </div>
        </div>

        <!-- Assets Table View -->
        <div class="overflow-x-auto">
          @if (filteredAssets().length > 0) {
            <table class="w-full text-left border-collapse m-0">
              <thead>
                <tr class="bg-slate-50 border-b text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th class="p-4 w-20 text-center">Preview</th>
                  <th class="p-4 w-36">Asset ID</th>
                  <th class="p-4">Name</th>
                  <th class="p-4 w-48 text-right">Protection Status</th>
                </tr>
              </thead>
              <tbody class="divide-y text-xs text-slate-700">
                @for (asset of filteredAssets(); track asset.id) {
                  <tr class="hover:bg-slate-50/50 transition-colors duration-150">
                    <!-- Image Preview -->
                    <td class="p-4 text-center">
                      <div class="preview-wrapper inline-block relative rounded-lg overflow-hidden border bg-slate-50">
                        <img [src]="asset.url" [alt]="asset.name" class="w-10 h-10 object-cover" />
                      </div>
                    </td> 

                    <!-- Asset ID -->
                    <td class="p-4 font-mono text-[10px] font-bold text-slate-500">
                      <span class="px-2 py-0.5 bg-slate-100 rounded border">{{ asset.id }}</span>
                    </td>

                    <!-- Asset Name -->
                    <td class="p-4">
                      <p class="font-bold text-slate-800 m-0 text-xs">{{ asset.name }}</p>
                    </td>

                    <td class="p-4 text-right">
                      <button
                        (click)="toggleAssetProtection(asset.id)"
                        [class]="'btn-protect cursor-pointer ml-auto ' + 
                          (asset.isProtected ? 'btn-protected-active shadow-xs' : 'btn-protected-inactive')"
                      >
                        <mat-icon class="text-xs icon-size-small">{{ asset.isProtected ? 'shield' : 'shield_outline' }}</mat-icon>
                        <span>{{ asset.isProtected ? 'Protected' : 'Protect Asset' }}</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <div class="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <mat-icon class="text-3xl opacity-40">find_in_page</mat-icon>
              <p class="text-xs font-medium m-0">No matching assets found for current filter selection.</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    .protection-container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .text-indigo {
      color: #4f46e5;
    }
    .stat-pill {
      border-radius: 9999px;
      padding: 6px 14px;
      font-size: 12px;
      border: 1px solid #e2e8f0;
      background-color: #ffffff;
      color: #475569;
    }
    .pill-all-active {
      background-color: #f1f5f9 !important;
      border-color: #cbd5e1 !important;
      color: #0f172a !important;
    }
    .pill-protected-active {
      background-color: #e0e7ff !important;
      border-color: #c7d2fe !important;
      color: #3730a3 !important;
    }
    .pill-unprotected-active {
      background-color: #f1f5f9 !important;
      border-color: #cbd5e1 !important;
      color: #334155 !important;
    }
    .btn-protect {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      transition: all 0.15s ease-in-out;
    }
    .btn-protected-active {
      background-color: #4f46e5;
      color: #ffffff;
      border: 1px solid #4338ca;
    }
    .btn-protected-active:hover {
      background-color: #4338ca;
    }
    .btn-protected-inactive {
      background-color: #ffffff;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .btn-protected-inactive:hover {
      background-color: #f8fafc;
      color: #0f172a;
      border-color: #94a3b8;
    }
    .icon-size-small {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .search-icon {
      position: absolute;
      left: 12px;
      color: #94a3b8;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .search-input {
      width: 100%;
      padding: 8px 12px 8px 38px;
      border-radius: 10px;
      border: 1px solid #cbd5e1;
      font-size: 12px;
      background-color: #ffffff;
      outline: none;
      transition: all 0.15s ease;
    }
    .search-input:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 1px #4f46e5;
    }
    .dropdown-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 9999px;
      border: 1px solid #cbd5e1;
      background-color: #ffffff;
      color: #1e293b;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .dropdown-trigger:hover {
      border-color: #94a3b8;
    }
    .dropdown-panel {
      position: absolute;
      right: 0;
      margin-top: 6px;
      width: 280px;
      background-color: #ffffff;
      border: 1px solid #dadce0;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      z-index: 100;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .dropdown-search-container {
      padding: 12px;
      border-bottom: 1px solid #f1f3f4;
      background-color: #ffffff;
      position: relative;
    }
    .dropdown-search-input {
      width: 100%;
      border: 1px solid #dadce0;
      border-radius: 8px;
      padding: 8px 12px 8px 36px;
      font-size: 12px;
      color: #202124;
      background-color: #f8f9fa;
      transition: all 0.15s ease-in-out;
    }
    .dropdown-search-input:focus {
      background-color: #ffffff;
      border-color: #4f46e5;
      box-shadow: 0 0 0 1px #4f46e5;
      outline: none;
    }
    .dropdown-list {
      max-height: 240px;
      overflow-y: auto;
    }
    .dropdown-item {
      width: 100%;
      text-align: left;
      padding: 12px 16px;
      background: none;
      border: none;
      border-bottom: 1px solid #dadce0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .dropdown-item:last-child {
      border-bottom: none;
    }
    .dropdown-item:hover {
      background-color: #f8f9fa;
    }
    .dropdown-item-active {
      background-color: #e8f0fe !important;
    }
    .dropdown-item-title {
      font-size: 12px;
      font-weight: 700;
      color: #202124;
      display: block;
      margin-bottom: 2px;
    }
    .dropdown-item-active .dropdown-item-title {
      color: #4f46e5 !important;
    }
    .dropdown-item-subtitle {
      font-size: 11px;
      font-family: monospace;
      color: #70757a;
      display: block;
    }
  `,
  ],
})
export class ProtectedAssetsComponent implements OnInit {
  readonly stateService = inject(CampaignStateService);
  readonly apiService = inject(ApiService);

  // Accounts state
  readonly accessibleAccounts = signal<AccountItem[]>([]);
  readonly selectedAccount = signal<AccountItem | null>(null);
  readonly isLoadingAccounts = signal<boolean>(false);
  readonly isLoadingAssetGroups = signal<boolean>(false);
  readonly isLoadingAssets = signal<boolean>(false);

  // Live loaded assets for the selected account
  readonly liveAssets = signal<CampaignAsset[]>([]);

  // Dropdown states
  readonly isAccountDropdownOpen = signal<boolean>(false);
  readonly accountSearchQuery = signal<string>('');

  async ngOnInit(): Promise<void> {
    await this.loadAccounts();
  }

  async loadAccounts(): Promise<void> {
    this.isLoadingAccounts.set(true);
    try {
      const res = await this.apiService.fetchAccessibleAccounts();
      if (res && res.accounts && res.accounts.length > 0) {
        this.accessibleAccounts.set(res.accounts);
        this.selectedAccount.set(res.accounts[0]);
        await Promise.all([
          this.reloadAssetGroups(res.accounts[0].id),
          this.reloadCampaignAssets(res.accounts[0].id),
        ]);
      }
    } catch (err) {
      console.warn('Failed to load accounts in protected assets:', err);
    } finally {
      this.isLoadingAccounts.set(false);
    }
  }

  async reloadAssetGroups(customerId: string): Promise<void> {
    this.isLoadingAssetGroups.set(true);
    try {
      const res = await this.apiService.fetchAssetGroups(customerId);
      const rawGroups = res?.asset_groups || [];
      const formattedGroups: AssetGroup[] = rawGroups.map((ag) => ({
        id: ag.id,
        name: ag.name,
        campaignId: ag.campaign_id,
        campaignName: ag.campaign_name,
        account: `Google Ads Account (${customerId})`,
        imageCount: ag.total_image_count || 0,
        maxImages: ag.total_image_capacity || 20,
        currentKpiMetric: 'ctr',
        status: (ag.status as 'ENABLED' | 'PAUSED' | 'REMOVED') || 'ENABLED',
        campaignStatus:
          (ag.campaign_status as 'ENABLED' | 'PAUSED' | 'REMOVED') || 'ENABLED',
      }));
      this.stateService.setAssetGroups(formattedGroups);
    } catch (err) {
      console.warn('Failed to load asset groups in protected assets:', err);
      this.stateService.setAssetGroups([]);
    } finally {
      this.isLoadingAssetGroups.set(false);
    }
  }

  async reloadCampaignAssets(customerId: string): Promise<void> {
    this.isLoadingAssets.set(true);
    try {
      const res = await this.apiService.fetchCampaignAssets(customerId);
      const assetsList: CampaignAsset[] = (res?.assets || []).map((a) => {
        let score: 'Low' | 'Good' | 'Best' | 'Pending' = 'Pending';
        if (a.performance_score === 'Best') score = 'Best';
        else if (a.performance_score === 'Good') score = 'Good';
        else if (a.performance_score === 'Low') score = 'Low';

        return {
          id: a.id,
          name: a.name,
          url: a.url,
          performanceScore: score,
          kpiValue: a.kpi_value || 0,
          isProtected: a.is_protected,
          uploadDate: a.upload_date,
        };
      });
      this.liveAssets.set(assetsList);
    } catch (err) {
      console.warn('Failed to load assets in protected assets:', err);
      this.liveAssets.set([]);
    } finally {
      this.isLoadingAssets.set(false);
    }
  }

  async onAccountChange(acc: AccountItem): Promise<void> {
    this.selectedAccount.set(acc);
    this.isAccountDropdownOpen.set(false);
    this.accountSearchQuery.set('');
    await Promise.all([
      this.reloadAssetGroups(acc.id),
      this.reloadCampaignAssets(acc.id),
    ]);
  }

  async toggleAssetProtection(assetId: string): Promise<void> {
    const account = this.selectedAccount();
    if (!account) return;

    const asset = this.liveAssets().find((a) => a.id === assetId);
    if (!asset) return;

    const targetProtection = !asset.isProtected;

    // 1. Optimistic UI update
    this.liveAssets.update((prev) =>
      prev.map((a) => {
        if (a.id === assetId) {
          return {...a, isProtected: targetProtection};
        }
        return a;
      }),
    );
    this.stateService.toggleAssetProtection(assetId, targetProtection);

    // 2. Persist to backend json registry
    try {
      await this.apiService.toggleAssetProtection(
        assetId,
        targetProtection,
        account.id,
      );
    } catch (err) {
      console.warn('Failed to persist protection state:', err);
      // Revert on error
      this.liveAssets.update((prev) =>
        prev.map((a) => {
          if (a.id === assetId) {
            return {...a, isProtected: !targetProtection};
          }
          return a;
        }),
      );
      this.stateService.toggleAssetProtection(assetId, !targetProtection);
    }
  }

  // Filtered accounts based on search query inside dropdown
  readonly filteredAccountsForDropdown = computed(() => {
    const query = this.accountSearchQuery().toLowerCase().trim();
    const accounts = this.accessibleAccounts();
    if (!query) return accounts;
    return accounts.filter(
      (acc) =>
        acc.id.includes(query) ||
        (acc.name && acc.name.toLowerCase().includes(query)) ||
        (acc.descriptive_name &&
          acc.descriptive_name.toLowerCase().includes(query)),
    );
  });

  // Compute all unique assets across all groups in the account
  readonly allAssets = computed(() => {
    return this.liveAssets();
  });

  readonly totalCount = computed(() => this.allAssets().length);
  readonly protectedCount = computed(
    () => this.allAssets().filter((a) => a.isProtected).length,
  );
  readonly unprotectedCount = computed(
    () => this.allAssets().filter((a) => !a.isProtected).length,
  );

  readonly searchQuery = signal<string>('');
  readonly activeFilter = signal<'all' | 'protected' | 'unprotected'>('all');

  readonly filteredAssets = computed(() => {
    let assets = this.allAssets();

    // Filter by selected button pill
    const filter = this.activeFilter();
    if (filter === 'protected') {
      assets = assets.filter((a) => a.isProtected);
    } else if (filter === 'unprotected') {
      assets = assets.filter((a) => !a.isProtected);
    }

    // Filter by search query
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return assets;
    return assets.filter(
      (a) =>
        a.id.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query),
    );
  });
}
