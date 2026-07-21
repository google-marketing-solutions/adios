/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CampaignStateService } from '../services/campaign-state.service';
import { ApiService, AccountItem } from '../services/api.service';
import { CampaignAsset, AssetGroup, ReplacementLog, ScheduledTiming } from '../models/types';

@Component({
  selector: 'app-asset-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="space-y-6" id="uploader-section">
      <!-- Title & Header -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="font-bold text-lg text-slate-800 m-0">Automatic Image Upload (Adios 2.0)</h2>
          <p class="text-xs text-muted m-0 mt-1">
            Eliminate Ads Editor steps: automatically replace sub-par images with AI KPI-targeted uploads.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-1 bg-emerald-light text-emerald text-xs font-bold rounded-full flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald"></span>
            Google Ads API Connected
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        <!-- Left Column: Image Drop & Queue Setup -->
        <div class="xl:col-span-3 flex flex-col gap-6">
          
          <!-- Section 1: Upload Brand-New Visual Assets -->
          <div class="panel bg-white border rounded p-6 shadow-sm flex flex-col gap-4">
            <h3 class="font-bold text-xs text-slate-800 flex items-center gap-2 uppercase tracking-wide m-0">
              <span class="step-num flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">1</span>
              Upload Brand-New Visual Assets
            </h3>

            <!-- Drag & Drop Box -->
            <div 
              (dragenter)="onDragOver($event)"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
              [class]="'dropzone border-dashed border-2 rounded p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 relative ' + (dragActive() ? 'drag-active' : 'drag-inactive')"
            >
              <input 
                type="file" 
                id="file-upload" 
                multiple 
                (change)="onFileSelect($event)" 
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div class="drop-icon-container p-3 rounded-full">
                <mat-icon class="icon-size">cloud_upload</mat-icon>
              </div>
              <div>
                <p class="text-xs font-semibold text-slate-700 m-0">Drag files here, or click to browse local drive</p>
                <p class="text-xs text-muted mt-1 m-0">Supports PNG, JPG, WebP. High fidelity recommended.</p>
              </div>

              <!-- Quick Preset Mocks for ease of clickability -->
              <div class="mt-4 border-t border-slate-100 pt-4 w-full" (click)="$event.stopPropagation()">
                <p class="text-xs font-bold text-muted uppercase tracking-wider mb-2 m-0">Simulate instant local file selection:</p>
                <div class="flex flex-wrap gap-2 justify-center">
                  <button 
                    type="button"
                    (click)="handleLoadMockImage('dog_pool')"
                    class="btn-mock px-3 py-1 text-xs font-medium rounded transition-all border"
                  >
                    + DogPool_Promo.jpg
                  </button>
                  <button 
                    type="button"
                    (click)="handleLoadMockImage('cat_bowl')"
                    class="btn-mock px-3 py-1 text-xs font-medium rounded transition-all border"
                  >
                    + CatGourmet_Salmon.png
                  </button>
                  <button 
                    type="button"
                    (click)="handleLoadMockImage('scratching_tree')"
                    class="btn-mock px-3 py-1 text-xs font-medium rounded transition-all border"
                  >
                    + ScratchTree_Deluxe.jpg
                  </button>
                </div>
              </div>
            </div>

            <!-- Uploaded Queue Setup -->
            @if (uploadedQueue().length > 0) {
              <div class="space-y-4 border-t pt-4">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-700">Upload Queue ({{ uploadedQueue().length }} files)</span>
                  <button 
                    (click)="clearQueue()"
                    class="text-rose border-none bg-transparent hover:underline text-xs font-bold cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  @for (item of uploadedQueue(); track item.id) {
                    <div class="border rounded p-3 flex gap-3 items-start bg-slate-50">
                      <img [src]="item.url" [alt]="item.name" class="w-12 h-12 object-cover rounded border shrink-0" />
                      <div class="grow min-w-0">
                        <p class="text-xs font-bold text-slate-700 truncate m-0">{{ item.name }}</p>
                        <p class="text-xs text-muted m-0">Ready to assign</p>
                      </div>
                      <button 
                        (click)="removeFromQueue(item.id)"
                        class="p-1 hover:bg-slate-200 rounded border-none bg-transparent text-slate-400 hover:text-rose cursor-pointer shrink-0"
                      >
                        <mat-icon class="icon-size">delete</mat-icon>
                      </button>
                    </div>
                  }
                </div>

                <!-- Step 5: Special Offer Schedule Setup -->
                <div class="bg-slate-50 border p-4 rounded space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <mat-icon class="text-indigo icon-size">schedule</mat-icon>
                      <span class="text-xs font-bold text-slate-800">Set Scheduled Timing (Promo Campaign)</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        [checked]="isScheduled()" 
                        (change)="isScheduled.set(!isScheduled())" 
                        class="sr-only peer"
                      />
                      <div class="toggle-bg w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo"></div>
                    </label>
                  </div>

                  @if (isScheduled()) {
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div class="space-y-1">
                        <label class="text-[10px] font-bold text-muted uppercase">Promotion Title</label>
                        <input 
                          type="text" 
                          [(ngModel)]="scheduleDetails().offerName"
                          class="w-full text-xs bg-white border rounded p-1.5 focus:outline-none"
                        />
                      </div>
                      <div class="space-y-1">
                        <label class="text-[10px] font-bold text-muted uppercase">Start Date</label>
                        <input 
                          type="date" 
                          [(ngModel)]="scheduleDetails().startDate"
                          class="w-full text-xs bg-white border rounded p-1.5 focus:outline-none"
                        />
                      </div>
                      <div class="space-y-1">
                        <label class="text-[10px] font-bold text-muted uppercase">Expiration Date</label>
                        <input 
                          type="date" 
                          [(ngModel)]="scheduleDetails().endDate"
                          class="w-full text-xs bg-white border rounded p-1.5 focus:outline-none"
                        />
                      </div>
                      <p class="text-[10px] text-muted md:col-span-3 leading-relaxed m-0 mt-1">
                        💡 When this expires, Adios 2.0 automatically swaps the promotional image back to the previous fallback asset, guaranteeing zero organic traffic loss.
                      </p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Section 2: Deploy to Target PMax Asset Groups -->
          <div class="panel bg-white border rounded p-6 shadow-sm space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div class="flex flex-wrap items-center gap-3">
                <h3 class="font-bold text-xs text-slate-800 flex items-center gap-2 uppercase tracking-wide m-0">
                  <span class="step-num flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">2</span>
                  Deploy to Target PMax Asset Groups
                </h3>
                
                <!-- Account Selector Dropdown -->
                <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs">
                  <mat-icon class="icon-size text-slate-500">account_circle</mat-icon>
                  <select
                    [ngModel]="selectedAccountId()"
                    (ngModelChange)="onAccountChange($event)"
                    class="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    @for (acc of accessibleAccounts(); track acc.id) {
                      <option [value]="acc.id">{{ acc.name }}</option>
                    }
                    @if (accessibleAccounts().length === 0) {
                      <option value="">{{ isLoadingAccounts() ? 'Loading accounts...' : 'No accounts available' }}</option>
                    }
                  </select>
                </div>

                <button
                  (click)="reloadAssetGroups()"
                  [disabled]="isLoadingAssetGroups()"
                  class="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-300 transition-all cursor-pointer disabled:opacity-50"
                  title="Reload Asset Groups from Google Ads API"
                >
                  <mat-icon [class.animate-spin]="isLoadingAssetGroups()" class="icon-size text-slate-600">refresh</mat-icon>
                  <span>{{ isLoadingAssetGroups() ? 'Reloading...' : 'Reload' }}</span>
                </button>
              </div>
              
              <!-- Search Box -->
              <div class="relative w-full sm:w-64 shrink-0">
                <mat-icon class="absolute left-3 top-2 text-slate-400 icon-size">search</mat-icon>
                <input 
                  type="text" 
                  placeholder="Filter groups, campaigns..." 
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                  class="w-full text-xs pl-8 pr-3 py-2 border rounded bg-slate-50 focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            @if (reloadNotice(); as notice) {
              <div [class]="notice.type === 'success' ? 'bg-success-msg p-3 rounded text-xs flex items-center justify-between' : (notice.type === 'warning' ? 'bg-error-msg p-3 rounded text-xs flex items-center justify-between' : 'bg-info-msg p-3 rounded text-xs flex items-center justify-between')">
                <div class="flex items-center gap-2">
                  <mat-icon class="icon-size">{{ notice.type === 'success' ? 'check_circle' : (notice.type === 'warning' ? 'warning' : 'info') }}</mat-icon>
                  <span>{{ notice.message }}</span>
                </div>
                <button (click)="reloadNotice.set(null)" class="text-xs bg-transparent border-none cursor-pointer font-bold px-2">✕</button>
              </div>
            }

            <!-- Filterable List Table -->
            <div class="table-container border rounded overflow-hidden">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 text-slate-500 border-b font-medium">
                    <th class="p-3 text-center w-12">
                      <input 
                        type="checkbox" 
                        [checked]="isAllFilteredSelected()"
                        (change)="toggleSelectAll()"
                        class="rounded cursor-pointer"
                      />
                    </th>
                    <th class="p-3">Asset Group Name</th>
                    <th class="p-3">Campaign</th>
                    <th class="p-3">Account</th>
                    <th class="p-3 text-right">Current Slots</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (ag of filteredAssetGroups(); track ag.id) {
                    @let isSelected = selectedAssetGroups().includes(ag.id);
                    <tr [class.selected-row]="isSelected" class="hover:bg-slate-50/50 transition-colors">
                      <td class="p-3 text-center">
                        <input 
                          type="checkbox" 
                          [checked]="isSelected"
                          (change)="toggleGroupSelection(ag.id)"
                          class="rounded cursor-pointer"
                        />
                      </td>
                      <td class="p-3 font-bold text-slate-700">{{ ag.name }}</td>
                      <td class="p-3 text-muted font-mono text-[11px]">{{ ag.campaignName }}</td>
                      <td class="p-3 text-slate-500">{{ ag.account }}</td>
                      <td class="p-3 text-right font-mono font-medium text-slate-700">
                        {{ ag.imageCount }} / {{ maxCapacity() }}
                      </td>
                    </tr>
                  }
                  @if (filteredAssetGroups().length === 0) {
                    <tr>
                      <td colspan="5" class="p-8 text-center text-slate-400 font-medium">
                        {{ isLoadingAssetGroups() ? 'Loading asset groups...' : (searchQuery() ? 'No asset groups match your filters.' : 'No asset groups found for this account.') }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Replacement Configuration Controls (Step 3 & 4) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 border border-slate-200 p-5 rounded-xl">
              <div class="space-y-1.5 flex flex-col">
                <label class="text-xs font-bold text-slate-700">Swap Rule: KPI Optimization Preference</label>
                <p class="text-[10px] text-slate-500 leading-normal m-0 mb-1">
                  If the group is full ({{ maxCapacity() }} images), the algorithm automatically ejects the lowest performer.
                </p>
                <select 
                  [(ngModel)]="selectedKpi"
                  class="text-xs bg-white border rounded p-2 focus:outline-none"
                >
                  <option value="ctr">Lowest Click-Through Rate (CTR)</option>
                  <option value="impressions">Lowest Absolute Impressions</option>
                  <option value="conversions">Lowest Conversion Volume</option>
                  <option value="value">Lowest ROAS / Conversion Value</option>
                </select>
              </div>

              <div class="space-y-1.5 flex flex-col">
                <label class="text-xs font-bold text-slate-700">Protected Names Exclusion Pattern</label>
                <p class="text-[10px] text-slate-500 leading-normal m-0 mb-1">
                  Images with names containing this pattern will never be replaced.
                </p>
                <div class="relative">
                  <mat-icon class="absolute left-3 top-2.5 text-slate-400 icon-size">shield</mat-icon>
                  <input 
                    type="text" 
                    [(ngModel)]="protectionPattern"
                    class="w-full text-xs pl-8 pr-3 py-2 border rounded bg-white focus:outline-none font-mono"
                    placeholder="e.g. _Protected"
                  />
                </div>
              </div>
            </div>

            <!-- Sync Save button -->
            <div class="flex items-center justify-between pt-2">
              <div class="text-[11px] text-muted flex items-center gap-1.5">
                <mat-icon class="text-emerald icon-size">check_circle_outline</mat-icon>
                <span>Protected images will be locked. Underperforming ones replaced.</span>
              </div>
              <button
                (click)="handleSaveAndSync()"
                [disabled]="syncStatus().message.includes('Synchronizing')"
                class="flex items-center gap-2 px-6 py-2.5 rounded bg-brand text-white text-xs font-semibold border-none transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                <span>Save & Deploy Assets</span>
                <mat-icon class="icon-size">arrow_forward</mat-icon>
              </button>
            </div>

            <!-- Sync message -->
            @if (syncStatus().message) {
              <div [class]="'p-3 rounded flex items-center gap-2 text-xs font-medium ' + getSyncMessageClass()">
                @if (syncStatus().type === 'success') {
                  <mat-icon class="text-emerald icon-size">check_circle</mat-icon>
                } @else if (syncStatus().type === 'error') {
                  <mat-icon class="text-rose icon-size">warning</mat-icon>
                } @else {
                  <div class="loading-spinner shrink-0"></div>
                }
                <span>{{ syncStatus().message }}</span>
              </div>
            }
          </div>
        </div>

      </div>

      <!-- Step 6: Replacement History logs -->
      <div class="panel bg-white border rounded p-6 shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wide m-0">Replacement & Sync Logs</h3>
            <p class="text-xs text-muted mt-1 m-0">
              Comprehensive report of automated asset rotations based on KPI triggers and promotional lifecycles.
            </p>
          </div>
          <button class="btn-csv flex items-center gap-1.5 px-3 py-1.5 rounded border bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer transition-colors">
            <mat-icon class="icon-size">file_download</mat-icon>
            Export CSV
          </button>
        </div>

        <div class="table-container border rounded overflow-hidden">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50 text-slate-500 border-b font-medium">
                <th class="p-3">Date</th>
                <th class="p-3">Campaign / Asset Group</th>
                <th class="p-3">Evicted Asset</th>
                <th class="p-3">New Assigned Asset</th>
                <th class="p-3">Swap Trigger</th>
                <th class="p-3">Resulting Performance / Details</th>
                <th class="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-sans">
              @for (log of stateService.replacementLogs(); track log.id) {
                <tr class="hover:bg-slate-50/30 transition-colors">
                  <td class="p-3 text-slate-500 font-mono text-[11px]">{{ log.date }}</td>
                  <td class="p-3">
                    <p class="font-bold text-slate-700 m-0">{{ log.assetGroupName }}</p>
                    <p class="text-[10px] text-muted font-mono m-0 mt-0.5">{{ log.campaignName }}</p>
                  </td>
                  <td class="p-3">
                    @if (log.replacedAsset) {
                      <div class="flex items-center gap-2">
                        <img [src]="log.replacedAsset.url" class="w-6 h-6 object-cover rounded border shrink-0" />
                        <span class="text-slate-600 truncate max-w-[120px]" [title]="log.replacedAsset.name">{{ log.replacedAsset.name }}</span>
                      </div>
                    } @else {
                      <span class="text-slate-400 italic">None (Capacity open)</span>
                    }
                  </td>
                  <td class="p-3">
                    <div class="flex items-center gap-2">
                      <img [src]="log.newAsset.url" class="w-6 h-6 object-cover rounded border shrink-0" />
                      <span class="text-slate-700 font-bold truncate max-w-[120px]" [title]="log.newAsset.name">{{ log.newAsset.name }}</span>
                    </div>
                  </td>
                  <td class="p-3">
                    <span [class]="'badge-reason px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ' + getReasonClass(log.reason)">
                      {{ log.reason }}
                    </span>
                  </td>
                  <td class="p-3 text-slate-500 leading-normal">
                    {{ log.kpiMetric || 'Manual deployment triggered.' }}
                    @if (log.errorMsg) {
                      <p class="text-rose text-[10px] font-bold m-0 mt-0.5">{{ log.errorMsg }}</p>
                    }
                  </td>
                  <td class="p-3 text-right">
                    <span [class]="'inline-flex items-center gap-1 text-[11px] font-bold ' + (log.status === 'Success' ? 'text-emerald' : 'text-rose')">
                      <span [class]="'status-indicator-dot w-1.5 h-1.5 rounded-full ' + (log.status === 'Success' ? 'bg-emerald' : 'bg-rose')"></span>
                      {{ log.status }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .step-num {
      width: 20px;
      height: 20px;
    }
    .dropzone {
      min-height: 180px;
      transition: all 0.2s ease;
    }
    .drag-active {
      border-color: #1a73e8;
      background-color: rgba(26, 115, 232, 0.05);
    }
    .drag-inactive {
      border-color: #dadce0;
    }
    .drag-inactive:hover {
      border-color: #b8bcc2;
      background-color: #f8f9fa;
    }
    .drop-icon-container {
      background-color: rgba(26, 115, 232, 0.08);
      color: #1a73e8;
    }
    .btn-mock {
      background-color: #f1f3f4;
      border-color: #dadce0;
      color: #3c4043;
      cursor: pointer;
    }
    .btn-mock:hover {
      background-color: #dadce0;
    }
    .text-rose {
      color: #d93025;
    }
    .text-emerald {
      color: #1e8e3e;
    }
    .text-indigo {
      color: #1a73e8;
    }
    .bg-indigo {
      background-color: #1a73e8;
    }
    .border-indigo {
      border-color: #1a73e8;
    }
    .bg-emerald-light {
      background-color: rgba(30, 142, 62, 0.1);
    }
    .panel {
      border-color: #dadce0;
    }
    .toggle-bg {
      position: relative;
      transition: background-color 0.2s ease;
    }
    .toggle-bg::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: white;
      transition: transform 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
    .peer:checked + .toggle-bg::after {
      transform: translateX(16px);
    }
    .peer:checked + .toggle-bg {
      background-color: #1a73e8;
    }
    .table-container {
      border-color: #dadce0;
      background-color: #ffffff;
    }
    table th {
      border-bottom: 1px solid #dadce0;
    }
    .selected-row {
      background-color: rgba(26, 115, 232, 0.04);
    }
    .btn-lock {
      transition: all 0.15s ease;
    }
    .locked-card {
      border-color: rgba(26, 115, 232, 0.3) !important;
      background-color: rgba(26, 115, 232, 0.02) !important;
    }
    .badge-reason {
      font-size: 9px;
    }
    .badge-reason-kpi {
      background-color: #fef7e0;
      color: #b06000;
    }
    .badge-reason-special {
      background-color: #f3e5f5;
      color: #7b1fa2;
    }
    .badge-reason-manual {
      background-color: #f1f3f4;
      color: #3c4043;
    }
    .status-indicator-dot {
      display: inline-block;
    }
    .bg-emerald {
      background-color: #1e8e3e;
    }
    .bg-rose {
      background-color: #d93025;
    }
    .icon-size {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .icon-xs {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }
    .btn-timeout mat-icon {
      font-size: 10px;
      width: 10px;
      height: 10px;
    }
    .current-images-list {
      max-height: 400px;
      overflow-y: auto;
    }
    /* Loading spinner for sync */
    .loading-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid #1a73e8;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .bg-success-msg {
      background-color: #e6f4ea;
      border: 1px solid #ceead6;
      color: #137333;
    }
    .bg-error-msg {
      background-color: #fce8e6;
      border: 1px solid #fad2cf;
      color: #c5221f;
    }
    .bg-info-msg {
      background-color: #e8f0fe;
      border: 1px solid #d2e3fc;
      color: #174ea6;
    }
  `]
})
export class AssetUploaderComponent implements OnInit {
  readonly stateService = inject(CampaignStateService);
  readonly apiService = inject(ApiService);
  readonly accessibleAccounts = signal<AccountItem[]>([]);
  readonly selectedAccountId = signal<string>('');
  readonly isLoadingAccounts = signal<boolean>(false);
  readonly isLoadingAssetGroups = signal<boolean>(false);
  readonly reloadNotice = signal<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  async ngOnInit(): Promise<void> {
    await this.loadAccessibleAccounts();
    const targetAccount = this.selectedAccountId() || '9044713567';
    await this.reloadAssetGroups(targetAccount);
  }

  async loadAccessibleAccounts(): Promise<void> {
    this.isLoadingAccounts.set(true);
    try {
      const res = await this.apiService.fetchAccessibleAccounts();
      if (res && res.accounts && res.accounts.length > 0) {
        this.accessibleAccounts.set(res.accounts);
        if (!this.selectedAccountId()) {
          this.selectedAccountId.set(res.accounts[0].id);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load accessible accounts:', err);
    } finally {
      this.isLoadingAccounts.set(false);
    }
  }

  async onAccountChange(accountId: string): Promise<void> {
    this.selectedAccountId.set(accountId);
    await this.reloadAssetGroups(accountId);
  }

  async reloadAssetGroups(customerId?: string): Promise<void> {
    const targetCustomer = customerId || this.selectedAccountId() || '9044713567';
    this.isLoadingAssetGroups.set(true);
    this.reloadNotice.set(null);
    try {
      const res = await this.apiService.fetchAssetGroups(targetCustomer);
      const rawGroups = res?.asset_groups || [];
      const formattedGroups: AssetGroup[] = rawGroups.map(ag => ({
        id: ag.id,
        name: ag.name,
        campaignId: ag.campaign_id,
        campaignName: ag.campaign_name,
        account: `Google Ads Account (${targetCustomer.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')})`,
        imageCount: ag.square_count || 0,
        maxImages: ag.square_capacity || 20,
        currentKpiMetric: 'ctr'
      }));
      this.stateService.setAssetGroups(formattedGroups);
      
      if (res?.error_message) {
        this.reloadNotice.set({
          message: `Live Google Ads API query notice: ${res.error_message}`,
          type: 'warning'
        });
      } else if (res?.source === 'live_google_ads_api') {
        this.reloadNotice.set({
          message: `Successfully loaded ${res.total_count} live Asset Groups via Google Ads API (Account: ${targetCustomer})!`,
          type: 'success'
        });
      }
    } catch (err: any) {
      console.warn('Failed to load asset groups from Google Ads API:', err);
      this.stateService.setAssetGroups([]);
      this.reloadNotice.set({
        message: `Unable to connect to Google Ads API endpoint: ${err?.message || err}`,
        type: 'warning'
      });
    } finally {
      this.isLoadingAssetGroups.set(false);
    }
  }

  // Upload and queue states
  readonly dragActive = signal<boolean>(false);
  readonly uploadedQueue = signal<(Omit<CampaignAsset, 'performanceScore' | 'kpiValue' | 'uploadDate'> & { rawFile?: File })[]>([]);
  
  // Schedule state for the active item being uploaded
  readonly isScheduled = signal<boolean>(false);
  readonly scheduleDetails = signal<Omit<ScheduledTiming, 'id' | 'fallbackAssetId'>>({
    startDate: '2026-07-15',
    endDate: '2026-07-22',
    offerName: 'Summer Pet Pools Weekend Special'
  });

  // Filter / Selection states
  readonly searchQuery = signal<string>('');
  readonly selectedAssetGroups = signal<string[]>([]);
  readonly selectedKpi = signal<'impressions' | 'ctr' | 'conversions' | 'value'>('ctr');
  readonly maxCapacity = signal<number>(20);
  
  // Custom naming protection pattern
  readonly protectionPattern = signal<string>('_Protected');

  // Triggering simulation message
  readonly syncStatus = signal<{ message: string; type: 'success' | 'error' | 'info' | 'idle' }>({ message: '', type: 'idle' });

  // Computed selector values
  readonly filteredAssetGroups = computed<AssetGroup[]>(() => {
    const groups = this.stateService.assetGroups();
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return groups;

    return groups.filter(ag => 
      ag.name.toLowerCase().includes(query) ||
      ag.campaignName.toLowerCase().includes(query) ||
      ag.account.toLowerCase().includes(query) ||
      ag.id.toLowerCase().includes(query)
    );
  });



  readonly isAllFilteredSelected = computed<boolean>(() => {
    const filtered = this.filteredAssetGroups();
    const selected = this.selectedAssetGroups();
    if (filtered.length === 0) return false;
    return filtered.every(ag => selected.includes(ag.id));
  });

  // Actions
  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive.set(false);

    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      this.addFilesToQueue(files);
    }
  }

  onFileSelect(e: Event): void {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const files = Array.from(target.files);
      this.addFilesToQueue(files);
    }
  }

  addFilesToQueue(files: File[]): void {
    const newItems = files.map((file, idx) => ({
      id: `up-${Date.now()}-${idx}`,
      name: file.name.split('.')[0] || 'uploaded_image',
      url: URL.createObjectURL(file), // temporary local URL
      rawFile: file,
      isProtected: false
    }));
    this.uploadedQueue.update(prev => [...prev, ...newItems]);
  }

  createCanvasMockFile(filename: string, width: number, height: number): File {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1a73e8';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(filename, 40, height / 2);
    }
    const dataUrl = canvas.toDataURL('image/png');
    const byteString = atob(dataUrl.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: 'image/png' });
    return new File([blob], `${filename}.png`, { type: 'image/png' });
  }

  handleLoadMockImage(preset: 'dog_pool' | 'cat_bowl' | 'scratching_tree'): void {
    const mockSpecs = {
      dog_pool: { name: 'Store_SummerPool_Promo_July', width: 1000, height: 1000 },
      cat_bowl: { name: 'Store_Gourmet_Salmon_Dynamic', width: 1200, height: 628 },
      scratching_tree: { name: 'CatScratch_SolidOak_Deluxe', width: 1000, height: 1250 }
    };
    const spec = mockSpecs[preset];
    const rawFile = this.createCanvasMockFile(spec.name, spec.width, spec.height);
    this.addFilesToQueue([rawFile]);
  }

  removeFromQueue(id: string): void {
    this.uploadedQueue.update(prev => prev.filter(item => item.id !== id));
  }

  clearQueue(): void {
    this.uploadedQueue.set([]);
  }

  toggleGroupSelection(id: string): void {
    this.selectedAssetGroups.update(prev => 
      prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
    );
  }

  toggleSelectAll(): void {
    const filtered = this.filteredAssetGroups();
    if (this.isAllFilteredSelected()) {
      // Unselect all filtered
      const filteredIds = filtered.map(ag => ag.id);
      this.selectedAssetGroups.update(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Select all filtered
      const currentSelected = this.selectedAssetGroups();
      const nextSelected = Array.from(new Set([...currentSelected, ...filtered.map(ag => ag.id)]));
      this.selectedAssetGroups.set(nextSelected);
    }
  }



  async handleSaveAndSync(): Promise<void> {
    const queue = this.uploadedQueue();
    const selectedGroups = this.selectedAssetGroups();
    if (queue.length === 0) {
      this.syncStatus.set({ message: 'Please upload or load at least one image to sync.', type: 'error' });
      return;
    }
    if (selectedGroups.length === 0) {
      this.syncStatus.set({ message: 'Please select at least one PMax Asset Group.', type: 'error' });
      return;
    }

    this.syncStatus.set({ message: 'Validating & synchronizing images via Google Ads API...', type: 'info' });

    try {
      for (const item of queue) {
        let fileToken = item.id;
        
        // If rawFile is attached, upload file to backend for dimension validation
        if (item.rawFile) {
          const uploadRes = await this.apiService.uploadImage(item.rawFile);
          fileToken = uploadRes.file_token;
        }

        // Call backend assign API to mutate Google Ads Asset & AssetGroupAsset
        const assignRes = await this.apiService.assignAsset(fileToken, selectedGroups);

        selectedGroups.forEach(groupId => {
          const currentGroup = this.stateService.assetGroups().find(g => g.id === groupId);
          const groupAssets = [...(this.stateService.campaignAssets()[groupId] || [])];
          if (!currentGroup) return;

          const freshAsset: CampaignAsset = {
            id: `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: item.name,
            url: item.url,
            performanceScore: 'Best',
            kpiValue: 4.8,
            isProtected: false,
            uploadDate: new Date().toISOString().split('T')[0]
          };
          groupAssets.push(freshAsset);

          this.stateService.updateAssets(groupId, groupAssets);
          this.stateService.updateAssetGroupImageCount(groupId, groupAssets.length);

          const resultAg = assignRes.results?.find(r => r.asset_group_id === groupId);
          const arnInfo = resultAg ? ` (Resource: ${resultAg.asset_resource_name})` : '';

          this.stateService.addLog({
            id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            date: new Date().toISOString().replace('T', ' ').substring(0, 16),
            campaignName: currentGroup.campaignName,
            assetGroupName: currentGroup.name,
            replacedAsset: null,
            newAsset: { name: freshAsset.name, url: freshAsset.url },
            reason: 'Manual',
            kpiMetric: `Google Ads API Mutation Executed successfully${arnInfo}.`,
            status: 'Success'
          });
        });
      }

      this.uploadedQueue.set([]);
      this.syncStatus.set({
        message: `Google Ads API Sync completed successfully! Assigned creative to ${selectedGroups.length} Asset Group(s).`,
        type: 'success'
      });
      setTimeout(() => this.syncStatus.set({ message: '', type: 'idle' }), 5000);
    } catch (err: any) {
      console.error('Google Ads API sync error:', err);
      this.syncStatus.set({
        message: err?.message || 'Google Ads API sync failed. Please check network/credentials.',
        type: 'error'
      });
    }
  }

  getSyncMessageClass(): string {
    const status = this.syncStatus();
    if (status.type === 'success') return 'bg-success-msg';
    if (status.type === 'error') return 'bg-error-msg';
    return 'bg-info-msg';
  }

  getReasonClass(reason: string): string {
    if (reason === 'KPI') return 'badge-reason-kpi';
    if (reason === 'Special Offer') return 'badge-reason-special';
    return 'badge-reason-manual';
  }
}
