/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {CommonModule} from '@angular/common';
import {Component, inject} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {RouterLink} from '@angular/router';
import {ActiveSection} from '../models/types';
import {AuthService} from '../services/auth.service';
import {CampaignStateService} from '../services/campaign-state.service';

interface MenuItem {
  id: ActiveSection;
  route: string;
  label: string;
  description: string;
  icon: string;
  activeColorClass: string;
  activeBorderClass: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  template: `
    <div class="sidebar flex flex-col h-full bg-white border-r select-none">
      <!-- Platform Title -->
      <div class="header-logo p-6 border-b flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="logo-box flex items-center justify-center text-white font-bold">
            Ad
          </div>
          <div>
            <h1 class="font-bold text-sm text-slate-800 leading-none m-0">Adios 2.0</h1>
            <span class="logo-subtitle text-muted font-medium uppercase tracking-wider block mt-1">Asset Automation Platform</span>
          </div>
        </div>
      </div>

      <!-- Navigation Options -->
      <div class="navigation-list grow px-4 py-6 flex flex-col gap-2">
        @for (item of menuItems; track item.id) {
          @let isActive = stateService.activeSection() === item.id;
          <a
            [routerLink]="item.route"
            (click)="stateService.setActiveSection(item.id)"
            [class]="'nav-button w-full text-left p-3 rounded border flex items-start gap-3 transition-all no-underline ' + (isActive ? 'active-nav ' + item.activeBorderClass : 'inactive-nav')"
          >
            <div [class]="'icon-container p-2 rounded border ' + (isActive ? item.activeColorClass : 'bg-light border-light')">
              <mat-icon class="icon-size shrink-0">{{ item.icon }}</mat-icon>
            </div>
            <div class="grow min-w-0">
              <div class="flex items-center justify-between">
                <span [class]="'text-xs font-bold ' + (isActive ? 'text-slate-900' : 'text-slate-700')">
                  {{ item.label }}
                </span>
                @if (item.id === 'spell' && stateService.pendingErrorsCount() > 0) {
                  <span class="badge-error text-white font-bold rounded-full text-xs">
                    {{ stateService.pendingErrorsCount() }}
                  </span>
                }
              </div>
              <p class="text-xs text-muted mt-1 truncate">{{ item.description }}</p>
            </div>
          </a>
        }
      </div>

      <!-- Account Context Footer -->
      @if (authService.currentUser(); as user) {
        <div class="footer p-4 border-t bg-light text-xs text-muted">
          <div class="user-profile flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <img [src]="user.picture" class="user-avatar" alt="User Avatar" />
              <div class="min-w-0">
                <div class="text-xs font-bold text-slate-800 truncate">{{ user.name }}</div>
                <div class="text-[10px] text-slate-500 truncate">{{ user.email }}</div>
              </div>
            </div>
            <button (click)="authService.logout()" class="sign-out-btn flex items-center justify-center" title="Sign Out">
              <mat-icon class="icon-size">logout</mat-icon>
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
    .sidebar {
      width: 288px;
      border-color: #dadce0;
    }
    .header-logo {
      border-color: #f1f3f4;
    }
    .logo-box {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #1a73e8 0%, #34a853 100%);
      font-size: 14px;
    }
    .logo-subtitle {
      font-size: 9px;
    }
    .navigation-list {
      overflow-y: auto;
    }
    .nav-button {
      background-color: transparent;
      border: 1px solid transparent;
      border-left-width: 4px;
      cursor: pointer;
      text-decoration: none !important;
      color: inherit;
    }
    .nav-button, .nav-button *, .nav-button:hover, .nav-button:focus, .nav-button:active, .nav-button:visited {
      text-decoration: none !important;
    }
    .nav-button:hover {
      background-color: #f8f9fa;
    }
    .active-nav {
      background-color: #f1f3f4;
      border-top-color: #dadce0;
      border-right-color: #dadce0;
      border-bottom-color: #dadce0;
    }
    .border-uploader-active { border-left-color: #1a73e8; }
    .border-background-active { border-left-color: #1e8e3e; }
    .border-animation-active { border-left-color: #f9ab00; }
    .border-spell-active { border-left-color: #d93025; }
    .border-settings-active { border-left-color: #5f6368; }
    .icon-container {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bg-light {
      background-color: #f8f9fa;
    }
    .border-light {
      border-color: #f1f3f4;
    }
    .icon-size {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    /* Menu colors active */
    .icon-uploader-active {
      color: #1a73e8;
      background-color: rgba(26, 115, 232, 0.1);
      border-color: rgba(26, 115, 232, 0.2);
    }
    .icon-background-active {
      color: #1e8e3e;
      background-color: rgba(30, 142, 62, 0.1);
      border-color: rgba(30, 142, 62, 0.2);
    }
    .icon-animation-active {
      color: #f9ab00;
      background-color: rgba(249, 171, 0, 0.1);
      border-color: rgba(249, 171, 0, 0.2);
    }
    .icon-spell-active {
      color: #d93025;
      background-color: rgba(217, 48, 37, 0.1);
      border-color: rgba(217, 48, 37, 0.2);
    }
    .icon-settings-active {
      color: #5f6368;
      background-color: rgba(95, 99, 104, 0.1);
      border-color: rgba(95, 99, 104, 0.2);
    }
    .icon-protection-active {
      color: #4f46e5;
      background-color: rgba(79, 70, 229, 0.1);
      border-color: rgba(79, 70, 229, 0.2);
    }
    .border-protection-active {
      border-left-color: #4f46e5;
    }
    .badge-error {
      background-color: #d93025;
      padding: 2px 6px;
      line-height: 1;
      font-size: 10px;
    }
    .footer {
      border-color: #f1f3f4;
      background-color: #f8f9fa;
    }
    .connected-indicator {
      color: #1e8e3e;
      font-size: 10px;
    }
    .pb-2 {
      padding-bottom: 8px;
    }
    .user-profile {
      border-top: 1px solid #dadce0;
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid #dadce0;
      background-color: #f1f3f4;
      object-fit: cover;
    }
    .sign-out-btn {
      width: 28px;
      height: 28px;
      border-radius: 4px;
      border: none;
      background-color: transparent;
      color: #5f6368;
      cursor: pointer;
      transition: background-color 0.2s, color 0.2s;
    }
    .sign-out-btn:hover {
      background-color: #f1f3f4;
      color: #d93025;
    }
  `,
  ],
})
export class SidebarComponent {
  readonly stateService = inject(CampaignStateService);
  readonly authService = inject(AuthService);

  readonly menuItems: MenuItem[] = [
    {
      id: 'uploader',
      route: '/uploader',
      label: 'Asset Group Uploader',
      description: 'Image deployment & KPI replacement',
      icon: 'cloud_upload',
      activeColorClass: 'icon-uploader-active',
      activeBorderClass: 'border-uploader-active',
    },
    {
      id: 'protection',
      route: '/image-protector',
      label: 'Image Protector',
      description: 'Account-wide protected assets',
      icon: 'shield',
      activeColorClass: 'icon-protection-active',
      activeBorderClass: 'border-protection-active',
    },
    {
      id: 'background',
      route: '/background-studio',
      label: 'AI Image Studio',
      description: 'Seasonal background replacement',
      icon: 'image',
      activeColorClass: 'icon-background-active',
      activeBorderClass: 'border-background-active',
    },
    {
      id: 'animation',
      route: '/animation-machine',
      label: 'Animation Machine',
      description: 'PMax video link asset generation',
      icon: 'movie',
      activeColorClass: 'icon-animation-active',
      activeBorderClass: 'border-animation-active',
    },
    {
      id: 'spell',
      route: '/spell-check',
      label: 'Spell Check Center',
      description: 'Headline & description audit',
      icon: 'spellcheck',
      activeColorClass: 'icon-spell-active',
      activeBorderClass: 'border-spell-active',
    },
    {
      id: 'settings',
      route: '/rules-presets',
      label: 'Rules & Presets',
      description: 'Category configs & brand guidelines',
      icon: 'tune',
      activeColorClass: 'icon-settings-active',
      activeBorderClass: 'border-settings-active',
    },
  ];
}
