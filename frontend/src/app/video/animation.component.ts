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

@Component({
  selector: 'app-animation',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, ComplianceBadgeComponent],
  template: `
    <div class="space-y-6" id="animation-studio">
      <!-- Title & Header -->
      <div>
        <h2 class="font-bold text-lg text-slate-800 m-0">Animation Machine (Scene-Machine 2.0)</h2>
        <p class="text-xs text-muted m-0 mt-1">
          Generate high-conversion animated videos from static product images. Upload results directly to the Merchant Center <span class="font-mono bg-slate-100 text-slate-700 px-1 rounded text-[11px] font-semibold">[video_link]</span> attribute.
        </p>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        <!-- Left column: Selector & Configuration -->
        <div class="xl:col-span-1 space-y-6">
          <div class="panel bg-white border rounded p-5 shadow-sm space-y-4">
            <h3 class="font-bold text-xs uppercase text-slate-400 tracking-wider m-0">
              1. Animation Queue
            </h3>

            <!-- Filter controls -->
            <div class="space-y-3">
              <div class="relative">
                <mat-icon class="absolute left-3 top-2.5 text-slate-400 icon-size">search</mat-icon>
                <input 
                  type="text" 
                  placeholder="Filter products..." 
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                  class="w-full text-xs pl-8 pr-3 py-2 border rounded bg-slate-50 focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="flex gap-2">
                @for (cat of ['All', 'Food', 'Non-Food']; track cat) {
                  <button
                    (click)="selectedCategory.set(cat)"
                    [class]="'flex-1 py-1 rounded text-xs font-bold transition-all border cursor-pointer ' + (selectedCategory() === cat ? 'bg-amber border-amber text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')"
                  >
                    {{ cat }}
                  </button>
                }
              </div>
            </div>

            <!-- Products Table list -->
            <div class="table-container border rounded overflow-hidden max-h-[240px] overflow-y-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50 text-slate-500 border-b font-medium text-[10px] uppercase">
                    <th class="p-2.5 text-center w-8">
                      <input 
                        type="checkbox" 
                        [checked]="isAllFilteredSelected()"
                        (change)="toggleSelectAll()"
                        class="rounded cursor-pointer"
                      />
                    </th>
                    <th class="p-2.5">Product SKU / Title</th>
                    <th class="p-2.5 text-right">Video</th>
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
                        <span [class]="'badge-status px-1 rounded text-[8px] font-bold uppercase ' + getStatusClass(p.animationStatus)">
                          {{ p.animationStatus }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- Physics engine parameters -->
          <div class="panel bg-white border rounded p-5 shadow-sm space-y-4">
            <h3 class="font-bold text-xs uppercase text-slate-400 tracking-wider m-0">
              2. Simulation Parameters
            </h3>

            <div class="space-y-3.5">
              <div class="space-y-1">
                <div class="flex justify-between text-xs font-bold text-slate-700">
                  <span>Target Video Duration</span>
                  <span class="text-amber-600 font-mono font-bold">{{ videoDuration() }}s</span>
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="15" 
                  [ngModel]="videoDuration()"
                  (ngModelChange)="videoDuration.set($event)"
                  class="w-full accent-amber-500 cursor-pointer"
                />
                <p class="text-[9px] text-slate-400 leading-normal m-0 mt-1">
                  PMax optimization suggests 6s for dynamic bumper ads.
                </p>
              </div>

              <div class="space-y-1">
                <div class="flex justify-between text-xs font-bold text-slate-700">
                  <span>Physics / Flow Strength</span>
                  <span class="text-amber-600 font-mono font-bold">{{ customPhysicsStrength() }}%</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="100" 
                  [ngModel]="customPhysicsStrength()"
                  (ngModelChange)="customPhysicsStrength.set($event)"
                  class="w-full accent-amber-500 cursor-pointer"
                />
                <p class="text-[9px] text-slate-400 leading-normal m-0 mt-1">
                  Controls gravity velocity of falling kibble, or bubble speed in aquariums.
                </p>
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-700 block">Render Framerate (FPS)</label>
                <div class="grid grid-cols-2 gap-2 mt-1">
                  @for (fps of [24, 30]; track fps) {
                    <button
                      (click)="frameRate.set(fps)"
                      [class]="'py-1.5 rounded border text-xs font-bold transition-all cursor-pointer ' + (frameRate() === fps ? 'bg-amber-light border-amber text-amber-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')"
                    >
                      {{ fps }} FPS (Cinematic)
                    </button>
                  }
                </div>
              </div>
            </div>

            <button
              (click)="handleBulkAnimate()"
              [disabled]="selectedProductIds().length === 0"
              class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded bg-brand hover:bg-brand-dark text-white text-xs font-bold border-none transition-all cursor-pointer shadow-sm disabled:opacity-40"
            >
              <mat-icon class="icon-size">auto_awesome</mat-icon>
              <span>Bulk Render Videos ({{ selectedProductIds().length }})</span>
            </button>
          </div>
        </div>

        <!-- Right column: Reviews Deck -->
        <div class="xl:col-span-2 space-y-6">
          <div class="panel bg-white border rounded p-6 shadow-sm flex flex-col gap-4">
            <div class="flex items-center justify-between border-b pb-3">
              <div>
                <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wide m-0">
                  Animation Review Deck
                </h3>
                <p class="text-xs text-muted mt-1 m-0">
                  Play simulated animations. Approved assets publish automatically as standard HTTPS CDN video links in the Merchant Center feed.
                </p>
              </div>
              <span class="text-[10px] font-mono text-muted uppercase tracking-widest">Video Control Console</span>
            </div>

            <!-- Generated Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto pr-1">
              @for (product of stateService.merchantProducts(); track product.id) {
                @if (product.animationStatus !== 'idle') {
                  @let isGenerating = product.animationStatus === 'generating';
                  @let isRejected = product.animationStatus === 'rejected';
                  @let isPlaying = activePlayId() === product.id;
                  @let isFood = product.category === 'Food';

                  <div 
                    [class.border-rose-200]="isRejected"
                    [class.bg-rose-light]="isRejected"
                    [class.border-amber-250]="isGenerating"
                    [class.bg-amber-light]="isGenerating"
                    class="border rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all bg-white"
                  >
                    <!-- Simulated Interactive Video Screen -->
                    <div class="relative h-44 bg-slate-900 flex items-center justify-center overflow-hidden border-b group">
                      @if (isGenerating) {
                        <div class="text-center space-y-3 p-4">
                          <mat-icon class="text-amber-500 animate-spin mx-auto icon-lg">refresh</mat-icon>
                          <div class="space-y-1">
                            <p class="text-xs font-bold text-amber-400 m-0">Rendering Scene Physics</p>
                            <p class="text-[10px] text-slate-400 font-mono m-0 mt-1">
                              {{ isFood ? 'Simulating food bowl gravity particles...' : 'Filling aquarium safe zones with fluid water...' }}
                            </p>
                          </div>
                        </div>
                      } @else {
                        <div class="relative w-full h-full flex items-center justify-center">
                          <!-- Main background image -->
                          <img 
                            [src]="product.originalImageUrl" 
                            alt="" 
                            [class]="'w-full h-full object-cover transition-all duration-1000 ' + (isPlaying ? 'scale-105 brightness-95' : 'scale-100 brightness-75')"
                          />

                          <!-- CSS Animation Overlays simulating product physics -->
                          @if (isPlaying) {
                            <div class="absolute inset-0 z-10 pointer-events-none overflow-hidden">
                              @if (isFood) {
                                <!-- Food pieces flying down into bowl simulation -->
                                <div class="absolute inset-0">
                                  <div class="particle p-1 absolute top-[-20px] left-1/4 w-3.5 h-3.5 bg-amber-700/80 rounded-full animate-bounce"></div>
                                  <div class="particle p-2 absolute top-[-20px] left-1/2 w-4 h-3 bg-amber-900/90 rounded-md animate-bounce"></div>
                                  <div class="particle p-3 absolute top-[-20px] right-1/4 w-3 h-3 bg-amber-800/80 rounded-full animate-bounce"></div>
                                  
                                  <div class="absolute bottom-6 left-1/3 bg-amber-800/40 border border-amber-900/10 px-1 py-0.5 rounded text-[8px] font-mono text-white select-none">
                                    Bowl Gravity active
                                  </div>
                                </div>
                              } @else {
                                <!-- Aquarium filling with water/bubbles simulation -->
                                <div class="absolute inset-0 bg-blue-500/15">
                                  <div class="bubble b-1 absolute bottom-2 left-1/3 w-2 h-2 border border-white/60 rounded-full animate-ping"></div>
                                  <div class="bubble b-2 absolute bottom-6 right-1/3 w-3 h-3 border border-white/50 rounded-full animate-ping"></div>
                                  <div class="bubble b-3 absolute bottom-1 right-1/4 w-2.5 h-2.5 border border-white/45 rounded-full animate-ping"></div>
                                  
                                  <div class="absolute bottom-6 left-1/3 bg-blue-600/40 border border-blue-400/10 px-1 py-0.5 rounded text-[8px] font-mono text-white select-none">
                                    Water Fill Level: 92%
                                  </div>
                                </div>
                              }
                            </div>
                          }

                          <!-- Play/Pause hover overlay controls -->
                          <div class="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/55 transition-colors z-20">
                            <button
                              (click)="togglePlayback(product.id)"
                              class="p-3 bg-white/20 hover:bg-white/40 border border-white/50 text-white rounded-full transition-all transform hover:scale-110 shadow-lg cursor-pointer"
                            >
                              @if (isPlaying) {
                                <mat-icon class="icon-lg">pause</mat-icon>
                              } @else {
                                <mat-icon class="icon-lg">play_arrow</mat-icon>
                              }
                            </button>
                          </div>

                          <div class="absolute bottom-2.5 left-2.5 bg-black/60 text-white text-[9px] font-mono px-2 py-0.5 rounded z-25 flex items-center gap-1">
                            <mat-icon class="text-amber-400 icon-xs">tv</mat-icon>
                            <span>{{ isFood ? 'Food Physics' : 'Water Elements' }}</span>
                            <span>•</span>
                            <span>{{ videoDuration() }}s (Loop)</span>
                          </div>

                          <!-- Brand compliance overlay -->
                          @if (product.brandScore !== undefined) {
                            <div class="absolute top-2.5 right-2.5 z-25">
                              <app-compliance-badge [score]="product.brandScore" [compact]="true"></app-compliance-badge>
                            </div>
                          }
                        </div>
                      }
                    </div>

                    <!-- Metadata & Actions -->
                    <div class="p-4 grow flex flex-col justify-between gap-4">
                      <div>
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] text-muted font-mono tracking-wider">{{ product.sku }}</span>
                          <span class="text-[10px] text-amber-800 bg-amber-light px-1.5 py-0.5 rounded font-bold">
                            {{ product.category }}
                          </span>
                        </div>
                        <h4 class="font-bold text-xs text-slate-800 m-0 mt-1.5">{{ product.name }}</h4>
                      </div>

                      @if (!isGenerating) {
                        <div class="space-y-3">
                          <!-- Compliance guidelines details block -->
                          @if (product.complianceDetails) {
                            <app-compliance-badge [score]="product.brandScore || 0" [details]="product.complianceDetails"></app-compliance-badge>
                          }

                          @if (isRejected) {
                            <div class="bg-rose-light border border-rose-100 rounded p-3 text-xs space-y-1.5">
                              <p class="font-bold text-rose flex items-center gap-1 m-0">
                                <mat-icon class="icon-size">warning</mat-icon>
                                <span>Animation Rejected</span>
                              </p>
                              <p class="text-slate-600 italic m-0">"{{ product.rejectionComment }}"</p>
                              <button
                                (click)="handleRegenerate(product.id)"
                                class="w-full mt-1.5 py-1.5 px-3 rounded bg-rose text-white font-bold text-xs border-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <mat-icon class="icon-xs">refresh</mat-icon>
                                <span>Re-Simulate Animation</span>
                              </button>
                            </div>
                          } @else {
                            <div class="space-y-2">
                              <!-- Rejection comment text field -->
                              <div class="flex gap-2 items-center">
                                <input 
                                  type="text" 
                                  placeholder="Write simulation adjustments..."
                                  [ngModel]="commentInputs()[product.id] || ''"
                                  (ngModelChange)="updateCommentInput(product.id, $event)"
                                  class="grow text-xs border rounded px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:outline-none transition-all"
                                />
                                <button
                                  (click)="handleReject(product.id)"
                                  class="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-light border hover:border-rose-250 text-slate-500 hover:text-rose rounded text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
                                  title="Reject animation"
                                >
                                  <mat-icon class="icon-size">close</mat-icon>
                                  <span>Reject</span>
                                </button>
                              </div>

                              <div class="space-y-1.5">
                                <button
                                  (click)="handleConfirm(product.id)"
                                  class="w-full py-2 px-4 rounded bg-amber hover:bg-amber-dark text-white font-bold text-xs border-none transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                                >
                                  <mat-icon class="icon-size">check</mat-icon>
                                  <span>Confirm & Upload Video Link</span>
                                </button>
                                @if (product.animationUrl) {
                                  <p class="text-[9px] text-muted font-mono text-center truncate select-all m-0" [title]="product.animationUrl">
                                    video_link: {{ product.animationUrl }}
                                  </p>
                                }
                              </div>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              }
              @if (activeAnimationCount() === 0) {
                <div class="col-span-2 text-center py-20 border border-dashed rounded-2xl space-y-3">
                  <mat-icon class="text-slate-300 mx-auto icon-lg">movie</mat-icon>
                  <p class="text-xs text-muted m-0">Animation deck is empty.</p>
                  <p class="text-[10px] text-muted max-w-xs mx-auto m-0 mt-1">
                    Select products on the left and click "Bulk Render Videos" to generate the required PMax video assets automatically using Scene-Machine.
                  </p>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Summary of Rejected Animations -->
      @if (rejectedAnimations().length > 0) {
        <div class="panel bg-white border rounded p-6 shadow-sm space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 class="font-bold text-xs text-slate-800 flex items-center gap-2 uppercase tracking-wide m-0">
                <mat-icon class="text-rose icon-size">warning</mat-icon>
                Rejected Animations Directory ({{ rejectedAnimations().length }})
              </h3>
              <p class="text-xs text-muted mt-1 m-0">
                Summary details of rejected product animations showing item SKU IDs and revision notes for bulk reprocessing.
              </p>
            </div>
            <button 
              (click)="retryAllRejected()"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-light border border-rose-250 text-rose hover:bg-rose-light/50 text-xs font-bold cursor-pointer transition-colors"
            >
              <mat-icon class="icon-xs">refresh</mat-icon>
              Re-Animate Bulk List
            </button>
          </div>

          <div class="table-container border rounded overflow-hidden">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-500 border-b font-medium">
                  <th class="p-3">Product SKU</th>
                  <th class="p-3">Product Name</th>
                  <th class="p-3">Category</th>
                  <th class="p-3">Compliance Score</th>
                  <th class="p-3">Rejection Comment / Prompt Directive</th>
                  <th class="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (p of rejectedAnimations(); track p.id) {
                  <tr class="hover:bg-slate-50/20">
                    <td class="p-3 font-mono text-muted text-[11px] font-bold">{{ p.sku }}</td>
                    <td class="p-3 text-slate-800 font-bold">{{ p.name }}</td>
                    <td class="p-3 text-slate-500">{{ p.category }}</td>
                    <td class="p-3 text-rose font-mono font-medium">{{ p.brandScore }}% (Physics Fault)</td>
                    <td class="p-3 text-slate-600 font-mono text-[11px] leading-normal bg-rose-50/10 font-medium">
                      "{{ p.rejectionComment }}"
                    </td>
                    <td class="p-3 text-right">
                      <button
                        (click)="handleRegenerate(p.id)"
                        class="text-indigo border-none bg-transparent hover:underline font-bold cursor-pointer"
                      >
                        Re-Animate
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
    .text-amber-800 {
      color: #b06000;
    }
    .bg-amber {
      background-color: #f9ab00;
    }
    .bg-amber-light {
      background-color: rgba(249, 171, 0, 0.04);
    }
    .border-amber {
      border-color: #fde293;
    }
    .border-amber-250 {
      border-color: #fde293;
    }
    .bg-rose {
      background-color: #d93025;
    }
    .bg-rose-light {
      background-color: rgba(217, 48, 37, 0.03);
    }
    .border-rose-200 {
      border-color: #fad2cf;
    }
    .border-rose-250 {
      border-color: #f5c2c1;
    }
    .table-container {
      border-color: #dadce0;
      background-color: #ffffff;
    }
    table th {
      border-bottom: 1px solid #dadce0;
    }
    .selected-row {
      background-color: rgba(249, 171, 0, 0.04);
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
    
    /* CSS Particle Animations */
    .particle {
      position: absolute;
      animation: fall linear infinite;
    }
    .particle.p-1 {
      animation-duration: 0.8s;
      animation-delay: 0.1s;
    }
    .particle.p-2 {
      animation-duration: 1.2s;
      animation-delay: 0.3s;
    }
    .particle.p-3 {
      animation-duration: 0.9s;
      animation-delay: 0.5s;
    }
    @keyframes fall {
      0% {
        transform: translateY(-20px) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translateY(180px) rotate(360deg);
        opacity: 0;
      }
    }

    /* CSS Bubble Animations */
    .bubble {
      position: absolute;
      animation: rise linear infinite;
    }
    .bubble.b-1 {
      animation-duration: 2.5s;
    }
    .bubble.b-2 {
      animation-duration: 1.8s;
    }
    .bubble.b-3 {
      animation-duration: 2.2s;
    }
    @keyframes rise {
      0% {
        transform: translateY(160px) scale(0.6);
        opacity: 0.2;
      }
      50% {
        opacity: 0.8;
      }
      100% {
        transform: translateY(-20px) scale(1.1);
        opacity: 0;
      }
    }
  `]
})
export class AnimationComponent {
  readonly stateService = inject(CampaignStateService);

  // Selector states
  readonly selectedCategory = signal<string>('All');
  readonly searchQuery = signal<string>('');
  readonly selectedProductIds = signal<string[]>([]);
  readonly activePlayId = signal<string | null>(null);

  // Parameters
  readonly videoDuration = signal<number>(6);
  readonly customPhysicsStrength = signal<number>(80);
  readonly frameRate = signal<number>(30);

  // Rejection comments state
  readonly commentInputs = signal<Record<string, string>>({});

  // Filter products based on search & category
  readonly filteredProducts = computed<MerchantProduct[]>(() => {
    const productsList = this.stateService.merchantProducts();
    const cat = this.selectedCategory();
    const query = this.searchQuery().toLowerCase().trim();

    return productsList.filter((p: MerchantProduct) => {
      const matchesCategory = cat === 'All' || p.category === cat;
      const matchesSearch = !query || 
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  });

  readonly isAllFilteredSelected = computed<boolean>(() => {
    const filtered = this.filteredProducts();
    const selected = this.selectedProductIds();
    if (filtered.length === 0) return false;
    return filtered.every(p => selected.includes(p.id));
  });

  readonly activeAnimationCount = computed<number>(() => {
    return this.stateService.merchantProducts().filter((p: MerchantProduct) => p.animationStatus !== 'idle').length;
  });

  readonly rejectedAnimations = computed<MerchantProduct[]>(() => {
    return this.stateService.merchantProducts().filter((p: MerchantProduct) => p.animationStatus === 'rejected');
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

  togglePlayback(productId: string): void {
    this.activePlayId.update(prev => prev === productId ? null : productId);
  }

  updateCommentInput(productId: string, value: string): void {
    this.commentInputs.update(prev => ({ ...prev, [productId]: value }));
  }

  handleBulkAnimate(): void {
    const selectedIds = this.selectedProductIds();
    if (selectedIds.length === 0) return;

    // Set to generating
    const products = this.stateService.merchantProducts();
    const updated = products.map((p: MerchantProduct) => {
      if (selectedIds.includes(p.id)) {
        return { ...p, animationStatus: 'generating' as const };
      }
      return p;
    });
    this.stateService.updateBulkProducts(updated);

    selectedIds.forEach((id, index) => {
      setTimeout(() => {
        const targetProduct = this.stateService.merchantProducts().find((p: MerchantProduct) => p.id === id);
        if (!targetProduct) return;

        const vibeScore = Math.floor(Math.random() * 8) + 91;
        const generated: MerchantProduct = {
          ...targetProduct,
          animationStatus: 'completed',
          brandScore: vibeScore,
          animationUrl: `https://storage.googleapis.com/adios-assets-prod/videos/${targetProduct.sku}_scene_machine_30fps.mp4`,
          complianceDetails: {
            technicalPassed: true,
            safeZonePassed: true,
            logoDetected: true,
            textDensityPassed: true,
            vibeScore: vibeScore - 2
          }
        };
        this.stateService.updateProduct(generated);
      }, (index + 1) * 100);
    });

    this.selectedProductIds.set([]);
  }

  handleConfirm(id: string): void {
    const target = this.stateService.merchantProducts().find((p: MerchantProduct) => p.id === id);
    if (!target) return;
    this.stateService.updateProduct({
      ...target,
      animationStatus: 'completed',
      rejectionComment: undefined
    });
  }

  handleReject(id: string): void {
    const comment = this.commentInputs()[id] || 'The food particles fall slightly too fast, making the packaging text unreadable.';
    const target = this.stateService.merchantProducts().find((p: MerchantProduct) => p.id === id);
    if (!target) return;

    this.stateService.updateProduct({
      ...target,
      animationStatus: 'rejected',
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
      animationStatus: 'generating'
    });

    setTimeout(() => {
      this.stateService.updateProduct({
        ...target,
        animationStatus: 'completed',
        animationUrl: `https://storage.googleapis.com/adios-assets-prod/videos/${target.sku}_scene_machine_revised.mp4`,
        brandScore: Math.floor(Math.random() * 5) + 95,
        rejectionComment: undefined
      });
    }, 100);
  }

  retryAllRejected(): void {
    const rejected = this.rejectedAnimations();
    rejected.forEach(p => this.handleRegenerate(p.id));
  }

  getStatusClass(status: string): string {
    if (status === 'idle') return 'badge-status-idle';
    if (status === 'generating') return 'badge-status-generating';
    if (status === 'rejected') return 'badge-status-rejected';
    return 'badge-status-completed';
  }
}
