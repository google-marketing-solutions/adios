/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CampaignStateService } from '../services/campaign-state.service';
import { CategoryPreset } from '../models/types';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="panel bg-white border rounded shadow-sm overflow-hidden" id="settings-panel">
      <!-- Header -->
      <div class="border-b bg-slate-50/50 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <mat-icon class="text-brand icon-size-lg">settings</mat-icon>
            <h2 class="font-bold text-lg text-slate-800 m-0">Manual Settings Adoption</h2>
          </div>
          <p class="text-xs text-muted m-0 mt-1">
            Configure category-specific settings for background generation, animation rules, and brand scoring.
          </p>
        </div>
        <div class="flex items-center gap-2 self-start sm:self-auto">
          <button
            (click)="handleReset()"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer bg-white"
            title="Reset to defaults"
          >
            <mat-icon class="icon-size">restore</mat-icon>
            Reset Guidelines
          </button>
          <button
            (click)="handleSave()"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded bg-brand hover:bg-brand-dark text-white text-xs font-bold border-none transition-all cursor-pointer shadow-sm"
          >
            <mat-icon class="icon-size">save</mat-icon>
            Adopt Settings
          </button>
        </div>
      </div>

      @if (notification()) {
        <div class="bg-emerald-light border-b px-6 py-3 flex items-center gap-2 text-xs text-emerald font-bold">
          <mat-icon class="text-emerald icon-size">check_circle</mat-icon>
          <span>{{ notification() }}</span>
        </div>
      }

      <!-- Main layout -->
      <div class="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        <!-- Left Side: Category tabs -->
        <div class="p-4 bg-slate-50/30 lg:col-span-1 space-y-1">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 block mb-2">
            Product Categories
          </span>
          @for (preset of localPresets(); track preset.category) {
            <button
              (click)="selectedCategory.set(preset.category)"
              [class]="'w-full text-left px-3 py-2.5 rounded text-xs font-bold transition-all border cursor-pointer ' + (selectedCategory() === preset.category ? 'bg-white border-slate-200 text-brand shadow-xs' : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-100')"
            >
              <div class="flex items-center justify-between">
                <span>{{ preset.category }} Settings</span>
                @if (preset.category === 'Food') {
                  <span class="bg-indigo-light text-brand text-[9px] px-1.5 py-0.5 rounded font-bold">
                    Primary
                  </span>
                }
              </div>
            </button>
          }

          <div class="mt-8 p-3 bg-blue-50/50 rounded border border-blue-100/50 text-[11px] text-blue-700 space-y-1">
            <div class="flex items-center gap-1 font-bold">
              <mat-icon class="text-blue-600 icon-size">info</mat-icon>
              <span>Brand Authority</span>
            </div>
            <p class="leading-relaxed m-0">
              These guidelines act as prompt wrappers and technical filters. Generated assets failing matching constraints will be caught automatically before hitting human QA.
            </p>
          </div>
        </div>

        <!-- Right Side: Specific config settings -->
        @if (activePreset(); as active) {
          <div class="p-6 lg:col-span-3 space-y-6">
            <div class="flex items-center justify-between border-b pb-3">
              <h3 class="font-bold text-xs text-slate-800 m-0">
                Active Configurations for <span class="text-brand font-bold">{{ selectedCategory() }}</span>
              </h3>
              <span class="text-[10px] font-mono text-slate-400">STATUS: ACTIVE RULESET</span>
            </div>

            <div class="space-y-4">
              <!-- Background Prompt wrapper -->
              <div class="space-y-1.5 flex flex-col">
                <div class="flex justify-between items-center">
                  <label class="text-xs font-bold text-slate-700">AI Background Generative Prompt Wrapper</label>
                  <span class="text-[10px] text-slate-400 font-mono">Appended automatically</span>
                </div>
                <textarea
                  [ngModel]="active.backgroundPrompt"
                  (ngModelChange)="handleFieldChange('backgroundPrompt', $event)"
                  rows="3"
                  class="w-full text-xs text-slate-700 bg-slate-50 border rounded p-3 focus:outline-none focus:bg-white transition-all font-sans leading-relaxed"
                  placeholder="Describe the aesthetic and lighting guidelines..."
                ></textarea>
              </div>

              <!-- Animation physics rules -->
              <div class="space-y-1.5 flex flex-col">
                <div class="flex justify-between items-center">
                  <label class="text-xs font-bold text-slate-700">Animation Engine Behavior Preset</label>
                  <span class="text-[10px] text-slate-400 font-mono">Scene Machine 2.0 Integration</span>
                </div>
                <input
                  type="text"
                  [ngModel]="active.animationPreset"
                  (ngModelChange)="handleFieldChange('animationPreset', $event)"
                  class="w-full text-xs text-slate-700 bg-slate-50 border rounded px-3 py-2.5 focus:outline-none focus:bg-white transition-all font-mono"
                  placeholder="Define action triggers..."
                />
              </div>

              <!-- Compliance thresholds sliders -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div class="bg-slate-50 border p-3.5 rounded space-y-2">
                  <div class="flex justify-between text-xs font-bold text-slate-700">
                    <span>Min Compliance Score</span>
                    <span class="text-brand font-mono">{{ active.minComplianceScore }}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="98"
                    [ngModel]="active.minComplianceScore"
                    (ngModelChange)="handleFieldChange('minComplianceScore', $event)"
                    class="w-full accent-brand-500 cursor-pointer"
                  />
                  <p class="text-[10px] text-slate-400 leading-normal m-0">
                    Lower bound threshold. Assets scoring below this will trigger auto-regeneration.
                  </p>
                </div>

                <div class="bg-slate-50 border p-3.5 rounded space-y-2">
                  <div class="flex justify-between text-xs font-bold text-slate-700">
                    <span>Max Text Overlay Density</span>
                    <span class="text-rose font-mono">{{ active.maxTextOverlay }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    [ngModel]="active.maxTextOverlay"
                    (ngModelChange)="handleFieldChange('maxTextOverlay', $event)"
                    class="w-full accent-brand-500 cursor-pointer"
                  />
                  <p class="text-[10px] text-slate-400 leading-normal m-0">
                    Maximum text covering percentage allowed. Important for PMax compliance.
                  </p>
                </div>

                <div class="bg-slate-50 border p-3.5 rounded space-y-2">
                  <div class="flex justify-between text-xs font-bold text-slate-700">
                    <span>Safety Margin padding</span>
                    <span class="text-blue-600 font-mono">{{ active.safetyMargins }}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    [ngModel]="active.safetyMargins"
                    (ngModelChange)="handleFieldChange('safetyMargins', $event)"
                    class="w-full accent-brand-500 cursor-pointer"
                  />
                  <p class="text-[10px] text-slate-400 leading-normal m-0">
                    Safe-zone padding width around product boundaries to protect asset scaling.
                  </p>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .panel {
      border-color: #dadce0;
    }
    .text-brand {
      color: #1a73e8;
    }
    .text-rose {
      color: #d93025;
    }
    .bg-indigo-light {
      background-color: rgba(26, 115, 232, 0.04);
      color: #1a73e8;
    }
    .bg-emerald-light {
      background-color: rgba(30, 142, 62, 0.04);
      color: #1e8e3e;
      border-color: #a8dab5;
    }
    .text-emerald {
      color: #1e8e3e;
    }
    .icon-size-lg {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .icon-size {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  `]
})
export class SettingsPanelComponent {
  readonly stateService = inject(CampaignStateService);

  readonly localPresets = signal<CategoryPreset[]>([]);
  readonly selectedCategory = signal<string>('Food');
  readonly notification = signal<string | null>(null);

  constructor() {
    // Initialise local presets copy from CampaignStateService
    effect(() => {
      const presets = this.stateService.presets();
      this.localPresets.set(JSON.parse(JSON.stringify(presets)));
    }, { allowSignalWrites: true });
  }

  readonly activePreset = computed<CategoryPreset | undefined>(() => {
    const category = this.selectedCategory();
    return this.localPresets().find(p => p.category === category);
  });

  handleFieldChange(field: keyof CategoryPreset, value: any): void {
    const category = this.selectedCategory();
    this.localPresets.update(prev => 
      prev.map(p => {
        if (p.category === category) {
          return { ...p, [field]: value };
        }
        return p;
      })
    );
  }

  handleSave(): void {
    this.stateService.savePresets(this.localPresets());
    this.notification.set('Configuration presets adopted successfully.');
    setTimeout(() => this.notification.set(null), 3000);
  }

  handleReset(): void {
    const defaults: CategoryPreset[] = [
      {
        category: 'Food',
        backgroundPrompt: 'Elegant minimal stone kitchen countertop, warm soft lighting, clean studio background, depth of field, premium look',
        animationPreset: 'Bowl Physics: Product elements gently fall into a beautiful modern ceramic bowl with natural bounce, floating pieces in air',
        minComplianceScore: 90,
        maxTextOverlay: 10,
        safetyMargins: 15
      },
      {
        category: 'Non-Food',
        backgroundPrompt: 'Bright scandinavian cozy living room corner, soft natural light, clean modern furniture, cinematic lens, blurred background',
        animationPreset: 'Water Elements: Clean, pure water bubbling or filling up elegantly in a slow motion splash around the container',
        minComplianceScore: 85,
        maxTextOverlay: 15,
        safetyMargins: 20
      },
      {
        category: 'Apparel',
        backgroundPrompt: 'Abstract premium texture backdrop, pastel gradients, professional studio lighting, high fashion catalog aesthetic',
        animationPreset: 'Elegant Rotate: Smooth 360 rotation with floating brand logo and sparkles',
        minComplianceScore: 92,
        maxTextOverlay: 5,
        safetyMargins: 10
      },
      {
        category: 'Electronics',
        backgroundPrompt: 'Sleek dark futuristic podium, neon edge lighting, dark industrial environment, isometric view, cinematic shadows',
        animationPreset: 'Tech Pulse: Pulse zoom with soft glowing rays and technical telemetry graphics fading in',
        minComplianceScore: 88,
        maxTextOverlay: 20,
        safetyMargins: 15
      }
    ];

    this.localPresets.set(defaults);
    this.stateService.savePresets(defaults);
    this.notification.set('Reset to factory brand guidelines.');
    setTimeout(() => this.notification.set(null), 3000);
  }
}
