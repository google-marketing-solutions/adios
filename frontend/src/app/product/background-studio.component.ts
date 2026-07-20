/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CampaignStateService } from '../services/campaign-state.service';
import { MerchantProduct, CategoryPreset } from '../models/types';
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
  imports: [CommonModule, FormsModule, MatIconModule, ComplianceBadgeComponent],
  template: `
    <div class="space-y-6" id="background-studio">
      <!-- Title & Header -->
      <div>
        <h2 class="font-bold text-lg text-slate-800 m-0">AI Background Studio</h2>
        <p class="text-xs text-muted m-0 mt-1">
          Select Merchant Center products to swap boring studio packshots into stunning seasonal and promotional environments in bulk.
        </p>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        <!-- Left Column: Product Selector & Parameters -->
        <div class="xl:col-span-1 space-y-6">
          <div class="panel bg-white border rounded p-5 shadow-sm space-y-4">
            <h3 class="font-bold text-xs uppercase text-slate-400 tracking-wider m-0">
              1. Merchant Center Catalog
            </h3>

            <!-- Filter controls -->
            <div class="space-y-3">
              <div class="relative">
                <mat-icon class="absolute left-3 top-2.5 text-slate-400 icon-size">search</mat-icon>
                <input 
                  type="text" 
                  placeholder="Filter by SKU, Name or ID..." 
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                  class="w-full text-xs pl-8 pr-3 py-2 border rounded bg-slate-50 focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="flex gap-2">
                @for (cat of ['All', 'Food', 'Non-Food']; track cat) {
                  <button
                    (click)="selectedCategory.set(cat)"
                    [class]="'px-3 py-1 rounded text-xs font-semibold font-inter transition-all border cursor-pointer ' + (selectedCategory() === cat ? 'bg-brand border-brand text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50')"
                  >
                    {{ cat }}
                  </button>
                }
              </div>
            </div>

            <!-- Products selection list -->
            <div class="table-container border rounded overflow-hidden max-h-[260px] overflow-y-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 text-slate-500 border-b font-medium uppercase text-[10px]">
                    <th class="p-2.5 text-center w-8">
                      <input 
                        type="checkbox" 
                        [checked]="isAllFilteredSelected()"
                        (change)="toggleSelectAll()"
                        class="rounded cursor-pointer"
                      />
                    </th>
                    <th class="p-2.5">Product SKU / Name</th>
                    <th class="p-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (p of filteredProducts(); track p.id) {
                    @let isSelected = selectedProductIds().includes(p.id);
                    <tr 
                      (click)="toggleProduct(p.id)"
                      [class.selected-row]="isSelected"
                      class="hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <td class="p-2 text-center" (click)="$event.stopPropagation()">
                        <input 
                          type="checkbox" 
                          [checked]="isSelected"
                          (change)="toggleProduct(p.id)"
                          class="rounded cursor-pointer"
                        />
                      </td>
                      <td class="p-2">
                        <div class="flex items-center gap-2">
                          <img [src]="p.originalImageUrl" class="w-7 h-7 object-cover rounded border shrink-0" />
                          <div class="min-w-0">
                            <p class="font-bold text-slate-700 truncate max-w-[140px] m-0">{{ p.name }}</p>
                            <p class="text-[9px] font-mono text-muted m-0 mt-0.5">{{ p.sku }}</p>
                          </div>
                        </div>
                      </td>
                      <td class="p-2 text-right">
                        <span [class]="'badge-status px-1 rounded text-[8px] font-bold uppercase ' + getStatusClass(p.bgGenerationStatus)">
                          {{ p.bgGenerationStatus }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- Background Settings -->
          <div class="panel bg-white border rounded p-5 shadow-sm space-y-4">
            <h3 class="font-bold text-xs uppercase text-slate-400 tracking-wider m-0">
              2. Generative Parameters
            </h3>

            <!-- Presets -->
            <div class="space-y-1.5 flex flex-col">
              <label class="text-xs font-bold text-slate-700">Seasonal Campaign Theme</label>
              <select 
                [(ngModel)]="seasonalTheme"
                class="text-xs bg-slate-50 border rounded p-2 focus:outline-none focus:bg-white transition-all"
              >
                <option value="Christmas Cozy">🎄 Christmas Cozy Special</option>
                <option value="Summer Sale">☀️ Summer Flash Promotion</option>
                <option value="Modern Editorial">✨ Premium Modern Editorial</option>
                <option value="Spring Nature">🌸 Spring Blooming Garden</option>
                <option value="Custom">🔧 Custom Prompt Overlap</option>
              </select>
            </div>

            <!-- Custom modifier text -->
            @if (seasonalTheme() === 'Custom') {
              <div class="space-y-1 flex flex-col">
                <label class="text-[10px] font-bold text-muted uppercase">Custom Prompt Modifier</label>
                <textarea 
                  [(ngModel)]="customPrompt"
                  placeholder="Describe your background atmosphere..."
                  rows="2"
                  class="text-xs bg-slate-50 border rounded p-2 focus:outline-none focus:bg-white"
                ></textarea>
              </div>
            } @else {
              <div class="p-3 bg-slate-50 rounded border text-[11px] text-slate-500 leading-normal">
                <strong class="text-slate-700 font-bold block mb-1">Appended Prompts Style:</strong>
                {{ activeThemePrompt() }}
              </div>
            }

            <!-- Compliance scoring automatic filter -->
            <div class="flex items-center justify-between border-t pt-3">
              <div class="space-y-0.5">
                <span class="text-xs font-bold text-slate-800 block">Brand Compliance Filter</span>
                <span class="text-[10px] text-muted block leading-normal">Auto-regenerate if score falls below 85%</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  [checked]="enableBrandScoring()" 
                  (change)="enableBrandScoring.set(!enableBrandScoring())" 
                  class="sr-only peer"
                />
                <div class="toggle-bg w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald"></div>
              </label>
            </div>

            <button
              (click)="handleBulkGenerate()"
              [disabled]="selectedProductIds().length === 0"
              class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-brand hover:bg-brand-dark text-white text-xs font-semibold font-inter border-none transition-all cursor-pointer shadow-sm"
            >
              <mat-icon class="icon-size">auto_awesome</mat-icon>
              <span>Bulk Generate backgrounds ({{ selectedProductIds().length }})</span>
            </button>
          </div>
        </div>

        <!-- Right Column: Reviews Deck (Interactive generated grid) -->
        <div class="xl:col-span-2 space-y-6">
          <div class="panel bg-white border rounded p-6 shadow-sm flex flex-col gap-4">
            <div class="flex items-center justify-between border-b pb-3">
              <div>
                <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wide m-0">
                  AI Review Deck / Creative Approval
                </h3>
                <p class="text-xs text-muted mt-1 m-0">
                  Confirm or reject generated backgrounds. Rejected images compile comments to adjust prompt weights.
                </p>
              </div>
              <span class="text-[10px] font-mono text-muted uppercase tracking-widest">Aesthetic Control Room</span>
            </div>

            <!-- Generated Deck List Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto pr-1">
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
                    <!-- Visual Comparison Area -->
                    <div class="relative h-44 bg-slate-100 flex items-center justify-center overflow-hidden border-b">
                      @if (isGenerating) {
                        <div class="text-center space-y-3 p-4">
                          <mat-icon class="text-amber-500 animate-spin mx-auto icon-lg">refresh</mat-icon>
                          <div class="space-y-1">
                            <p class="text-xs font-bold text-amber-800 m-0">Diffusion Composer Active</p>
                            <p class="text-[10px] text-muted font-mono m-0 mt-0.5">Running model/imagen-3...</p>
                          </div>
                        </div>
                      } @else {
                        <div class="relative w-full h-full">
                          <!-- Original small overlay -->
                          <div class="absolute top-2.5 left-2.5 bg-black/60 text-white text-[9px] font-medium px-1.5 py-0.5 rounded z-10">
                            Packshot (Before)
                          </div>
                          
                          <!-- Main Generated Preview image -->
                          <img 
                            [src]="product.generatedImageUrl" 
                            alt="Generated backdrop" 
                            class="w-full h-full object-cover"
                            referrerpolicy="no-referrer"
                          />

                          <!-- Original miniature overlay in bottom right -->
                          <div class="absolute bottom-2.5 right-2.5 border border-white shadow rounded overflow-hidden w-10 h-10 bg-slate-200">
                            <img [src]="product.originalImageUrl" class="w-full h-full object-cover" />
                          </div>

                          <!-- Brand compliance score overlay badge -->
                          @if (product.brandScore !== undefined) {
                            <div class="absolute top-2.5 right-2.5 z-10">
                              <app-compliance-badge [score]="product.brandScore" [compact]="true"></app-compliance-badge>
                            </div>
                          }
                        </div>
                      }
                    </div>

                    <!-- Metadata and Review Interactions -->
                    <div class="p-4 grow flex flex-col justify-between gap-4">
                      <div>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] text-muted font-mono tracking-wider">{{ product.sku }}</span>
                          <span class="text-[10px] text-emerald bg-emerald-light px-1.5 py-0.5 rounded font-bold">
                            {{ product.category }}
                          </span>
                        </div>
                        <h4 class="font-bold text-xs text-slate-800 m-0 mt-1.5">{{ product.name }}</h4>
                      </div>

                      @if (!isGenerating) {
                        <div class="space-y-3">
                          <!-- Compliance Details list if available -->
                          @if (product.complianceDetails) {
                            <app-compliance-badge [score]="product.brandScore || 0" [details]="product.complianceDetails"></app-compliance-badge>
                          }

                          @if (isRejected) {
                            <div class="bg-rose-light border border-rose-100 rounded p-3 text-xs space-y-1.5">
                              <p class="font-bold text-rose flex items-center gap-1 m-0">
                                <mat-icon class="icon-size">warning</mat-icon>
                                <span>Rejected by Creative Team</span>
                              </p>
                              <p class="text-slate-600 italic m-0">"{{ product.rejectionComment }}"</p>
                              <button
                                (click)="handleRegenerate(product.id)"
                                class="w-full mt-1.5 py-1.5 px-3 rounded bg-rose text-white font-bold text-xs border-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <mat-icon class="icon-xs">refresh</mat-icon>
                                <span>Re-Run Background Generator</span>
                              </button>
                            </div>
                          } @else {
                            <div class="space-y-2">
                              <!-- Rejection comment text field -->
                              <div class="flex gap-2 items-center">
                                <input 
                                  type="text" 
                                  placeholder="Write adjustment/rejection feedback..."
                                  [ngModel]="commentInputs()[product.id] || ''"
                                  (ngModelChange)="updateCommentInput(product.id, $event)"
                                  class="grow text-xs border rounded px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:outline-none transition-all"
                                />
                                <button
                                  (click)="handleReject(product.id)"
                                  class="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-light border hover:border-rose-250 text-slate-500 hover:text-rose rounded text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
                                  title="Reject and send comments to optimizer"
                                >
                                  <mat-icon class="icon-size">close</mat-icon>
                                  <span>Reject</span>
                                </button>
                              </div>

                              <button
                                (click)="handleConfirm(product.id)"
                                class="w-full py-2 px-4 rounded bg-brand hover:bg-brand-dark text-white font-bold text-xs border-none transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                              >
                                <mat-icon class="icon-size">check</mat-icon>
                                <span>Confirm & Sync to Merchant Center</span>
                              </button>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              }
              @if (activeReviewDeckCount() === 0) {
                <div class="col-span-2 text-center py-20 border border-dashed rounded-2xl space-y-3">
                  <mat-icon class="text-slate-300 mx-auto icon-lg">folder_open</mat-icon>
                  <p class="text-xs text-muted m-0">Review deck is currently empty.</p>
                  <p class="text-[10px] text-muted max-w-xs mx-auto m-0 mt-1">
                    Select Merchant Center products on the left and click "Bulk Generate" to kick off the AI background compositing loops.
                  </p>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Summary of Rejected Items -->
      @if (rejectedProducts().length > 0) {
        <div class="panel bg-white border rounded p-6 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 class="font-bold text-xs text-slate-800 flex items-center gap-2 uppercase tracking-wide m-0">
                <mat-icon class="text-rose icon-size">warning</mat-icon>
                Rejected Backgrounds Registry ({{ rejectedProducts().length }})
              </h3>
              <p class="text-xs text-muted mt-1 m-0">
                Summary of rejected assets compile feedback comments on item-ID level to prevent LLM hallucination and adjust prompts.
              </p>
            </div>
            <button 
              (click)="retryAllRejected()"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-light border border-rose-250 text-rose hover:bg-rose-light/50 text-xs font-bold cursor-pointer transition-colors"
            >
              <mat-icon class="icon-xs">refresh</mat-icon>
              Retry Bulk Generation
            </button>
          </div>

          <div class="table-container border rounded overflow-hidden">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-500 border-b font-medium">
                  <th class="p-3">Product SKU</th>
                  <th class="p-3">Product Name</th>
                  <th class="p-3">Category</th>
                  <th class="p-3">Compliance score</th>
                  <th class="p-3">Reason for Rejection / Comments</th>
                  <th class="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (p of rejectedProducts(); track p.id) {
                  <tr class="hover:bg-slate-50/20">
                    <td class="p-3 font-mono text-muted text-[11px] font-bold">{{ p.sku }}</td>
                    <td class="p-3 text-slate-800 font-bold">{{ p.name }}</td>
                    <td class="p-3 text-slate-500">{{ p.category }}</td>
                    <td class="p-3 text-rose font-mono font-medium">{{ p.brandScore }}% (Failed Vibe)</td>
                    <td class="p-3 text-slate-600 font-mono text-[11px] leading-normal bg-rose-50/10 font-medium">
                      "{{ p.rejectionComment }}"
                    </td>
                    <td class="p-3 text-right">
                      <button
                        (click)="handleRegenerate(p.id)"
                        class="text-indigo border-none bg-transparent hover:underline font-bold cursor-pointer"
                      >
                        Regenerate
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
  `,
  styles: [`
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
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .peer:checked + .toggle-bg::after {
      transform: translateX(16px);
    }
    .peer:checked + .toggle-bg {
      background-color: #1e8e3e;
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
    .badge-status-idle {
      background-color: #f1f3f4;
      color: #5f6368;
    }
    .badge-status-generating {
      background-color: #fef7e0;
      color: #b06000;
    }
    .badge-status-rejected {
      background-color: #fce8e6;
      color: #c5221f;
    }
    .badge-status-completed {
      background-color: #e6f4ea;
      color: #137333;
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
    .current-images-list {
      max-height: 380px;
      overflow-y: auto;
    }
  `]
})
export class BackgroundStudioComponent {
  readonly stateService = inject(CampaignStateService);

  // Selector states
  readonly selectedCategory = signal<string>('All');
  readonly searchQuery = signal<string>('');
  readonly selectedProductIds = signal<string[]>([]);

  // Generation settings
  readonly seasonalTheme = signal<string>('Christmas Cozy');
  readonly customPrompt = signal<string>('');
  readonly enableBrandScoring = signal<boolean>(true);

  // Rejection comments state
  readonly commentInputs = signal<Record<string, string>>({});

  // Theme Prompts
  readonly themePrompts: Record<string, string> = {
    'Christmas Cozy': 'Decorated warm glowing pine tree branches, soft golden fairy lights bokeh, wooden logs hearth, snowy winter window reflection',
    'Summer Sale': 'Sleek bright sandy texture, soft tropical palm leaf shadows, azure swimming pool water reflection, energetic morning sunshine',
    'Modern Editorial': 'Sleek dark travertine stone block, sophisticated direct studio spotlight, warm shadow plays, editorial high-end minimalist design',
    'Spring Nature': 'Pastel blooming sakura petals falling, dewy meadow grass in soft focus, warm sunbeams, spring air atmospheric volume lighting',
    'Custom': ''
  };

  readonly activeThemePrompt = computed<string>(() => {
    const theme = this.seasonalTheme();
    return this.themePrompts[theme] || this.customPrompt();
  });

  // Filter products based on search & category
  readonly filteredProducts = computed<MerchantProduct[]>(() => {
    const productsList = this.stateService.merchantProducts();
    const cat = this.selectedCategory();
    const query = this.searchQuery().toLowerCase().trim();

    return productsList.filter((p: MerchantProduct) => {
      const matchesCategory = cat === 'All' || p.category === cat;
      const matchesSearch = !query || 
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.id.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  });

  readonly isAllFilteredSelected = computed<boolean>(() => {
    const filtered = this.filteredProducts();
    const selected = this.selectedProductIds();
    if (filtered.length === 0) return false;
    return filtered.every(p => selected.includes(p.id));
  });

  readonly activeReviewDeckCount = computed<number>(() => {
    return this.stateService.merchantProducts().filter((p: MerchantProduct) => p.bgGenerationStatus !== 'idle').length;
  });

  readonly rejectedProducts = computed<MerchantProduct[]>(() => {
    return this.stateService.merchantProducts().filter((p: MerchantProduct) => p.bgGenerationStatus === 'rejected');
  });

  toggleProduct(id: string): void {
    this.selectedProductIds.update(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  }

  toggleSelectAll(): void {
    const filtered = this.filteredProducts();
    if (this.isAllFilteredSelected()) {
      const filteredIds = filtered.map(p => p.id);
      this.selectedProductIds.update(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const currentSelected = this.selectedProductIds();
      const nextSelected = Array.from(new Set([...currentSelected, ...filtered.map(p => p.id)]));
      this.selectedProductIds.set(nextSelected);
    }
  }

  updateCommentInput(productId: string, value: string): void {
    this.commentInputs.update(prev => ({ ...prev, [productId]: value }));
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
        const finalScore = this.enableBrandScoring() ? vibeMatch : Math.floor(Math.random() * 20) + 70;

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
          brandScore: finalScore,
          complianceDetails: compliantDetails
        };

        this.stateService.updateProduct(generatedProduct);
      }, (index + 1) * 100);
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

    setTimeout(() => {
      const updated: MerchantProduct = {
        ...target,
        bgGenerationStatus: 'completed',
        generatedImageUrl: mockGeneratedBackgrounds[id] ? `${mockGeneratedBackgrounds[id]}?sig=${Date.now()}` : undefined,
        brandScore: Math.floor(Math.random() * 8) + 90, // higher on second run
        rejectionComment: undefined
      };
      this.stateService.updateProduct(updated);
    }, 100);
  }

  retryAllRejected(): void {
    const rejected = this.rejectedProducts();
    rejected.forEach(p => this.handleRegenerate(p.id));
  }

  getStatusClass(status: string): string {
    if (status === 'idle') return 'badge-status-idle';
    if (status === 'generating') return 'badge-status-generating';
    if (status === 'rejected') return 'badge-status-rejected';
    return 'badge-status-completed';
  }
}
