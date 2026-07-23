/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CampaignStateService } from '../services/campaign-state.service';
import { MerchantProduct } from '../models/types';
import { ComplianceBadgeComponent } from '../shared/compliance-badge.component';

// Mock backgrounds mapped to product IDs
const mockGeneratedBackgrounds: Record<string, string> = {
  p1: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=500&q=80',
  p2: 'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=500&q=80',
  p3: 'https://images.unsplash.com/photo-1617806118233-18e1db207f62?w=500&q=80',
  p4: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=500&q=80',
  p5: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=500&q=80'
};

@Component({
  selector: 'app-background-studio',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatIconModule, 
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    ComplianceBadgeComponent
  ],
  template: `
    <div class="studio-container p-8 space-y-6 select-none animate-fade-in" id="background-studio">
      <!-- Header banner -->
      <div class="header-banner flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border p-6 rounded-2xl shadow-xs">
        <div>
          <h2 class="font-bold text-base text-slate-800 m-0">AI Image Studio</h2>
          <p class="text-xs text-muted mt-1 leading-normal m-0 max-w-xl">
            Select Merchant Center products to swap boring studio packshots into stunning seasonal, promotional, or solid-color environments in bulk.
          </p>
        </div>
      </div>

      <!-- 1. Merchant Center Shop Dropdown with Integrated Search Bar (Full Width Top) -->
      <div class="panel bg-white border rounded-2xl shadow-xs p-6 space-y-4">
            <h3 class="font-bold text-sm uppercase text-slate-500 tracking-wider m-0 flex items-center gap-1.5">
              <mat-icon class="icon-size text-indigo">store</mat-icon>
              1. Merchant Center Shop
            </h3>
            
            <div class="space-y-1">
              <mat-form-field appearance="outline" class="w-full text-sm shop-mat-form-field">
                <mat-select
                  [ngModel]="selectedShopId()"
                  (selectionChange)="selectedShopId.set($event.value)"
                  placeholder="Select Merchant Center Shop"
                  panelClass="shop-select-panel"
                >
                  <!-- Integrated Search Box inside select header -->
                  <div class="p-2 border-b bg-slate-50 sticky top-0 z-10" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
                    <div class="relative flex items-center">
                      <mat-icon class="absolute left-2.5 text-slate-400 icon-size">search</mat-icon>
                      <input 
                        type="text" 
                        placeholder="Search shop name or ID..." 
                        [ngModel]="shopSearchQuery()"
                        (ngModelChange)="shopSearchQuery.set($event)"
                        (keydown)="$event.stopPropagation()"
                        class="w-full text-xs pl-8 pr-7 py-1.5 border rounded bg-white focus:outline-none"
                      />
                      @if (shopSearchQuery()) {
                        <button 
                          type="button"
                          (click)="shopSearchQuery.set(''); $event.stopPropagation()"
                          class="absolute right-2 text-slate-400 hover:text-slate-700 border-none bg-transparent cursor-pointer text-xs font-bold"
                        >
                          ✕
                        </button>
                      }
                    </div>
                  </div>

                  @for (shop of filteredShops(); track shop.id) {
                    <mat-option [value]="shop.id">
                      {{ shop.name }} (ID: {{ shop.id }})
                    </mat-option>
                  }
                  @if (filteredShops().length === 0) {
                    <mat-option disabled class="text-slate-400">No matching shops found</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          </div>

          <!-- Side-by-side Columns: 2 (Left) & 3 (Right) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

            <!-- 2. Products Preview List (Tabelle max. 10) -->
            <div class="panel bg-white border rounded-2xl shadow-xs p-6 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-sm uppercase text-slate-500 tracking-wider m-0 flex items-center gap-1.5">
                <mat-icon class="icon-size text-indigo">shopping_bag</mat-icon>
                2. Catalog Preview List
              </h3>
              <span class="text-xs text-muted font-medium bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">Max. 10 Shown</span>
            </div>

            <!-- Search Bar for SKU or Name or ID -->
            <div class="relative">
              <mat-icon class="absolute left-3 top-2.5 text-slate-400 icon-size">search</mat-icon>
              <input 
                type="text" 
                placeholder="Search product name or ID..." 
                [ngModel]="productSearchQuery()" 
                (ngModelChange)="productSearchQuery.set($event)"
                class="w-full text-xs pl-8 pr-3 py-2 border rounded bg-slate-50 focus:bg-white focus:outline-none text-slate-700 font-medium"
              />
            </div>

            <!-- Table Container -->
            <div class="table-container border rounded-xl overflow-hidden shadow-xs">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-50 text-slate-500 font-semibold border-b">
                    <th class="p-2.5 text-center w-10">
                      <input 
                        type="checkbox" 
                        [checked]="isAllFilteredSelected()"
                        (change)="toggleSelectAll()"
                        class="rounded cursor-pointer"
                      />
                    </th>
                    <th class="p-2.5 w-36">ID</th>
                    <th class="p-2.5">Product Name</th>
                    <th class="p-2.5 text-center w-20">Thumbnail</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (p of limitedProducts(); track p.id) {
                    @let isSelected = selectedProductIds().includes(p.id);
                    <tr 
                      (click)="toggleProduct(p.id)"
                      [class.selected-row]="isSelected"
                      class="hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <td class="p-2.5 text-center" (click)="$event.stopPropagation()">
                        <input 
                          type="checkbox" 
                          [checked]="isSelected"
                          (change)="toggleProduct(p.id)"
                          class="rounded cursor-pointer"
                        />
                      </td>
                      <td class="p-2.5 font-mono text-muted text-xs">{{ p.sku }}</td>
                      <td class="p-2.5">
                        <div class="min-w-0">
                          <p class="font-medium text-slate-700 m-0">{{ p.name }}</p>
                        </div>
                      </td>
                      <td class="p-2 text-center" (click)="$event.stopPropagation()">
                        <img [src]="p.originalImageUrl" class="w-8 h-8 object-cover rounded border mx-auto shadow-sm" />
                      </td>
                    </tr>
                  }
                  @if (limitedProducts().length === 0) {
                    <tr>
                      <td colspan="4" class="p-8 text-center text-slate-400 text-xs font-semibold">No matching products found.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- 3. Background Settings -->
          <div class="panel bg-white border rounded-2xl shadow-xs p-6 space-y-4">
            <h3 class="font-bold text-sm uppercase text-slate-500 tracking-wider m-0 flex items-center gap-1.5">
              <mat-icon class="icon-size text-indigo">settings</mat-icon>
              3. Background Settings
            </h3>

            <!-- Workflow Selection -->
            <div class="space-y-1.5 flex flex-col">
              <label class="text-xs font-bold text-slate-700">Select Workflow Action</label>
              <select 
                [ngModel]="selectedFlow()"
                (ngModelChange)="selectedFlow.set($event)"
                class="text-xs bg-slate-50 border rounded p-2 focus:outline-none focus:bg-white transition-all font-medium text-slate-700"
              >
                <option value="flow1">Seasonal Backdrops</option>
                <option value="flow2">Update Seasonal Backdrops</option>
                <option value="flow3">Solid Backdrops</option>
                <option value="flow4">Change Solid Backdrops</option>
                <option value="flow5">Delete Images</option>
              </select>
            </div>

            <!-- CONDITIONAL VIEW: Flow 1 & Flow 2 -->
            @if (selectedFlow() === 'flow1' || selectedFlow() === 'flow2') {
              <div class="space-y-4 pt-2 border-t border-slate-100">
                
                <!-- Scheduling dates -->
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col space-y-1">
                    <label class="text-xs font-bold text-slate-700">Start Date</label>
                    <input 
                      type="date" 
                      [ngModel]="schedulingStart()" 
                      (ngModelChange)="schedulingStart.set($event)" 
                      class="text-xs border rounded p-2 bg-slate-50 focus:bg-white focus:outline-none text-slate-700 font-medium"
                    />
                  </div>
                  <div class="flex flex-col space-y-1">
                    <label class="text-xs font-bold text-slate-700">End Date</label>
                    <input 
                      type="date" 
                      [ngModel]="schedulingEnd()" 
                      (ngModelChange)="schedulingEnd.set($event)" 
                      class="text-xs border rounded p-2 bg-slate-50 focus:bg-white focus:outline-none text-slate-700 font-medium"
                    />
                  </div>
                </div>

                <!-- Saisonalitäten Dropdown -->
                <div class="flex flex-col space-y-1">
                  <label class="text-xs font-bold text-slate-700">Seasonality</label>
                  <select 
                    [ngModel]="seasonality()" 
                    (ngModelChange)="seasonality.set($event)" 
                    class="text-xs bg-slate-50 border rounded p-2 focus:outline-none focus:bg-white transition-all text-slate-700 font-medium"
                  >
                    <option value="Winter">❄️ Winter</option>
                    <option value="Spring">🌸 Spring</option>
                    <option value="Summer">☀️ Summer</option>
                    <option value="Autumn">🍁 Autumn</option>
                    <option value="Christmas">🎄 Christmas</option>
                  </select>
                </div>

                <!-- Szenen Dropdown -->
                <div class="flex flex-col space-y-1">
                  <label class="text-xs font-bold text-slate-700">Scene</label>
                  <select 
                    [ngModel]="scene()" 
                    (ngModelChange)="scene.set($event)" 
                    class="text-xs bg-slate-50 border rounded p-2 focus:outline-none focus:bg-white transition-all text-slate-700 font-medium"
                  >
                    <option value="Living Room">Living Room</option>
                    <option value="Dining Room">Dining Room</option>
                    <option value="Bedroom">Bedroom</option>
                    <option value="Hallway">Hallway</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Garden">Garden</option>
                    <option value="City">City</option>
                    <option value="Forest">Forest</option>
                    <option value="Meadow">Meadow</option>
                  </select>
                </div>

                <!-- Hintergrundschärfe -->
                <div class="flex flex-col space-y-1">
                  <label class="text-xs font-bold text-slate-700">Background Sharpness</label>
                  <div class="flex gap-4 pt-1">
                    <label class="inline-flex items-center text-xs text-slate-600 gap-1.5 cursor-pointer font-medium select-none">
                      <input 
                        type="radio" 
                        name="sharpness" 
                        value="blurred" 
                        [checked]="sharpness() === 'blurred'" 
                        (change)="sharpness.set('blurred')" 
                        class="cursor-pointer" 
                      />
                      Blurred
                    </label>
                    <label class="inline-flex items-center text-xs text-slate-600 gap-1.5 cursor-pointer font-medium select-none">
                      <input 
                        type="radio" 
                        name="sharpness" 
                        value="sharp" 
                        [checked]="sharpness() === 'sharp'" 
                        (change)="sharpness.set('sharp')" 
                        class="cursor-pointer" 
                      />
                      Sharp
                    </label>
                  </div>
                </div>

                <!-- Style -->
                <div class="flex flex-col space-y-1">
                  <label class="text-xs font-bold text-slate-700">Style</label>
                  <select 
                    [ngModel]="style()" 
                    (ngModelChange)="style.set($event)" 
                    class="text-xs bg-slate-50 border rounded p-2 focus:outline-none focus:bg-white transition-all text-slate-700 font-medium"
                  >
                    <option value="elegant">✨ Elegant</option>
                    <option value="playful">🎨 Playful</option>
                    <option value="dynamic">⚡ Dynamic</option>
                    <option value="static">📐 Static</option>
                  </select>
                </div>

                <!-- Light -->
                <div class="flex flex-col space-y-1">
                  <label class="text-xs font-bold text-slate-700">Light</label>
                  <select 
                    [ngModel]="lighting()" 
                    (ngModelChange)="lighting.set($event)" 
                    class="text-xs bg-slate-50 border rounded p-2 focus:outline-none focus:bg-white transition-all text-slate-700 font-medium"
                  >
                    <option value="bright">☀️ Bright</option>
                    <option value="natural">🌿 Natural</option>
                    <option value="dark">🌙 Dark</option>
                  </select>
                </div>

                <div class="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
                  <div>
                    <strong class="text-indigo text-xs font-bold block mb-1.5">Generated Prompt:</strong>
                    <p class="text-slate-600 m-0 leading-normal bg-white p-2 rounded border select-all font-normal border-slate-200">
                      {{ compiledEnPrompt() }}
                    </p>
                  </div>
                </div>

                <button
                  (click)="handleBulkGenerate()"
                  [disabled]="selectedProductIds().length === 0"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-brand hover:bg-brand-dark text-white text-xs font-semibold border-none transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <mat-icon class="icon-size">auto_awesome</mat-icon>
                  <span>Bulk Generate backgrounds ({{ selectedProductIds().length }})</span>
                </button>
              </div>
            }

            <!-- CONDITIONAL VIEW: Flow 3 & Flow 4 (Solid Backgrounds) -->
            @if (selectedFlow() === 'flow3' || selectedFlow() === 'flow4') {
              <div class="space-y-4 pt-2 border-t border-slate-100">
                <div class="flex flex-col space-y-1.5">
                  <label class="text-xs font-bold text-slate-700">Enter Color as Hex Code</label>
                  <div class="flex gap-2">
                    <input 
                      type="color" 
                      [ngModel]="hexColor()" 
                      (ngModelChange)="hexColor.set($event)" 
                      class="w-10 h-10 border p-0.5 rounded cursor-pointer shrink-0 bg-white"
                    />
                    <input 
                      type="text" 
                      placeholder="#ffffff" 
                      [ngModel]="hexColor()" 
                      (ngModelChange)="hexColor.set($event)" 
                      class="grow text-xs border rounded p-2 focus:outline-none font-mono font-medium text-slate-700"
                    />
                  </div>
                </div>

                <div class="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
                  <div>
                    <strong class="text-indigo text-xs font-bold block mb-1.5">Color Merging Pipeline:</strong>
                    <p class="text-slate-600 m-0 leading-normal bg-white p-2 rounded border font-normal border-slate-200">
                      Creates a high-resolution solid colored background with pixels matching <strong class="font-bold">{{ hexColor() }}</strong>, merging it elegantly behind the clipped, packshot-extracted product item.
                    </p>
                  </div>
                </div>

                <button
                  (click)="handleBulkGenerate()"
                  [disabled]="selectedProductIds().length === 0"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-brand hover:bg-brand-dark text-white text-xs font-semibold border-none transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <mat-icon class="icon-size">colorize</mat-icon>
                  <span>Apply Solid Color Background ({{ selectedProductIds().length }})</span>
                </button>
              </div>
            }

            <!-- CONDITIONAL VIEW: Flow 5 / Flow 4 (Delete Assets) -->
            @if (selectedFlow() === 'flow5') {
              <div class="space-y-4 pt-2 border-t border-slate-100">
                <div class="flex flex-col space-y-1">
                  <label class="text-xs font-bold text-slate-700">Select which images to delete</label>
                  <p class="text-xs text-muted m-0 mb-2 leading-normal font-normal">
                    Select the corresponding attributes to delete linked backdrops from both the database and your Merchant Center Feed.
                  </p>
                  
                  <div class="space-y-2 border rounded p-3 bg-slate-50 max-h-[160px] overflow-y-auto border-slate-200 text-xs">
                    @for (label of deleteLabels(); track label.name) {
                      <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          [checked]="label.active" 
                          (change)="toggleDeleteLabel(label.name)" 
                          class="rounded cursor-pointer"
                        />
                        <span class="delete-checkbox-text hover:text-slate-900 transition-colors">{{ label.name }}</span>
                      </label>
                    }
                  </div>
                </div>

                <button
                  (click)="handleBulkDelete(alertDialog)"
                  [disabled]="activeDeleteLabelsCount() === 0"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-rose hover:bg-rose-dark text-white text-xs font-semibold border-none transition-all cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <mat-icon class="icon-size">delete</mat-icon>
                  <span>Delete Images ({{ activeDeleteLabelsCount() }} selected)</span>
                </button>
              </div>
            }
          </div>
        </div>

        <!-- 4. Image Validation Area (Full Width Bottom) -->
        <div class="panel bg-white border rounded-2xl shadow-xs p-6 flex flex-col gap-4">
            <div class="flex items-center justify-between border-b pb-3">
              <div>
                <h3 class="font-bold text-sm uppercase text-slate-500 tracking-wider m-0 flex items-center gap-1.5">
                  <mat-icon class="icon-size text-indigo">done_all</mat-icon>
                  4. Image Validation
                </h3>
                <p class="text-xs text-muted mt-1.5 m-0">
                  Verify composed outputs. The comment field is used specifically when selecting 'Regenerate' to guide the prompt composition.
                </p>
              </div>
            </div>

            <!-- Generated Deck List Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-[600px] overflow-y-auto pr-1">
              @for (product of stateService.merchantProducts(); track product.id) {
                @if (product.bgGenerationStatus !== 'idle') {
                  @let isGenerating = product.bgGenerationStatus === 'generating';
                  @let isRejected = product.bgGenerationStatus === 'rejected';

                  <div 
                    [class.border-rose-200]="isRejected"
                    [class.bg-rose-light]="isRejected"
                    [class.border-amber-250]="isGenerating"
                    [class.bg-amber-light]="isGenerating"
                    class="border rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all bg-white"
                  >
                    <!-- Visual Area -->
                    <div class="relative h-44 bg-slate-100 flex items-center justify-center overflow-hidden border-b">
                      @if (isGenerating) {
                        <div class="text-center space-y-3 p-4">
                          <mat-icon class="text-amber-500 animate-spin mx-auto icon-lg">refresh</mat-icon>
                          <div class="space-y-1">
                            <p class="text-xs font-bold text-amber-800 m-0">Diffusion Composer Active</p>
                            <p class="text-xs text-muted font-mono m-0 mt-0.5">Running model/imagen-3...</p>
                          </div>
                        </div>
                      } @else {
                        <div class="relative w-full h-full">
                          
                          <!-- Composed Preview image (Click to view full size) -->
                          <img 
                            [src]="product.generatedImageUrl" 
                            alt="Composed backdrop" 
                            (click)="previewImageUrl.set(product.generatedImageUrl || null); previewDialog.showModal()"
                            class="w-full h-full object-cover cursor-zoom-in hover:opacity-95 transition-opacity"
                            title="Click to view full size"
                            referrerpolicy="no-referrer"
                          />



                          <!-- Score overlay -->
                          @if (product.brandScore !== undefined) {
                            <div class="absolute top-2.5 right-2.5 z-10">
                              <app-compliance-badge [score]="product.brandScore" [compact]="true"></app-compliance-badge>
                            </div>
                          }
                        </div>
                      }
                    </div>

                    <!-- Metadata and Review Actions -->
                    <div class="p-5 grow flex flex-col justify-between gap-5">
                      <div>
                        <div class="flex items-center justify-between">
                          <span class="text-xs text-muted font-mono font-medium">ID: {{ product.sku }}</span>
                          <span class="text-xs text-emerald bg-emerald-light px-2 py-0.5 rounded font-bold">
                            {{ product.category }}
                          </span>
                        </div>
                        <h4 class="font-bold text-xs text-slate-800 m-0 mt-1.5">{{ product.name }}</h4>
                      </div>

                      @if (!isGenerating) {
                        <div class="space-y-4">
                          @if (product.complianceDetails) {
                            <app-compliance-badge [score]="product.brandScore || 0" [details]="product.complianceDetails"></app-compliance-badge>
                          }

                          @if (isRejected) {
                            <div class="bg-rose-light border border-rose-100 rounded-xl p-4 text-xs space-y-3">
                              <p class="font-bold text-rose flex items-center gap-1 m-0">
                                <mat-icon class="icon-size">warning</mat-icon>
                                <span>Rejected (Awaiting Adjustment)</span>
                              </p>
                              @if (product.rejectionComment) {
                                <p class="text-slate-600 italic m-0 bg-white/60 p-2 rounded border border-rose-50 leading-relaxed">
                                  "{{ product.rejectionComment }}"
                                </p>
                              }

                              <!-- Regeneration Adjustment Freifeld Comment -->
                              <div class="flex gap-3 items-center">
                                <input 
                                  type="text" 
                                  placeholder="Type adjustment comments..."
                                  [ngModel]="regenerationComments[product.id] || ''"
                                  (ngModelChange)="updateRegenComment(product.id, $event)"
                                  class="grow text-xs border rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-brand font-medium text-slate-700"
                                />
                                <button
                                  (click)="handleRegenerate(product.id)"
                                  class="shrink-0 py-1.5 px-3 bg-rose text-white hover:bg-rose-dark border-none rounded text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shadow-sm"
                                  title="Regenerate with feedback"
                                >
                                  <mat-icon class="icon-xs">refresh</mat-icon>
                                  <span>Regenerate</span>
                                </button>
                              </div>
                            </div>
                          } @else {
                            <div class="space-y-4">
                              
                              <!-- Row 1: Regeneration input and Regenerate button next to it -->
                              <div class="flex gap-3 items-center">
                                <input 
                                  type="text" 
                                  placeholder="Feedback for regeneration..."
                                  [ngModel]="regenerationComments[product.id] || ''"
                                  (ngModelChange)="updateRegenComment(product.id, $event)"
                                  class="grow text-xs border rounded px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:outline-none transition-all font-medium text-slate-700"
                                />
                                <button
                                  (click)="handleRegenerate(product.id)"
                                  class="shrink-0 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 rounded transition-all flex items-center gap-1 cursor-pointer"
                                  title="Regenerate with specified feedback"
                                >
                                  <mat-icon class="icon-xs">refresh</mat-icon>
                                  <span>Regenerate</span>
                                </button>
                              </div>

                              <!-- Row 2: Confirm (Green) and Reject (Red) buttons side-by-side -->
                              <div class="flex gap-3">
                                <button
                                  (click)="handleConfirm(product.id)"
                                  class="grow py-2 px-3 rounded bg-brand hover:bg-brand-dark text-white font-bold text-xs border-none transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer font-inter"
                                >
                                  <mat-icon class="icon-size">check</mat-icon>
                                  <span>Confirm</span>
                                </button>

                                <button
                                  (click)="handleReject(product.id)"
                                  class="grow py-2 px-3 rounded bg-rose hover:bg-rose-dark text-white font-bold text-xs border-none transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer font-inter"
                                >
                                  <mat-icon class="icon-size">close</mat-icon>
                                  <span>Reject</span>
                                </button>
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              }
              @if (activeReviewDeckCount() === 0) {
                <div class="col-span-2 text-center py-20 border border-dashed rounded-2xl space-y-1.5">
                  <mat-icon class="text-slate-300 mx-auto icon-lg">folder_open</mat-icon>
                  <p class="text-xs text-muted m-0 font-medium">Review deck is currently empty.</p>
                  <p class="text-xs text-muted m-0 leading-normal max-w-md mx-auto">
                    Select products on the left and choose a background settings workflow to generate composition mockups.
                  </p>
                </div>
              }
            </div>
          </div>
        </div>

    <!-- Native Full-size Image Preview Dialog -->
    <dialog 
      #previewDialog
      class="preview-modal animate-fade-in"
      (click)="$event.target === previewDialog ? handleClosePreview(previewDialog) : null"
    >
      @if (previewImageUrl()) {
        <div class="preview-container">
          <!-- Close button top-right -->
          <button 
            (click)="handleClosePreview(previewDialog)"
            class="preview-close-btn"
            title="Close Preview"
          >
            <mat-icon class="icon-lg font-bold">close</mat-icon>
          </button>

          <!-- Zoomed Image -->
          <img 
            [src]="previewImageUrl()!" 
            alt="Full size composed backdrop preview" 
            class="preview-image"
          />
        </div>
      }
    </dialog>
    
    <!-- Centered Alert Dialog -->
    <dialog 
      #alertDialog
      class="alert-modal animate-fade-in"
      (click)="$event.target === alertDialog ? handleCloseAlert(alertDialog) : null"
    >
      @if (alertMessage()) {
        <div class="alert-dialog-container">
          <div class="alert-icon-wrapper">
            <mat-icon class="alert-icon">delete_sweep</mat-icon>
          </div>
          <h3 class="alert-title">Images Deleted</h3>
          <p class="alert-message">{{ alertMessage() }}</p>
          <button 
            (click)="handleCloseAlert(alertDialog)"
            class="alert-confirm-btn"
          >
            Got it
          </button>
        </div>
      }
    </dialog>
  `,
  styles: [`
    :host {
      font-family: 'Roboto', sans-serif !important;
    }
    input, select, textarea, button {
      font-family: 'Roboto', sans-serif !important;
    }
    .studio-container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .panel {
      border-color: #dadce0;
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
    .bg-emerald {
      background-color: #1e8e3e;
    }
    .bg-emerald-light {
      background-color: rgba(30, 142, 62, 0.08);
      color: #1e8e3e;
    }
    .bg-rose {
      background-color: #d93025;
    }
    .bg-rose-light {
      background-color: rgba(217, 48, 37, 0.03);
    }
    .bg-amber-light {
      background-color: rgba(249, 171, 0, 0.03);
    }
    .border-rose-200 {
      border-color: #fad2cf;
    }
    .border-rose-250 {
      border-color: #f5c2c1;
    }
    .border-amber-250 {
      border-color: #fde293;
    }
    .table-container {
      border-color: #dadce0;
      background-color: #ffffff;
    }
    table th {
      border-bottom: 1px solid #dadce0;
    }
    .selected-row {
      background-color: rgba(30, 142, 62, 0.04);
    }
    .badge-status {
      font-size: 8px;
      padding: 1px 4px;
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
    .icon-lg {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .shop-mat-form-field {
      display: block !important;
      width: 100% !important;
    }
    .shop-mat-form-field ::ng-deep .mat-mdc-text-field-wrapper {
      background-color: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 8px !important;
      height: 40px !important;
      padding: 0 12px !important;
      transition: all 0.2s ease !important;
    }
    .shop-mat-form-field ::ng-deep .mat-mdc-text-field-wrapper:hover {
      background-color: #f1f5f9 !important;
      border-color: #94a3b8 !important;
    }
    .shop-mat-form-field ::ng-deep .mat-mdc-form-field-flex {
      height: 40px !important;
      align-items: center !important;
    }
    .shop-mat-form-field ::ng-deep .mat-mdc-form-field-infix {
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      min-height: 40px !important;
      display: flex !important;
      align-items: center !important;
    }
    .shop-mat-form-field ::ng-deep .mat-mdc-select-value {
      font-size: 14px !important;
      font-weight: 700 !important;
      color: #334155 !important;
    }
    .shop-mat-form-field ::ng-deep .mat-mdc-select-placeholder {
      font-size: 14px !important;
      font-weight: 700 !important;
      color: #64748b !important;
    }
    .shop-mat-form-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none !important;
    }
    .shop-mat-form-field ::ng-deep .mdc-notched-outline {
      display: none !important;
    }
    ::ng-deep .shop-select-panel {
      border-radius: 12px !important;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1) !important;
      border: 1px solid #e2e8f0 !important;
      padding: 4px 0 !important;
    }
    ::ng-deep .shop-select-panel mat-option {
      font-size: 14px !important;
      font-weight: 600 !important;
      color: #334155 !important;
      height: 40px !important;
    }
    ::ng-deep .shop-select-panel mat-option:hover {
      background-color: #f1f5f9 !important;
    }
    ::ng-deep .shop-select-panel .mat-mdc-option-text {
      font-family: 'Roboto', sans-serif !important;
    }
    .delete-checkbox-text {
      font-size: 13px !important;
      font-weight: 500 !important;
      color: #334155 !important;
    }
    .cursor-zoom-in {
      cursor: zoom-in;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fade-in {
      animation: fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .preview-modal {
      border: none !important;
      background: transparent !important;
      padding: 0 !important;
      margin: auto !important;
      overflow: visible !important;
      max-width: 90vw !important;
      max-height: 90vh !important;
      box-shadow: none !important;
      display: none;
    }
    .preview-modal[open] {
      display: block !important;
    }
    .preview-modal::backdrop {
      background-color: rgba(0, 0, 0, 0.85) !important;
      backdrop-filter: blur(4px) !important;
      -webkit-backdrop-filter: blur(4px) !important;
    }
    .preview-container {
      position: relative !important;
      display: inline-block !important;
      padding: 48px 48px 0 0 !important;
      max-width: 90vw !important;
      max-height: 90vh !important;
    }
    .preview-image {
      display: block !important;
      max-width: calc(90vw - 48px) !important;
      max-height: calc(90vh - 48px) !important;
      border-radius: 16px !important;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
    .preview-close-btn {
      position: absolute !important;
      top: 0px !important;
      right: 0px !important;
      width: 40px !important;
      height: 40px !important;
      border-radius: 50% !important;
      background-color: #ffffff !important;
      color: #1e293b !important;
      border: 2px solid rgba(0, 0, 0, 0.1) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      transition: all 0.2s ease-in-out !important;
      z-index: 9999 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
    }
    .preview-close-btn:hover {
      background-color: #f1f5f9 !important;
      transform: scale(1.1) !important;
    }
    .alert-modal {
      border: none !important;
      background: transparent !important;
      padding: 0 !important;
      margin: auto !important;
      overflow: visible !important;
      max-width: 480px !important;
      width: 90% !important;
      box-shadow: none !important;
      display: none;
    }
    .alert-modal[open] {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    .alert-modal::backdrop {
      background-color: rgba(15, 23, 42, 0.4) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
    }
    .alert-dialog-container {
      background: rgba(255, 255, 255, 0.95) !important;
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
      border: 1px solid rgba(255, 255, 255, 0.8) !important;
      border-radius: 24px !important;
      padding: 32px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      text-align: center !important;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
      width: 100% !important;
    }
    .alert-icon-wrapper {
      width: 56px !important;
      height: 56px !important;
      border-radius: 50% !important;
      background-color: #fee2e2 !important;
      color: #ef4444 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin-bottom: 16px !important;
      box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.1) !important;
    }
    .alert-icon {
      font-size: 28px !important;
      width: 28px !important;
      height: 28px !important;
    }
    .alert-title {
      font-size: 18px !important;
      font-weight: 700 !important;
      color: #0f172a !important;
      margin: 0 0 8px 0 !important;
      font-family: 'Roboto', sans-serif !important;
    }
    .alert-message {
      font-size: 13px !important;
      font-weight: 400 !important;
      color: #475569 !important;
      line-height: 1.6 !important;
      margin: 0 0 24px 0 !important;
      font-family: 'Roboto', sans-serif !important;
    }
    .alert-confirm-btn {
      background-color: #0f172a !important;
      color: #ffffff !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      padding: 10px 24px !important;
      border-radius: 12px !important;
      border: none !important;
      cursor: pointer !important;
      transition: all 0.2s ease-in-out !important;
      box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.15) !important;
      width: 100% !important;
    }
    .alert-confirm-btn:hover {
      background-color: #1e293b !important;
      transform: translateY(-1px) !important;
    }
    .alert-confirm-btn:active {
      transform: translateY(0) !important;
    }
  `]
})
export class BackgroundStudioComponent {
  readonly stateService = inject(CampaignStateService);

  // Preview overlay signals
  readonly previewImageUrl = signal<string | null>(null);
  readonly alertMessage = signal<string | null>(null);

  // 1. Shop signals
  readonly selectedShopId = signal<string>('shop-1');
  readonly shopSearchQuery = signal<string>('');
  readonly mockShops = signal<Array<{ id: string, name: string }>>([
    { id: '123456789', name: 'REWE Online-Shop' },
    { id: '987654321', name: 'PENNY Markt' },
    { id: '555666777', name: 'ZooRoyal' },
    { id: '888999000', name: 'toom Baumarkt' }
  ]);

  readonly filteredShops = computed(() => {
    const query = this.shopSearchQuery().trim().toLowerCase();
    const list = this.mockShops();
    if (!query) return list;
    return list.filter(s => s.name.toLowerCase().includes(query) || s.id.includes(query));
  });

  // 2. Product selectors
  readonly productSearchQuery = signal<string>('');
  readonly selectedProductIds = signal<string[]>([]);

  readonly filteredProducts = computed<MerchantProduct[]>(() => {
    const list = this.stateService.merchantProducts();
    const query = this.productSearchQuery().trim().toLowerCase();
    if (!query) return list;
    return list.filter(p => p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query) || p.id.toLowerCase().includes(query));
  });

  // Limited products list - max 10 shown as requested
  readonly limitedProducts = computed<MerchantProduct[]>(() => {
    return this.filteredProducts().slice(0, 10);
  });

  readonly isAllFilteredSelected = computed<boolean>(() => {
    const shown = this.limitedProducts();
    const selected = this.selectedProductIds();
    if (shown.length === 0) return false;
    return shown.every(p => selected.includes(p.id));
  });

  // 3. Workflow action signals
  readonly selectedFlow = signal<string>('flow1');

  // Flows 1 & 2 signals
  readonly schedulingStart = signal<string>('2026-11-15');
  readonly schedulingEnd = signal<string>('2027-01-15');
  readonly seasonality = signal<string>('Winter');
  readonly scene = signal<string>('Living Room');
  readonly sharpness = signal<string>('blurred');
  readonly style = signal<string>('elegant');
  readonly lighting = signal<string>('bright');
  readonly userComment = signal<string>('');

  // Dynamic automatic EN prompt generator
  readonly compiledEnPrompt = computed<string>(() => {
    const seasonalText = this.seasonality();
    const sharpText = this.sharpness();
    const styleText = this.style();
    const lightText = this.lighting();
    const sceneText = this.scene().toLowerCase();
    const optComment = this.userComment().trim();

    return `Generate a background image for the season of ${seasonalText}. The background sharpness should be ${sharpText}. The image should be created in the style of: ${styleText} and with the lighting: ${lightText}. Create an image showing the scene: ${sceneText}.${optComment ? ' ' + optComment : ''}`;
  });

  // Flow 3 Hex Color signals
  readonly hexColor = signal<string>('#4A90E2');

  // Flow 5 Delete Labels signals
  readonly deleteLabels = signal<Array<{ name: string; active: boolean }>>([
    { name: 'Winter', active: true },
    { name: 'Backdrop', active: true },
    { name: 'Summer', active: false },
    { name: 'Spring', active: false },
    { name: 'Autumn', active: false },
    { name: 'Christmas', active: false }
  ]);

  readonly activeDeleteLabelsCount = computed<number>(() => {
    return this.deleteLabels().filter(l => l.active).length;
  });

  // Rejection/Regeneration comments
  readonly commentInputs = signal<Record<string, string>>({});
  readonly regenerationComments: Record<string, string> = {};
  showRegenPanel: Record<string, boolean> = {};

  readonly activeReviewDeckCount = computed<number>(() => {
    return this.stateService.merchantProducts().filter((p: MerchantProduct) => p.bgGenerationStatus !== 'idle').length;
  });

  toggleProduct(id: string): void {
    this.selectedProductIds.update(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  }

  toggleSelectAll(): void {
    const shown = this.limitedProducts();
    if (this.isAllFilteredSelected()) {
      const shownIds = shown.map(p => p.id);
      this.selectedProductIds.update(prev => prev.filter(id => !shownIds.includes(id)));
    } else {
      const currentSelected = this.selectedProductIds();
      const nextSelected = Array.from(new Set([...currentSelected, ...shown.map(p => p.id)]));
      this.selectedProductIds.set(nextSelected);
    }
  }

  updateCommentInput(productId: string, value: string): void {
    this.commentInputs.update(prev => ({ ...prev, [productId]: value }));
  }

  updateRegenComment(productId: string, value: string): void {
    this.regenerationComments[productId] = value;
  }

  toggleDeleteLabel(name: string): void {
    this.deleteLabels.update(list => list.map(l => l.name === name ? { ...l, active: !l.active } : l));
  }

  handleBulkDelete(dialog: HTMLDialogElement): void {
    // Collect active labels to delete
    const activeLabelsText = this.deleteLabels().filter(l => l.active).map(l => `"${l.name}"`).join(', ');
    
    // Set message and open custom centered modal
    this.alertMessage.set(`Backdrop assets linked with labels [ ${activeLabelsText} ] have been successfully deleted from both the database and the Merchant Center feed.`);
    dialog.showModal();
    
    // Reset active deletion checks
    this.deleteLabels.update(list => list.map(l => ({ ...l, active: false })));
  }

  handleBulkGenerate(): void {
    const selectedIds = this.selectedProductIds();
    if (selectedIds.length === 0) return;

    // Set statuses to generating
    const products = this.stateService.merchantProducts();
    const updatedProducts = products.map((p: MerchantProduct) => {
      if (selectedIds.includes(p.id)) {
        return {
          ...p,
          bgGenerationStatus: 'generating' as const
        };
      }
      return p;
    });
    this.stateService.updateBulkProducts(updatedProducts);

    // Simulate completion progressively
    selectedIds.forEach((id, index) => {
      setTimeout(() => {
        const targetProduct = this.stateService.merchantProducts().find((p: MerchantProduct) => p.id === id);
        if (!targetProduct) return;

        const vibeMatch = Math.floor(Math.random() * 12) + 85; // 85-97%
        const compliantDetails = {
          technicalPassed: true,
          safeZonePassed: true,
          logoDetected: Math.random() > 0.15,
          textDensityPassed: true,
          vibeScore: vibeMatch
        };

        const generatedProduct: MerchantProduct = {
          ...targetProduct,
          bgGenerationStatus: 'completed',
          generatedImageUrl: mockGeneratedBackgrounds[id] || 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=500&q=80',
          brandScore: vibeMatch,
          complianceDetails: compliantDetails
        };

        this.stateService.updateProduct(generatedProduct);
      }, (index + 1) * 120);
    });

    this.selectedProductIds.set([]);
  }

  handleConfirm(id: string): void {
    const target = this.stateService.merchantProducts().find((p: MerchantProduct) => p.id === id);
    if (!target) return;
    this.stateService.updateProduct({
      ...target,
      bgGenerationStatus: 'completed',
      rejectionComment: undefined
    });
  }

  handleReject(id: string): void {
    const comment = this.commentInputs()[id] || 'Dimensions look perfect, but contrast is slightly low.';
    const target = this.stateService.merchantProducts().find((p: MerchantProduct) => p.id === id);
    if (!target) return;

    this.stateService.updateProduct({
      ...target,
      bgGenerationStatus: 'rejected',
      rejectionComment: comment
    });

    this.commentInputs.update(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  handleRegenerate(id: string): void {
    const target = this.stateService.merchantProducts().find((p: MerchantProduct) => p.id === id);
    if (!target) return;

    this.stateService.updateProduct({
      ...target,
      bgGenerationStatus: 'generating'
    });

    this.showRegenPanel[id] = false;

    // Retrieve typed regeneration comment to append to optional prompt if present
    const regenFeedback = this.regenerationComments[id] || '';
    if (regenFeedback) {
      // Set as a mock userComment override
      this.userComment.set(regenFeedback);
    }

    setTimeout(() => {
      const updated: MerchantProduct = {
        ...target,
        bgGenerationStatus: 'completed',
        generatedImageUrl: mockGeneratedBackgrounds[id] ? `${mockGeneratedBackgrounds[id]}?sig=${Date.now()}` : undefined,
        brandScore: Math.floor(Math.random() * 8) + 90, // higher on second run
        rejectionComment: undefined
      };
      this.stateService.updateProduct(updated);
      
      // Clean up feedback comment
      delete this.regenerationComments[id];
    }, 200);
  }

  handleClosePreview(dialog: HTMLDialogElement): void {
    dialog.close();
    this.previewImageUrl.set(null);
  }

  handleCloseAlert(dialog: HTMLDialogElement): void {
    dialog.close();
    this.alertMessage.set(null);
  }
}
