/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {CommonModule} from '@angular/common';
import {Component, inject, OnInit} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {ActivatedRoute} from '@angular/router';
import {AssetUploaderComponent} from '../campaign/asset-uploader.component';
import {ProtectedAssetsComponent} from '../campaign/protected-assets.component';
import {SettingsPanelComponent} from '../config/settings-panel.component';
import {BackgroundStudioComponent} from '../product/background-studio.component';
import {ApiService} from '../services/api.service';
import {CampaignStateService} from '../services/campaign-state.service';
import {SpellCheckComponent} from '../text/spell-check.component';
import {AnimationComponent} from '../video/animation.component';
import {SidebarComponent} from './sidebar.component';

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
    ProtectedAssetsComponent,
  ],
  template: `
    <div class="main-layout font-sans">
      <!-- Sidebar Navigation -->
      <app-sidebar class="shrink-0"></app-sidebar>

      <!-- Main Workspace Frame -->
      <div class="grow flex flex-col min-w-0 overflow-hidden bg-slate-50">
        
        <!-- Dynamic content scroll frame -->
        <main class="workspace-content h-full w-full">
          @switch (stateService.activeSection()) {
            @case ('uploader') {
              <app-asset-uploader></app-asset-uploader>
            }
            @case ('protection') {
              <app-protected-assets></app-protected-assets>
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
          }
        </main>
      </div>
    </div>
  `,
  styles: [
    `
    .main-layout {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }
  `,
  ],
})
export class MainLayoutComponent implements OnInit {
  readonly apiService = inject(ApiService);
  readonly stateService = inject(CampaignStateService);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    this.apiService.checkHealth();
  }

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      if (data['section']) {
        this.stateService.setActiveSection(data['section']);
      }
    });
  }
}
