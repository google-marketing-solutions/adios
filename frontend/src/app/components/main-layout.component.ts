/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../services/api.service';
import { CampaignStateService } from '../services/campaign-state.service';
import { SidebarComponent } from './sidebar.component';
import { AssetUploaderComponent } from '../campaign/asset-uploader.component';
import { BackgroundStudioComponent } from '../product/background-studio.component';
import { AnimationComponent } from '../video/animation.component';
import { SpellCheckComponent } from '../text/spell-check.component';
import { SettingsPanelComponent } from '../config/settings-panel.component';
import { ProtectedAssetsComponent } from '../campaign/protected-assets.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    SidebarComponent,
    AssetUploaderComponent,
    BackgroundStudioComponent,
    AnimationComponent,
    SpellCheckComponent,
    SettingsPanelComponent,
    ProtectedAssetsComponent
  ],
  template: `
    <div class="main-layout font-sans">
      <!-- Sidebar Navigation -->
      <app-sidebar class="shrink-0"></app-sidebar>

      <!-- Main Workspace Frame -->
      <div class="grow flex flex-col min-w-0 overflow-hidden bg-slate-50">
        
        <!-- Top bar header -->
        <header class="topbar h-16 bg-white border-b px-8 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <span class="client-id text-xs font-bold px-2 py-1 rounded select-all">
              CLIENT ID: 994-118-2026
            </span>
            <div class="divider h-4 w-px bg-slate-200 hidden sm:block"></div>
            <p class="connected-text text-xs text-slate-500 font-medium hidden sm:block m-0">
              Connected Channels: <strong class="text-slate-700">Google Ads & Merchant Center</strong>
            </p>
          </div>

          <div class="flex items-center gap-4">
            <!-- Documentation -->
            <a 
              href="https://support.google.com/google-ads/answer/10724492" 
              target="_blank" 
              rel="noreferrer"
              class="docs-link flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-semibold"
            >
              <span>PMax Asset Specifications</span>
              <mat-icon class="text-xs">open_in_new</mat-icon>
            </a>

            <div class="divider h-4 w-px bg-slate-200"></div>

            <!-- AI Engine Stats indicator -->
            <div class="ai-status flex items-center gap-2 text-xs px-3 py-1 rounded font-medium">
              <mat-icon class="text-xs">auto_awesome</mat-icon>
              <span>AI Engine: Online</span>
            </div>
          </div>
        </header>

        <!-- Dynamic content scroll frame -->
        <main class="workspace-content">
          @switch (stateService.activeSection()) {
            @case ('uploader') {
              <app-asset-uploader></app-asset-uploader>
            }
            @case ('background') {
              <app-background-studio></app-background-studio>
            }
            @case ('animation') {
              <app-animation></app-animation>
            }
            @case ('spell') {
              <app-spell-check></app-spell-check>
            }
            @case ('settings') {
              <app-settings-panel></app-settings-panel>
            }
            @case ('protection') {
              <app-protected-assets></app-protected-assets>
            }
          }
        </main>
      </div>
    </div>
  `,
  styles: [`
    .main-layout {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }
    .topbar {
      border-color: #dadce0;
    }
    .client-id {
      color: #5f6368;
      background-color: #f1f3f4;
      border: 1px solid #dadce0;
      letter-spacing: 0.5px;
    }
    .divider {
      background-color: #dadce0;
    }
    .docs-link {
      text-decoration: none;
      transition: color 0.2s ease;
    }
    .docs-link mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .ai-status {
      background-color: #e6f4ea;
      border: 1px solid #ceead6;
      color: #137333;
    }
    .text-brand {
      color: #1a73e8;
    }
    .text-emerald {
      color: #1e8e3e;
    }
    .text-rose {
      color: #d93025;
    }
    .loading-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #5f6368;
      animation: blink 1s infinite alternate;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .status-dot.green {
      background-color: #1e8e3e;
    }
    .status-dot.red {
      background-color: #d93025;
    }
    @keyframes blink {
      from { opacity: 0.4; }
      to { opacity: 1; }
    }
  `]
})
export class MainLayoutComponent {
  readonly apiService = inject(ApiService);
  readonly stateService = inject(CampaignStateService);

  constructor() {
    this.apiService.checkHealth();
  }
}
