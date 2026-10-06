/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {CommonModule} from '@angular/common';
import {
  Component,
  computed,
  inject,
  Input,
  OnInit,
  signal,
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {
  AssetGroup,
  CampaignAsset,
  ReplacementLog,
  ScheduledTiming,
} from '../models/types';
import {
  AccountItem,
  ApiService,
  AssignResponse,
  SwapRules,
} from '../services/api.service';
import {CampaignStateService} from '../services/campaign-state.service';

export interface QueueItem {
  id: string;
  name: string;
  url: string;
  rawFile?: File;
  isProtected: boolean;
  isScheduled?: boolean;
  scheduleDetails?: {
    offerName: string;
    endDate: string;
  };
}

@Component({
  selector: 'app-asset-uploader',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="space-y-6" id="uploader-section">
      <!-- Title & Navigation Tabs -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="font-bold text-lg text-slate-800 m-0">
            Automatic Image Upload (Adios 2.0)
          </h2>
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

        <div class="flex flex-col gap-6 w-full">
          
          <!-- Section 1: Upload Visual Assets -->
          <div class="panel bg-white border rounded p-6 shadow-sm flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <h3 class="font-bold text-xs text-slate-800 flex items-center gap-2 uppercase tracking-wide m-0">
                  <span class="step-num flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">1</span>
                  Upload Brand-New Visual Assets
                </h3>
              </div>

              <!-- Format error notice -->
              @if (uploadError()) {
                <div class="bg-error-msg p-3 rounded text-xs flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <mat-icon class="icon-size">warning</mat-icon>
                    <span>{{ uploadError() }}</span>
                  </div>
                  <button (click)="uploadError.set(null)" class="text-xs bg-transparent border-none cursor-pointer font-bold px-2">✕</button>
                </div>
              }

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
                  [attr.accept]="acceptedFileTypes()"
                  (change)="onFileSelect($event)" 
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div class="drop-icon-container p-3 rounded-full">
                  <mat-icon class="icon-size">cloud_upload</mat-icon>
                </div>
                <div>
                  <p class="text-xs font-semibold text-slate-700 m-0">Drag files here, or click to browse local drive</p>
                  <p class="text-xs text-muted mt-1 m-0">
                    Supports {{ stateService.supportedFormats().join(', ') }}. Configured in Solution Settings.
                  </p>
                </div>
              </div>

              <!-- Uploaded Queue Setup -->
              @if (uploadedQueue().length > 0) {
                <div class="space-y-4 border-t pt-4">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-700">Upload Queue ({{ uploadedQueue().length }} files)</span>
                  </div>

                  <!-- Master Schedule Bar for Bulk Apply -->
                  <div class="bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center gap-6">
                    <span class="text-[11px] font-bold text-indigo-900 flex items-center gap-2 shrink-0">
                      <mat-icon class="icon-size text-indigo flex items-center justify-center mt-0.5">schedule</mat-icon>
                      Master Schedule Configurator
                    </span>
                    <div class="flex items-center gap-2 text-xs">
                      <span class="text-xs font-medium text-slate-600 shrink-0 ml-1">End:</span>
                      <input 
                        type="date" 
                        [(ngModel)]="masterSchedule.endDate"
                        class="bg-white border rounded px-2.5 py-1 text-xs w-[140px] focus:outline-none focus:border-indigo"
                      />
                      <button
                        (click)="applyBulkSchedule()"
                        class="px-4 py-1 rounded bg-brand hover:bg-brand-hover text-white text-xs font-semibold border-none cursor-pointer transition-all shrink-0 shadow-xs ml-1"
                      >
                        {{ applyScheduleButtonText() }}
                      </button>
                    </div>
                  </div>

                  <!-- Upload Queue Table -->
                  <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="w-full text-left border-collapse bg-white">
                      <thead>
                        <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th class="p-3 w-12 text-center" title="Schedule">
                            <input 
                              type="checkbox" 
                              [checked]="isAllQueueScheduled()" 
                              (change)="toggleAllQueueSchedule($event)"
                              class="rounded cursor-pointer"
                              title="Toggle Schedule for All"
                            />
                          </th>
                          <th class="p-3 w-20">Image Preview</th>
                          <th class="p-3">Image Name</th>
                          <th class="p-3 w-44">Schedule End</th>
                          <th class="p-3 w-12 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 text-xs">
                        @for (item of uploadedQueue(); track item.id) {
                          <tr [class.bg-indigo-50\/30]="item.isScheduled" class="hover:bg-slate-50\/80 transition-colors">
                            <!-- Checkbox -->
                            <td class="p-3 text-center align-middle">
                              <input 
                                type="checkbox" 
                                [checked]="item.isScheduled" 
                                (change)="toggleItemSchedule(item.id)"
                                class="rounded cursor-pointer"
                                title="Schedule Image"
                              />
                            </td>

                            <!-- Image Preview -->
                            <td class="p-3 align-middle">
                              <img [src]="item.url" [alt]="item.name" class="w-10 h-10 object-cover rounded border shrink-0" />
                            </td>

                            <!-- Image Name -->
                            <td class="p-3 align-middle">
                              <p class="font-bold text-slate-700 m-0">{{ item.name }}</p>
                            </td>

                            <!-- Schedule End -->
                            <td class="p-3 align-middle">
                              <input 
                                type="date" 
                                [ngModel]="getItemEndDate(item)"
                                (ngModelChange)="setItemEndDate(item, $event)"
                                [disabled]="!item.isScheduled"
                                class="w-full text-xs border rounded p-1.5 bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:border-indigo"
                              />
                            </td>

                            <!-- Action -->
                            <td class="p-3 text-center align-middle">
                              <button 
                                (click)="removeFromQueue(item.id)"
                                class="p-1 hover:bg-slate-200 rounded border-none bg-transparent text-slate-400 hover:text-rose cursor-pointer"
                                title="Remove from queue"
                              >
                                <mat-icon class="icon-size">delete</mat-icon>
                              </button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </div>

            <!-- Section 2: Deploy to Target PMax Asset Groups -->
            <div class="panel bg-white border rounded p-6 shadow-sm space-y-4">
              <div class="flex flex-col gap-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 class="font-bold text-xs text-slate-800 flex items-center gap-2 uppercase tracking-wide m-0">
                    <span class="step-num flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">2</span>
                    Deploy to Target PMax Asset Groups
                  </h3>

                  <button
                    (click)="reloadAssetGroups()"
                    [disabled]="isLoadingAssetGroups()"
                    class="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-300 transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                    title="Reload Asset Groups from Google Ads API"
                  >
                    <mat-icon [class.animate-spin]="isLoadingAssetGroups()" class="icon-size text-slate-600">refresh</mat-icon>
                    <span>{{ isLoadingAssetGroups() ? 'Reloading...' : 'Reload' }}</span>
                  </button>
                </div>

                <!-- Account & Asset Group Search & Filter Toolbar -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200 items-end">
                  
                  <!-- Target Account Dropdown with Integrated Search -->
                  <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-600 uppercase">Target Account</label>
                    <mat-form-field appearance="outline" class="w-full text-xs account-mat-form-field">
                      <mat-select
                        [ngModel]="selectedAccountId()"
                        (selectionChange)="onAccountChange($event.value)"
                        placeholder="Select Target Account"
                        panelClass="account-select-panel"
                      >
                        <!-- Integrated Search Box inside Dropdown Panel Header -->
                        <div class="p-2 border-b bg-slate-50 sticky top-0 z-10" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                          <div class="relative flex items-center">
                            <mat-icon class="absolute left-2.5 text-slate-400 icon-size">search</mat-icon>
                            <input 
                              type="text" 
                              placeholder="Search account name / ID..." 
                              [ngModel]="accountSearchQuery()"
                              (ngModelChange)="accountSearchQuery.set($event)"
                              (keydown)="$event.stopPropagation()"
                              class="w-full text-xs pl-8 pr-7 py-1.5 border rounded bg-white focus:outline-none"
                            />
                            @if (accountSearchQuery()) {
                              <button 
                                type="button"
                                (click)="accountSearchQuery.set(''); $event.stopPropagation()"
                                class="absolute right-2 text-slate-400 hover:text-slate-700 border-none bg-transparent cursor-pointer text-xs font-bold"
                              >
                                ✕
                              </button>
                            }
                          </div>
                        </div>

                        @for (acc of filteredAccounts(); track acc.id) {
                          <mat-option [value]="acc.id">
                            {{ acc.name }}
                          </mat-option>
                        }
                        @if (filteredAccounts().length === 0) {
                          <mat-option disabled class="text-slate-400">
                            {{ isLoadingAccounts() ? 'Loading accounts...' : 'No matching accounts found' }}
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>

                  <!-- Asset Group Filter Input -->
                  <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-600 uppercase">Search Asset Groups / Campaigns</label>
                    <div class="relative">
                      <mat-icon class="absolute left-2.5 top-2.5 text-slate-400 icon-size">filter_list</mat-icon>
                      <input 
                        type="text" 
                        placeholder="Filter group / campaign..." 
                        [ngModel]="searchQuery()"
                        (ngModelChange)="searchQuery.set($event)"
                        class="w-full text-xs pl-8 pr-2.5 py-2 border rounded-md bg-white focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>

                  <!-- Status Filter Checkboxes -->
                  <div class="md:col-span-2 flex flex-wrap items-center gap-6 pt-2 border-t border-slate-200">
                    <label class="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        [checked]="onlyActiveCampaigns()"
                        (change)="onlyActiveCampaigns.set(!onlyActiveCampaigns())"
                        class="rounded text-brand focus:ring-brand"
                      />
                      <span>Show only active campaigns</span>
                    </label>

                    <label class="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        [checked]="onlyActiveAssetGroups()"
                        (change)="onlyActiveAssetGroups.set(!onlyActiveAssetGroups())"
                        class="rounded text-brand focus:ring-brand"
                      />
                      <span>Show only active asset groups</span>
                    </label>
                  </div>
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

              <!-- Filterable & Scrollable Asset Groups Table (Max 10 visible rows) -->
              <div class="table-container max-h-80 overflow-y-auto border rounded font-sans">
                <table class="w-full text-left text-xs border-collapse">
                  <thead class="sticky top-0 bg-slate-100 z-10">
                    <tr class="text-slate-600 border-b font-semibold">
                      <th class="p-3 text-center w-12 bg-slate-100">
                        <input 
                          type="checkbox" 
                          [checked]="isAllFilteredSelected()"
                          (change)="toggleSelectAll()"
                          class="rounded cursor-pointer"
                        />
                      </th>
                      <th class="p-3 bg-slate-100">Asset Group Name</th>
                      <th class="p-3 bg-slate-100">Campaign</th>
                      <th class="p-3 bg-slate-100">Status</th>
                      <th class="p-3 text-right bg-slate-100">Current Slots</th>
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
                        <td class="p-3">
                          <span [class]="'px-2 py-0.5 rounded-full text-[10px] font-bold ' + (ag.status === 'ENABLED' || !ag.status ? 'bg-emerald-light text-emerald' : 'bg-slate-100 text-slate-500')">
                            {{ ag.status || 'ENABLED' }}
                          </span>
                        </td>
                        <td class="p-3 text-right font-mono font-medium text-slate-700">
                          {{ getAssetGroupImageCount(ag) }} / {{ ag.maxImages || 20 }}
                        </td>
                      </tr>
                    }
                    @if (filteredAssetGroups().length === 0) {
                      <tr>
                        <td colspan="5" class="p-8 text-center text-slate-400 font-medium">
                          {{ isLoadingAssetGroups() ? 'Loading asset groups...' : 'No asset groups match your search and active filters.' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Setup Options below table: Reworked Swap Rule & Performance Filters -->
              <div class="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4">
                <div class="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 class="text-xs font-bold text-slate-800 m-0">Swap Rule & Performance Filters</h3>
                    <p class="text-[10px] text-slate-500 m-0 mt-0.5">Configure lookback window, minimum thresholds, and eviction KPI metric.</p>
                  </div>
                  @if (enableMinImpressions() && enableMinClicks()) {
                    <div class="text-[10px] text-slate-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded flex items-center gap-1">
                      <mat-icon class="icon-size text-blue-600">info</mat-icon>
                      <span>Intersection Active (AND)</span>
                    </div>
                  }
                </div>

                <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <!-- 1. Lookback Window Dropdown -->
                  <div class="space-y-1.5 flex flex-col">
                    <label class="text-xs font-bold text-slate-700">Lookback Window</label>
                    <select 
                      [ngModel]="lookbackWindow()" 
                      (ngModelChange)="lookbackWindow.set($event)"
                      class="w-full text-xs bg-white border rounded p-2 focus:outline-none"
                    >
                      <option value="7d">Last 7 Days (7d)</option>
                      <option value="30d">Last 30 Days (30d)</option>
                      <option value="quarter">Last Full Quarter</option>
                      <option value="custom">Custom</option>
                    </select>
                    @if (lookbackWindow() === 'custom') {
                      <div class="flex items-center gap-1 mt-1">
                        <input 
                          type="number" 
                          [ngModel]="customLookbackDays()" 
                          (ngModelChange)="customLookbackDays.set($event)"
                          min="1" max="365"
                          class="w-20 text-xs border rounded p-1 text-center bg-white"
                        />
                        <span class="text-[10px] text-slate-500">days</span>
                      </div>
                    }
                  </div>

                  <!-- 2. Min Impressions Toggle + Custom Field -->
                  <div class="space-y-1.5 flex flex-col md:border-l md:border-slate-200 md:pl-4">
                    <div class="flex items-center justify-between">
                      <label class="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                        <input 
                          type="checkbox" 
                          [ngModel]="enableMinImpressions()" 
                          (ngModelChange)="enableMinImpressions.set($event)"
                          class="rounded text-brand focus:ring-0 cursor-pointer"
                        />
                        <span>Min Impressions</span>
                      </label>
                      <span [class]="'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ' + (enableMinImpressions() ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500')">
                        {{ enableMinImpressions() ? 'ON' : 'OFF' }}
                      </span>
                    </div>
                    @if (enableMinImpressions()) {
                      <input 
                        type="number" 
                        [ngModel]="minImpressions()" 
                        (ngModelChange)="minImpressions.set($event)"
                        placeholder="e.g. 1000"
                        class="w-full text-xs bg-white border rounded p-2 focus:outline-none"
                      />
                    } @else {
                      <p class="text-[10px] text-slate-400 italic m-0 pt-2">No min impressions filter</p>
                    }
                  </div>

                  <!-- 3. Min Clicks Toggle + Custom Field -->
                  <div class="space-y-1.5 flex flex-col md:border-l md:border-slate-200 md:pl-4">
                    <div class="flex items-center justify-between">
                      <label class="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                        <input 
                          type="checkbox" 
                          [ngModel]="enableMinClicks()" 
                          (ngModelChange)="enableMinClicks.set($event)"
                          class="rounded text-brand focus:ring-0 cursor-pointer"
                        />
                        <span>Min Clicks</span>
                      </label>
                      <span [class]="'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ' + (enableMinClicks() ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500')">
                        {{ enableMinClicks() ? 'ON' : 'OFF' }}
                      </span>
                    </div>
                    @if (enableMinClicks()) {
                      <input 
                        type="number" 
                        [ngModel]="minClicks()" 
                        (ngModelChange)="minClicks.set($event)"
                        placeholder="e.g. 50"
                        class="w-full text-xs bg-white border rounded p-2 focus:outline-none"
                      />
                    } @else {
                      <p class="text-[10px] text-slate-400 italic m-0 pt-2">No min clicks filter</p>
                    }
                  </div>

                  <!-- 4. Define Swap Metric Dropdown -->
                  <div class="space-y-1.5 flex flex-col md:border-l md:border-slate-200 md:pl-4">
                    <label class="text-xs font-bold text-slate-700">Define Swap Metric</label>
                    <select 
                      [ngModel]="swapMetric()" 
                      (ngModelChange)="swapMetric.set($event)"
                      class="w-full text-xs bg-white border rounded p-2 focus:outline-none"
                    >
                      <option value="ctr">CTR (Click-Through Rate)</option>
                      <option value="conv_rate">ConvRate (Conversion Rate)</option>
                      <option value="cpa">CPA (Cost Per Acquisition)</option>
                      <option value="roas">ROAS (Return On Ad Spend)</option>
                    </select>
                  </div>

                  <!-- 5. Allow Cross Aspect Ratio Swap Toggle -->
                  <div class="space-y-1.5 flex flex-col md:border-l md:border-slate-200 md:pl-4">
                    <div class="flex items-center justify-between">
                      <label class="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1.5">
                        <input 
                          type="checkbox" 
                          [ngModel]="allowCrossAspectRatioSwap()" 
                          (ngModelChange)="allowCrossAspectRatioSwap.set($event)"
                          class="rounded text-brand focus:ring-0 cursor-pointer"
                        />
                        <span>Cross Ratio Swap</span>
                      </label>
                      <span [class]="'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ' + (allowCrossAspectRatioSwap() ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500')">
                        {{ allowCrossAspectRatioSwap() ? 'ON' : 'OFF' }}
                      </span>
                    </div>
                    <p class="text-[10px] text-slate-400 italic m-0 pt-2">
                      {{ allowCrossAspectRatioSwap() ? 'Allows all marketing images to be swapped' : 'Strictly same aspect ratio only' }}
                    </p>
                  </div>
                </div>

                <!-- Filter Error Banner -->
                @if (filterError()) {
                  <div class="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-center justify-between mt-2">
                    <div class="flex items-center gap-2">
                      <mat-icon class="text-amber-600 icon-size shrink-0">warning</mat-icon>
                      <div>
                        <strong>Error: nothing to be swapped:</strong> Filters should be changed to match eligible assets in selected groups.
                      </div>
                    </div>
                    <button 
                      (click)="resetFiltersToDefault()" 
                      class="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 font-semibold rounded text-[10px] border-none cursor-pointer shrink-0"
                    >
                      Reset Filters
                    </button>
                  </div>
                }
              </div>

              <!-- Sync Save button -->
              <div class="flex items-center justify-between pt-2">
                <div class="text-[11px] text-muted flex items-center gap-1.5">
                  <mat-icon class="text-emerald icon-size">check_circle_outline</mat-icon>
                  <span>Protected images locked account-wide. Underperforming ones replaced.</span>
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
      <!-- Step 6: Replacement & Sync Logs -->
      <div class="panel bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wide m-0">Replacement & Sync Logs</h3>
            <p class="text-xs text-muted mt-1 m-0">
              Comprehensive report of automated asset rotations based on KPI triggers and promotional lifecycles.
            </p>
          </div>
          <button (click)="exportLogsCsv()" class="btn-csv flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs cursor-pointer transition-all shrink-0">
            <mat-icon class="icon-size">file_download</mat-icon>
            <span>Export CSV</span>
          </button>
        </div>

        <div class="table-container border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <th class="py-3.5 px-4">Date/time</th>
                <th class="py-3.5 px-4">Campaign & Asset group</th>
                <th class="py-3.5 px-4">New assigned asset</th>
                <th class="py-3.5 px-4">Evicted asset</th>
                <th class="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-sans">
              @for (log of stateService.replacementLogs(); track log.id) {
                <tr class="hover:bg-slate-50/50 transition-colors">
                  <td class="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap align-middle">
                    {{ formatLocalTimestamp(log.date) }}
                  </td>
                  <td class="py-3.5 px-4 align-middle">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-mono text-xs text-slate-600 font-medium">{{ log.campaignName }}</span>
                      <span class="text-slate-400 font-bold text-xs">&gt;</span>
                      <span class="font-bold text-xs text-slate-900">{{ log.assetGroupName }}</span>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 align-middle">
                    <div class="flex items-center gap-3 min-w-[180px]">
                      <img 
                        [src]="log.newAsset.url" 
                        class="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0 shadow-2xs" 
                        [alt]="log.newAsset.name" 
                      />
                      <span class="text-xs font-semibold text-slate-800 truncate" [title]="log.newAsset.name">
                        {{ log.newAsset.name }}
                      </span>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 align-middle">
                    @if (log.replacedAsset) {
                      <div class="flex items-center gap-3 min-w-[180px]">
                        <img 
                          [src]="log.replacedAsset.url" 
                          class="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0 shadow-2xs" 
                          [alt]="log.replacedAsset.name" 
                        />
                        <span class="text-xs font-medium text-slate-600 truncate" [title]="log.replacedAsset.name">
                          {{ log.replacedAsset.name }}
                        </span>
                      </div>
                    } @else {
                      <span class="text-xs text-slate-400 italic">None</span>
                    }
                  </td>
                  <td class="py-3.5 px-4 align-middle">
                    <div 
                      class="inline-flex items-center gap-1.5 text-xs cursor-help leading-normal flex-wrap"
                      [title]="log.fullApiError || log.errorMsg || (log.status === 'Success' ? 'Google Ads API Mutation executed successfully.' : 'Failed to link asset to Asset Group.')"
                    >
                      <span [class]="'w-1.5 h-1.5 rounded-full shrink-0 ' + (log.status === 'Success' ? 'bg-emerald' : 'bg-rose')"></span>
                      <span [class]="'font-bold ' + (log.status === 'Success' ? 'text-emerald' : 'text-rose')">
                        {{ log.status === 'Success' ? 'Success' : 'Failed' }}
                      </span>
                      @if (log.errorMsg) {
                        <span class="text-slate-500 font-normal text-xs">
                          ({{ log.errorMsg }})
                        </span>
                      }
                    </div>
                  </td>
                </tr>
              }
              @if (stateService.replacementLogs().length === 0) {
                <tr>
                  <td colspan="5" class="py-10 px-4 text-center text-slate-400 font-medium text-xs">
                    <mat-icon class="icon-size text-slate-300 block mx-auto mb-1">history</mat-icon>
                    No asset rotation logs recorded yet. Upload assets above and click "Save & Deploy Assets" to populate live sync history.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    .step-num {
      width: 20px;
      height: 20px;
    }
    .dropzone {
      min-height: 160px;
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
    .bg-emerald {
      background-color: #1e8e3e;
    }
    .bg-rose {
      background-color: #d93025;
    }
    .bg-emerald-light {
      background-color: rgba(30, 142, 62, 0.1);
    }
    .bg-rose-light {
      background-color: rgba(217, 48, 37, 0.1);
    }
    .panel {
      border-color: #dadce0;
    }
    .table-container {
      border-color: #dadce0;
    }
    .selected-row {
      background-color: rgba(26, 115, 232, 0.04);
    }
    .locked-card {
      border-color: #1a73e8;
      background-color: rgba(26, 115, 232, 0.02);
    }
    .icon-xs {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }
    .icon-size {
      font-size: 16px;
      width: 16px;
      height: 16px;
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
    .current-images-list {
      max-height: 420px;
      overflow-y: auto;
    }
    .badge-reason-kpi {
      background-color: rgba(26, 115, 232, 0.1);
      color: #1a73e8;
    }
    .badge-reason-special {
      background-color: rgba(249, 171, 0, 0.15);
      color: #b06000;
    }
    .badge-reason-manual {
      background-color: rgba(95, 99, 104, 0.1);
      color: #5f6368;
    }
  `,
  ],
})
export class AssetUploaderComponent implements OnInit {
  readonly stateService = inject(CampaignStateService);
  readonly apiService = inject(ApiService);

  readonly accessibleAccounts = signal<AccountItem[]>([]);
  readonly selectedAccountId = signal<string>('');
  readonly accountSearchQuery = signal<string>('');
  readonly isLoadingAccounts = signal<boolean>(false);
  readonly isLoadingAssetGroups = signal<boolean>(false);
  readonly reloadNotice = signal<{
    message: string;
    type: 'success' | 'warning' | 'info';
  } | null>(null);
  readonly uploadError = signal<string | null>(null);

  readonly acceptedFileTypes = computed(() => {
    const formats = this.stateService.supportedFormats();
    const mimeTypes = formats.map((ext) => {
      const clean = ext.replace('.', '').toLowerCase();
      return clean === 'jpg' || clean === 'jpeg'
        ? 'image/jpeg'
        : `image/${clean}`;
    });
    return [...formats, ...mimeTypes].join(',');
  });

  // Active filter signals
  readonly onlyActiveCampaigns = signal<boolean>(false);
  readonly onlyActiveAssetGroups = signal<boolean>(false);

  // Master schedule controls for bulk application
  masterSchedule = {
    offerName: '',
    endDate: '',
  };

  // Upload and queue states
  readonly dragActive = signal<boolean>(false);
  readonly uploadedQueue = signal<QueueItem[]>([]);

  // Filter / Selection states
  readonly searchQuery = signal<string>('');
  readonly selectedAssetGroups = signal<string[]>([]);
  readonly selectedKpi = signal<
    'impressions' | 'ctr' | 'conversions' | 'roas' | 'conversion_value'
  >('ctr');
  readonly maxCapacity = signal<number>(20);
  readonly activeViewerGroup = signal<string>('ag1');

  // Reworked Swap Rule & Performance Filter Signals
  readonly lookbackWindow = signal<'7d' | '30d' | 'quarter' | 'custom'>('30d');
  readonly customLookbackDays = signal<number>(14);
  readonly enableMinImpressions = signal<boolean>(false);
  readonly minImpressions = signal<number>(1000);
  readonly enableMinClicks = signal<boolean>(false);
  readonly minClicks = signal<number>(50);
  readonly swapMetric = signal<'ctr' | 'conv_rate' | 'cpa' | 'roas'>('ctr');
  readonly allowCrossAspectRatioSwap = signal<boolean>(false);

  // Custom naming protection pattern
  readonly protectionPattern = signal<string>('_Protected');

  // Triggering simulation message
  readonly syncStatus = signal<{
    message: string;
    type: 'success' | 'error' | 'info' | 'idle';
  }>({message: '', type: 'idle'});

  readonly filterError = computed<boolean>(() => {
    const minImp = this.enableMinImpressions() ? this.minImpressions() || 0 : 0;
    const minClk = this.enableMinClicks() ? this.minClicks() || 0 : 0;

    // Check if thresholds exclude assets or are unnaturally restrictive
    if (minImp > 50000 || minClk > 5000) {
      return true;
    }

    const selectedGroups = this.selectedAssetGroups();
    if (selectedGroups.length === 0) return false;

    const groupAssets = selectedGroups.flatMap(
      (gId) => this.stateService.campaignAssets()[gId] || [],
    );
    if (groupAssets.length === 0) return false;

    const eligibleForSwap = groupAssets.filter((a) => {
      if (a.isProtected) return false;
      const imp =
        a.impressions ?? (a.kpiValue ? Math.round(a.kpiValue * 500) : 800);
      const clk = a.clicks ?? (a.kpiValue ? Math.round(a.kpiValue * 25) : 30);
      return imp >= minImp && clk >= minClk;
    });

    return groupAssets.length > 0 && eligibleForSwap.length === 0;
  });

  resetFiltersToDefault(): void {
    this.lookbackWindow.set('30d');
    this.customLookbackDays.set(14);
    this.enableMinImpressions.set(false);
    this.minImpressions.set(1000);
    this.enableMinClicks.set(false);
    this.minClicks.set(50);
    this.swapMetric.set('ctr');
  }

  async ngOnInit(): Promise<void> {
    await this.loadAccessibleAccounts();
    const targetAccount = this.selectedAccountId() || '1234567890';
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

  readonly filteredAccounts = computed<AccountItem[]>(() => {
    const accs = this.accessibleAccounts();
    const q = this.accountSearchQuery().toLowerCase().trim();
    if (!q) return accs;
    return accs.filter(
      (a) => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q),
    );
  });

  async onAccountChange(accountId: string): Promise<void> {
    this.selectedAccountId.set(accountId);
    await this.reloadAssetGroups(accountId);
  }

  async reloadAssetGroups(customerId?: string): Promise<void> {
    const targetCustomer =
      customerId || this.selectedAccountId() || '1234567890';
    this.isLoadingAssetGroups.set(true);
    this.reloadNotice.set(null);
    try {
      const res = await this.apiService.fetchAssetGroups(targetCustomer);
      const rawGroups = res?.asset_groups || [];
      const formattedGroups: AssetGroup[] = rawGroups.map((ag) => ({
        id: ag.id,
        name: ag.name,
        campaignId: ag.campaign_id,
        campaignName: ag.campaign_name,
        account: `Google Ads Account (${targetCustomer.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')})`,
        imageCount: ag.total_image_count || 0,
        maxImages: ag.total_image_capacity || 20,
        currentKpiMetric: 'ctr',
        status: (ag.status as 'ENABLED' | 'PAUSED' | 'REMOVED') || 'ENABLED',
        campaignStatus:
          (ag.campaign_status as 'ENABLED' | 'PAUSED' | 'REMOVED') || 'ENABLED',
      }));
      this.stateService.setAssetGroups(formattedGroups);

      if (res?.error_message) {
        this.reloadNotice.set({
          message: `Live Google Ads API query notice: ${res.error_message}`,
          type: 'warning',
        });
      } else if (res?.source === 'live_google_ads_api') {
        this.reloadNotice.set({
          message: `Successfully loaded ${res.total_count} live Asset Groups via Google Ads API (Account: ${targetCustomer})!`,
          type: 'success',
        });
      }
    } catch (err: any) {
      console.warn('Failed to load asset groups from Google Ads API:', err);
      this.stateService.setAssetGroups([]);
      this.reloadNotice.set({
        message: `Unable to connect to Google Ads API endpoint: ${err?.message || err}`,
        type: 'warning',
      });
    } finally {
      this.isLoadingAssetGroups.set(false);
    }
  }

  // Computed selector values for asset groups
  readonly filteredAssetGroups = computed<AssetGroup[]>(() => {
    let groups = this.stateService.assetGroups();
    const query = this.searchQuery().toLowerCase().trim();
    const activeCampOnly = this.onlyActiveCampaigns();
    const activeGroupOnly = this.onlyActiveAssetGroups();

    if (activeCampOnly) {
      groups = groups.filter(
        (ag) => !ag.campaignStatus || ag.campaignStatus === 'ENABLED',
      );
    }

    if (activeGroupOnly) {
      groups = groups.filter((ag) => !ag.status || ag.status === 'ENABLED');
    }

    if (query) {
      groups = groups.filter(
        (ag) =>
          ag.name.toLowerCase().includes(query) ||
          ag.campaignName.toLowerCase().includes(query) ||
          ag.account.toLowerCase().includes(query) ||
          ag.id.toLowerCase().includes(query),
      );
    }

    return groups;
  });

  readonly currentViewerAssets = computed<CampaignAsset[]>(() => {
    const activeGroup = this.activeViewerGroup();
    return this.stateService.campaignAssets()[activeGroup] || [];
  });

  readonly isAllFilteredSelected = computed<boolean>(() => {
    const filtered = this.filteredAssetGroups();
    const selected = this.selectedAssetGroups();
    if (filtered.length === 0) return false;
    return filtered.every((ag) => selected.includes(ag.id));
  });

  getAssetGroupImageCount(ag: AssetGroup): number {
    return ag.imageCount ?? 0;
  }

  // Drag & Drop & Queue Actions
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
    this.uploadError.set(null);
    const supportedExts = this.stateService.supportedFormats();
    const validItems: QueueItem[] = [];
    const invalidNames: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (
        supportedExts.includes(ext) ||
        supportedExts.some((s) => s.toLowerCase() === ext)
      ) {
        validItems.push({
          id: `up-${Date.now()}-${i}`,
          name: file.name.split('.')[0] || 'uploaded_image',
          url: URL.createObjectURL(file),
          rawFile: file,
          isProtected: false,
          isScheduled: false,
        });
      } else {
        invalidNames.push(file.name);
      }
    }

    if (invalidNames.length > 0) {
      this.uploadError.set(
        `Skipped file(s) [${invalidNames.join(', ')}]. Unsupported format. Configured allowed formats: ${supportedExts.join(', ')}`,
      );
    }

    if (validItems.length > 0) {
      this.uploadedQueue.update((prev) => [...prev, ...validItems]);
    }
  }

  toggleItemSchedule(itemId: string): void {
    this.uploadedQueue.update((queue) =>
      queue.map((item) => {
        if (item.id === itemId) {
          const nextState = !item.isScheduled;
          return {
            ...item,
            isScheduled: nextState,
            scheduleDetails: nextState
              ? item.scheduleDetails || {...this.masterSchedule}
              : item.scheduleDetails,
          };
        }
        return item;
      }),
    );
  }

  readonly selectedScheduledCount = computed<number>(() => {
    return this.uploadedQueue().filter((i) => i.isScheduled).length;
  });

  readonly applyScheduleButtonText = computed<string>(() => {
    const selectedCount = this.selectedScheduledCount();
    return selectedCount > 0 ? 'Apply to selected' : 'Apply to all';
  });

  applyBulkSchedule(): void {
    const queue = this.uploadedQueue();
    const hasSelected = queue.some((item) => item.isScheduled);

    this.uploadedQueue.update((currentQueue) =>
      currentQueue.map((item) => {
        if (hasSelected ? item.isScheduled : true) {
          return {
            ...item,
            isScheduled: true,
            scheduleDetails: {...this.masterSchedule},
          };
        }
        return item;
      }),
    );
  }

  getItemEndDate(item: QueueItem): string {
    return item.scheduleDetails?.endDate ?? '';
  }

  setItemEndDate(item: QueueItem, value: string): void {
    this.uploadedQueue.update((queue) =>
      queue.map((i) => {
        if (i.id === item.id) {
          const details = i.scheduleDetails || {offerName: '', endDate: ''};
          return {
            ...i,
            isScheduled: true,
            scheduleDetails: {...details, endDate: value},
          };
        }
        return i;
      }),
    );
  }

  isAllQueueScheduled(): boolean {
    const q = this.uploadedQueue();
    return q.length > 0 && q.every((i) => i.isScheduled);
  }

  toggleAllQueueSchedule(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.uploadedQueue.update((queue) =>
      queue.map((item) => ({
        ...item,
        isScheduled: checked,
        scheduleDetails: checked
          ? item.scheduleDetails || {...this.masterSchedule}
          : item.scheduleDetails,
      })),
    );
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
    const blob = new Blob([ab], {type: 'image/png'});
    return new File([blob], `${filename}.png`, {type: 'image/png'});
  }

  handleLoadMockImage(
    preset: 'dog_pool' | 'cat_bowl' | 'scratching_tree',
  ): void {
    const mockSpecs = {
      dog_pool: {
        name: 'Store_SummerPool_Promo_July',
        width: 1000,
        height: 1000,
      },
      cat_bowl: {
        name: 'Store_Gourmet_Salmon_Dynamic',
        width: 1200,
        height: 628,
      },
      scratching_tree: {
        name: 'CatScratch_SolidOak_Deluxe',
        width: 1000,
        height: 1250,
      },
    };
    const spec = mockSpecs[preset];
    const rawFile = this.createCanvasMockFile(
      spec.name,
      spec.width,
      spec.height,
    );
    this.addFilesToQueue([rawFile]);
  }

  removeFromQueue(id: string): void {
    this.uploadedQueue.update((prev) => prev.filter((item) => item.id !== id));
  }

  clearQueue(): void {
    this.uploadedQueue.set([]);
  }

  toggleGroupSelection(id: string): void {
    this.selectedAssetGroups.update((prev) =>
      prev.includes(id) ? prev.filter((gId) => gId !== id) : [...prev, id],
    );
  }

  toggleSelectAll(): void {
    const filtered = this.filteredAssetGroups();
    if (this.isAllFilteredSelected()) {
      const filteredIds = filtered.map((ag) => ag.id);
      this.selectedAssetGroups.update((prev) =>
        prev.filter((id) => !filteredIds.includes(id)),
      );
    } else {
      const currentSelected = this.selectedAssetGroups();
      const nextSelected = Array.from(
        new Set([...currentSelected, ...filtered.map((ag) => ag.id)]),
      );
      this.selectedAssetGroups.set(nextSelected);
    }
  }

  simulateScheduleTimeout(assetId: string): void {
    const group = this.activeViewerGroup();
    const groupAssets = [...(this.stateService.campaignAssets()[group] || [])];
    const assetToTimeout = groupAssets.find((a) => a.id === assetId);
    if (!assetToTimeout || !assetToTimeout.scheduledTiming) return;

    const fallbackAssetId = assetToTimeout.scheduledTiming.fallbackAssetId;

    const fallbackMockAsset: CampaignAsset = {
      id: fallbackAssetId,
      name: 'DogFood_OldFallback_Restored',
      url: 'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=400&q=80',
      performanceScore: 'Good',
      kpiValue: 2.1,
      isProtected: false,
      uploadDate: new Date().toISOString().split('T')[0],
    };

    const updated = groupAssets.map((asset) => {
      if (asset.id === assetId) return fallbackMockAsset;
      return asset;
    });

    this.stateService.updateAssets(group, updated);
    this.stateService.updateAssetGroupImageCount(group, updated.length);

    this.stateService.addLog({
      id: `log-fallback-${Date.now()}`,
      date: new Date().toISOString(),
      campaignName:
        this.stateService.assetGroups().find((g) => g.id === group)
          ?.campaignName || 'Retailer_Campaign',
      assetGroupName:
        this.stateService.assetGroups().find((g) => g.id === group)?.name ||
        'Asset Group',
      replacedAsset: {name: assetToTimeout.name, url: assetToTimeout.url},
      newAsset: {name: fallbackMockAsset.name, url: fallbackMockAsset.url},
      reason: 'Special Offer',
      kpiMetric: `Promo "${assetToTimeout.scheduledTiming.offerName}" expired. Reverted to fallback asset.`,
      status: 'Success',
    });
  }

  async handleSaveAndSync(): Promise<void> {
    const queue = this.uploadedQueue();
    const selectedGroups = this.selectedAssetGroups();
    if (queue.length === 0) {
      this.syncStatus.set({
        message: 'Please upload or load at least one image to sync.',
        type: 'error',
      });
      return;
    }
    if (selectedGroups.length === 0) {
      this.syncStatus.set({
        message: 'Please select at least one PMax Asset Group.',
        type: 'error',
      });
      return;
    }
    const swapRules: SwapRules = {
      lookback_window: this.lookbackWindow(),
      custom_lookback_days:
        this.lookbackWindow() === 'custom' ? this.customLookbackDays() : null,
      min_impressions: this.enableMinImpressions()
        ? this.minImpressions()
        : null,
      min_clicks: this.enableMinClicks() ? this.minClicks() : null,
      eviction_kpi: this.swapMetric(),
      allow_cross_aspect_ratio_swap: this.allowCrossAspectRatioSwap(),
    };

    this.syncStatus.set({
      message: 'Validating & synchronizing images via Google Ads API...',
      type: 'info',
    });

    let hasSuccess = false;
    let hasFailure = false;

    try {
      for (const item of queue) {
        let fileToken = item.id;

        if (item.rawFile) {
          const uploadRes = await this.apiService.uploadImage(item.rawFile);
          fileToken = uploadRes.file_token;
        }

        const endDate =
          item.isScheduled && item.scheduleDetails?.endDate
            ? item.scheduleDetails.endDate
            : undefined;

        let assignRes: AssignResponse | null = null;
        let apiErrorMsg: string | null = null;

        try {
          assignRes = await this.apiService.assignAsset(
            fileToken,
            selectedGroups,
            this.selectedAccountId(),
            endDate,
            swapRules,
          );
        } catch (err: any) {
          apiErrorMsg = err?.message || 'Google Ads API mutation failed';
        }

        for (const groupId of selectedGroups) {
          const currentGroup = this.stateService
            .assetGroups()
            .find((g) => g.id === groupId);
          const groupAssets = [
            ...(this.stateService.campaignAssets()[groupId] || []),
          ];
          if (!currentGroup) continue;

          const groupResult = assignRes?.results?.find(
            (r) => r.asset_group_id === groupId,
          );
          const isGroupFailedInBackend = groupResult
            ? groupResult.status === 'FAILED'
            : false;

          // If API assignment threw an error or backend returned FAILED for this group
          if (apiErrorMsg || isGroupFailedInBackend) {
            hasFailure = true;
            const rawErr =
              groupResult?.error_message ||
              apiErrorMsg ||
              'Google Ads API mutation failed to link asset to Asset Group.';
            const lowerErr = rawErr.toLowerCase();

            const isLimitErr =
              lowerErr.includes('limit') ||
              lowerErr.includes('20') ||
              lowerErr.includes('capacity') ||
              lowerErr.includes('resource_exhausted') ||
              lowerErr.includes('max_assets');
            const isMinCompErr =
              lowerErr.includes('headline') ||
              lowerErr.includes('description') ||
              lowerErr.includes('not_enough') ||
              (lowerErr.includes('minimum') &&
                lowerErr.includes('composition')) ||
              lowerErr.includes('not met');

            let displayError = rawErr;
            if (isLimitErr && !rawErr.includes('swap')) {
              displayError = 'Reached limit of 20 images';
            } else if (isMinCompErr) {
              displayError =
                'Requires minimum composition (headlines/descriptions)';
            }

            this.stateService.addLog({
              id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              date: new Date().toISOString(),
              campaignName: currentGroup.campaignName,
              assetGroupName: currentGroup.name,
              replacedAsset: null,
              newAsset: {name: item.name, url: item.url},
              reason: item.isScheduled ? 'Special Offer' : 'Manual',
              status: 'Error',
              errorMsg: displayError,
              fullApiError: rawErr,
            });
            continue;
          }

          let evictedAsset: CampaignAsset | null = null;
          if (groupResult?.evicted_asset) {
            const backendEvicted = groupResult.evicted_asset;
            const evictIdx = groupAssets.findIndex(
              (a) => a.id === backendEvicted.asset_id,
            );
            if (evictIdx !== -1) {
              evictedAsset = groupAssets[evictIdx];
              groupAssets.splice(evictIdx, 1);
            } else {
              evictedAsset = {
                id: backendEvicted.asset_id,
                name: backendEvicted.name,
                url: backendEvicted.url,
                performanceScore: 'Pending',
                kpiValue: backendEvicted.kpi_value,
                isProtected: false,
                uploadDate: new Date().toISOString().split('T')[0],
              };
            }
          }

          const realAssetId = groupResult?.asset_group_asset_resource_name
            ? groupResult.asset_group_asset_resource_name.split('~')[1] ||
              groupResult.asset_group_asset_resource_name.split('/').pop() ||
              `asset-${Date.now()}`
            : `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

          // Fresh newly uploaded image
          const freshAsset: CampaignAsset = {
            id: realAssetId,
            name: item.name,
            url: item.url,
            performanceScore: 'Pending',
            kpiValue: 0,
            isProtected: item.isProtected,
            uploadDate: new Date().toISOString().split('T')[0],
            scheduledTiming:
              item.isScheduled && item.scheduleDetails
                ? {
                    id: `sched-${Date.now()}`,
                    endDate: item.scheduleDetails.endDate,
                    offerName: item.scheduleDetails.offerName,
                    fallbackAssetId: evictedAsset
                      ? evictedAsset.id
                      : `fallback-${Date.now()}`,
                  }
                : undefined,
          };

          groupAssets.push(freshAsset);
          this.stateService.updateAssets(groupId, groupAssets);
          this.stateService.updateAssetGroupImageCount(
            groupId,
            groupAssets.length,
          );
          hasSuccess = true;

          this.stateService.addLog({
            id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            date: new Date().toISOString(),
            campaignName: currentGroup.campaignName,
            assetGroupName: currentGroup.name,
            replacedAsset: evictedAsset
              ? {name: evictedAsset.name, url: evictedAsset.url}
              : null,
            newAsset: {name: freshAsset.name, url: freshAsset.url},
            reason: item.isScheduled ? 'Special Offer' : 'Manual',
            status: 'Success',
          });
        }
      }

      // Re-fetch live asset groups from Google Ads API to update Current Slots from live account
      await this.reloadAssetGroups(this.selectedAccountId());

      this.uploadedQueue.set([]);
      if (hasFailure && !hasSuccess) {
        this.syncStatus.set({
          message:
            'Sync failed for selected Asset Group(s). Check replacement logs below for details.',
          type: 'error',
        });
      } else if (hasFailure && hasSuccess) {
        this.syncStatus.set({
          message:
            'Sync completed with warnings. Some creative linked successfully while others failed (check logs below).',
          type: 'info',
        });
      } else {
        this.syncStatus.set({
          message: `Google Ads API Sync completed successfully! Assigned creative to ${selectedGroups.length} Asset Group(s).`,
          type: 'success',
        });
      }
      setTimeout(() => this.syncStatus.set({message: '', type: 'idle'}), 6000);
    } catch (err: any) {
      console.error('Google Ads API sync error:', err);
      this.syncStatus.set({
        message:
          err?.message ||
          'Google Ads API sync failed. Please check network/credentials.',
        type: 'error',
      });
    }
  }

  formatLocalTimestamp(isoOrDateStr: string): string {
    if (!isoOrDateStr) return '-';
    try {
      const d = new Date(isoOrDateStr);
      if (isNaN(d.getTime())) return isoOrDateStr;
      return d.toLocaleString();
    } catch {
      return isoOrDateStr;
    }
  }

  exportLogsCsv(): void {
    const logs = this.stateService.replacementLogs();
    if (!logs || logs.length === 0) return;

    let csvContent =
      'data:text/csv;charset=utf-8,Date,Campaign,Asset Group,Evicted Asset,New Asset,Trigger,Status\n';
    logs.forEach((l) => {
      const row = [
        `"${this.formatLocalTimestamp(l.date)}"`,
        `"${l.campaignName}"`,
        `"${l.assetGroupName}"`,
        `"${l.replacedAsset?.name || 'None'}"`,
        `"${l.newAsset.name}"`,
        `"${l.reason}"`,
        `"${l.status}"`,
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `adios_sync_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
