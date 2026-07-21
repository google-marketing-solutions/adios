/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CampaignStateService } from '../services/campaign-state.service';
import { CampaignAsset, AssetGroup } from '../models/types';
import { ApiService, AccountItem } from '../services/api.service';
import { mockAssetGroups } from '../models/mock-data';

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
                  <div class="px-4 py-4 text-xs text-slate-400 text-center">No accounts found</div>
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
            <!-- Premium Empty state -->
            <div class="empty-state text-center py-16 px-6 flex flex-col items-center justify-center gap-4 bg-slate-50/20">
              <div class="p-4 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
                <mat-icon class="icon-size-large">search_off</mat-icon>
              </div>
              <div>
                <h4 class="font-bold text-sm text-slate-800 m-0">No matching assets found</h4>
                <p class="text-xs text-muted mt-1 leading-normal m-0 max-w-sm">
                  We couldn't find any assets matching "<strong class="text-slate-700">{{ searchQuery() }}</strong>". Try searching for a different name or ID, or clear the search.
                </p>
              </div>
              <button
                (click)="searchQuery.set('')"
                class="btn-clear-search px-4 py-2 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer transition-all duration-150"
              >
                Clear Search Query
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .protection-container {
      font-family: 'Roboto', sans-serif;
    }
    .header-banner {
      border-color: #dadce0;
    }
    .icon-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 !important;
      border-radius: 12px !important;
      aspect-ratio: 1 / 1;
    }
    .bg-indigo-light {
      background-color: rgba(79, 70, 229, 0.08);
    }
    .text-indigo {
      color: #4f46e5;
    }
    .border-indigo-200 {
      border-color: rgba(79, 70, 229, 0.15);
    }
    .icon-size {
      font-size: 38px;
      width: 38px;
      height: 38px;
    }
    .icon-size-small {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .icon-size-large {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .stat-card {
      border-color: #dadce0;
    }
    .panel {
      border-color: #dadce0;
    }
    .search-bar {
      border-color: #f1f3f4;
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #5f6368;
      pointer-events: none;
      z-index: 10;
    }
    .search-input {
      border: 1px solid #dadce0;
      border-radius: 12px;
      padding: 10px 16px 10px 40px !important;
      font-size: 12px;
      font-weight: 500;
      width: 100%;
      background-color: #ffffff;
      color: #202124;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .search-input:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.1);
    }
    .bg-emerald-light {
      background-color: rgba(30, 142, 62, 0.08);
    }
    .text-emerald {
      color: #1e8e3e;
    }
    .bg-rose-50 {
      background-color: rgba(217, 48, 37, 0.06);
    }
    .text-rose {
      color: #d93025;
    }
    .bg-indigo {
      background-color: #4f46e5;
    }
    .border-indigo {
      border-color: #4f46e5;
    }
    .btn-protect {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px !important;
      border-radius: 8px !important;
      font-size: 11px;
      font-weight: 700;
      width: 140px;
      text-align: center;
      transition: all 0.2s ease;
    }
    .btn-protect:active {
      transform: scale(0.97);
    }
    .btn-protected-active {
      background-color: #4f46e5 !important;
      border-color: #4f46e5 !important;
      color: #ffffff !important;
    }
    .btn-protected-active:hover {
      background-color: #4338ca !important;
      border-color: #4338ca !important;
    }
    .btn-protected-inactive {
      background-color: #ffffff !important;
      border-color: #dadce0 !important;
      color: #5f6368 !important;
    }
    .btn-protected-inactive:hover {
      background-color: #f8f9fa !important;
      border-color: #c4c7c5 !important;
      color: #202124 !important;
    }
    .preview-wrapper {
      border-color: #dadce0;
    }
    .empty-state {
      border-top: 1px solid #f1f3f4;
    }
    .animate-fade-in {
      animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Dedicated Custom Stats Pills Styling */
    .stat-pill {
      background-color: #ffffff;
      border: 1px solid #dadce0;
      color: #5f6368;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      transition: all 0.15s ease-in-out;
    }
    .stat-pill mat-icon {
      color: inherit;
    }
    .stat-pill:hover {
      background-color: #f8f9fa;
      border-color: #c4c7c5;
    }
    .pill-all-active {
      background-color: #f1f3f4 !important; /* Perfect light grey */
      border-color: #dadce0 !important;
      color: #202124 !important; /* Crisp solid black text color */
    }
    .pill-protected-active {
      background-color: #e8eaf6 !important; /* Soft indigo-light background */
      border-color: #c5cae9 !important;
      color: #3f51b5 !important; /* Premium Indigo text color */
    }
    .pill-unprotected-active {
      background-color: #f5f5f5 !important; /* Soft dark-grey-light background */
      border-color: #e0e0e0 !important;
      color: #212121 !important; /* Crisp charcoal dark grey text color */
    }

    /* Searchable Account Selector Dropdown styles */
    .dropdown-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 16px !important;
      border: 1px solid #dadce0 !important;
      border-radius: 12px !important;
      background-color: #ffffff !important;
      color: #202124 !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      font-family: 'Roboto', 'Google Sans', sans-serif !important;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
    }
    .dropdown-trigger:hover {
      background-color: #f8f9fa !important;
      border-color: #c4c7c5 !important;
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
      font-family: 'Roboto', 'Google Sans', sans-serif !important;
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
  `]
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
          this.reloadCampaignAssets(res.accounts[0].id)
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
      const formattedGroups: AssetGroup[] = rawGroups.map(ag => ({
        id: ag.id,
        name: ag.name,
        campaignId: ag.campaign_id,
        campaignName: ag.campaign_name,
        account: `Google Ads Account (${customerId})`,
        imageCount: ag.square_count || 0,
        maxImages: ag.square_capacity || 20,
        currentKpiMetric: 'ctr'
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
      const assetsList: CampaignAsset[] = (res?.assets || []).map(a => {
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
          uploadDate: a.upload_date
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
      this.reloadCampaignAssets(acc.id)
    ]);
  }

  async toggleAssetProtection(assetId: string): Promise<void> {
    const asset = this.liveAssets().find(a => a.id === assetId);
    if (!asset) return;

    const targetProtection = !asset.isProtected;

    // 1. Optimistic UI update
    this.liveAssets.update(prev => prev.map(a => {
      if (a.id === assetId) {
        return { ...a, isProtected: targetProtection };
      }
      return a;
    }));
    this.stateService.toggleAssetProtection(assetId);

    // 2. Persist to backend json registry
    try {
      await this.apiService.toggleAssetProtection(assetId, targetProtection);
    } catch (err) {
      console.warn('Failed to persist protection state:', err);
      // Revert on error
      this.liveAssets.update(prev => prev.map(a => {
        if (a.id === assetId) {
          return { ...a, isProtected: !targetProtection };
        }
        return a;
      }));
      this.stateService.toggleAssetProtection(assetId);
    }
  }

  // Filtered accounts based on search query inside dropdown
  readonly filteredAccountsForDropdown = computed(() => {
    const query = this.accountSearchQuery().toLowerCase().trim();
    const accounts = this.accessibleAccounts();
    if (!query) return accounts;
    return accounts.filter(acc => 
      acc.id.includes(query) || 
      (acc.name && acc.name.toLowerCase().includes(query)) ||
      (acc.descriptive_name && acc.descriptive_name.toLowerCase().includes(query))
    );
  });

  // Compute all unique assets across all groups in the account
  readonly allAssets = computed(() => {
    return this.liveAssets();
  });

  readonly totalCount = computed(() => this.allAssets().length);
  readonly protectedCount = computed(() => this.allAssets().filter(a => a.isProtected).length);
  readonly unprotectedCount = computed(() => this.allAssets().filter(a => !a.isProtected).length);

  readonly searchQuery = signal<string>('');
  readonly activeFilter = signal<'all' | 'protected' | 'unprotected'>('all');

  readonly filteredAssets = computed(() => {
    let assets = this.allAssets();

    // Filter by selected button pill
    const filter = this.activeFilter();
    if (filter === 'protected') {
      assets = assets.filter(a => a.isProtected);
    } else if (filter === 'unprotected') {
      assets = assets.filter(a => !a.isProtected);
    }

    // Filter by search query
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return assets;
    return assets.filter(a => 
      a.id.toLowerCase().includes(query) || 
      a.name.toLowerCase().includes(query)
    );
  });
}
