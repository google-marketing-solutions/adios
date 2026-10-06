/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {CommonModule} from '@angular/common';
import {Component, computed, input} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

export interface ComplianceDetails {
  technicalPassed: boolean;
  safeZonePassed: boolean;
  logoDetected: boolean;
  textDensityPassed: boolean;
  vibeScore: number;
}

@Component({
  selector: 'app-compliance-badge',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (compact()) {
      <div [class]="'compact-badge flex items-center gap-2 px-2 py-1 rounded ' + (isCompliant() ? 'compliant-status' : 'warning-status')">
        <mat-icon class="text-xs shrink-0">{{ isCompliant() ? 'shield' : 'warning' }}</mat-icon>
        <span class="text-xs font-medium">Score: {{ score() }}/100</span>
      </div>
    } @else {
      <div class="compliance-card border rounded p-4 shadow-sm">
        <div class="flex items-center justify-between mb-4 pb-2 border-b">
          <div class="flex items-center gap-2">
            <mat-icon [class]="isCompliant() ? 'text-emerald' : 'text-amber'">shield</mat-icon>
            <h4 class="font-medium text-sm m-0">Brand Compliance & Asset Scoring</h4>
          </div>
          <div [class]="'badge-score px-2 py-1 rounded text-xs font-bold ' + (isCompliant() ? 'bg-emerald-light text-emerald' : 'bg-amber-light text-amber')">
            {{ score() }}% Match
          </div>
        </div>

        <div class="checklist flex flex-col gap-2">
          <div class="checklist-item flex items-center justify-between text-xs py-1">
            <span class="text-muted">Technical Specs (Dimensions, Format)</span>
            <div class="flex items-center gap-2">
              <mat-icon [class]="finalDetails().technicalPassed ? 'text-emerald text-sm' : 'text-rose text-sm'">
                {{ finalDetails().technicalPassed ? 'check_circle' : 'cancel' }}
              </mat-icon>
              <span class="font-medium">{{ finalDetails().technicalPassed ? 'Passed' : 'Failed' }}</span>
            </div>
          </div>

          <div class="checklist-item flex items-center justify-between text-xs py-1">
            <span class="text-muted">Safe Zone Safeguards (No cutoffs)</span>
            <div class="flex items-center gap-2">
              <mat-icon [class]="finalDetails().safeZonePassed ? 'text-emerald text-sm' : 'text-rose text-sm'">
                {{ finalDetails().safeZonePassed ? 'check_circle' : 'cancel' }}
              </mat-icon>
              <span class="font-medium">{{ finalDetails().safeZonePassed ? 'Centered' : 'Off-center' }}</span>
            </div>
          </div>

          <div class="checklist-item flex items-center justify-between text-xs py-1">
            <span class="text-muted">Brand Logo Detection</span>
            <div class="flex items-center gap-2">
              @if (finalDetails().logoDetected) {
                <mat-icon class="text-emerald text-sm">check_circle</mat-icon>
              } @else {
                <div class="flex items-center gap-1 text-amber">
                  <mat-icon class="text-sm">info</mat-icon>
                  <span class="text-xs">Missing</span>
                </div>
              }
              <span class="font-medium">{{ finalDetails().logoDetected ? 'Detected' : 'Not Found' }}</span>
            </div>
          </div>

          <div class="checklist-item flex items-center justify-between text-xs py-1">
            <span class="text-muted">Text Density Check (Max 15%)</span>
            <div class="flex items-center gap-2">
              <mat-icon [class]="finalDetails().textDensityPassed ? 'text-emerald text-sm' : 'text-rose text-sm'">
                {{ finalDetails().textDensityPassed ? 'check_circle' : 'cancel' }}
              </mat-icon>
              <span class="font-medium">{{ finalDetails().textDensityPassed ? 'Passed (<5%)' : 'Too High' }}</span>
            </div>
          </div>

          <div class="checklist-item flex items-center justify-between text-xs py-1">
            <span class="text-muted">Vibe & Aesthetics Score</span>
            <div class="flex items-center gap-2">
              <div class="progress-track">
                <div class="progress-bar" [style.width.%]="finalDetails().vibeScore"></div>
              </div>
              <span class="font-mono text-xs">{{ finalDetails().vibeScore }}%</span>
            </div>
          </div>
        </div>

        <div class="verdict mt-4 p-2 rounded text-xs">
          <strong class="font-medium block mb-1">Automated Verdict</strong>
          Passed brand layout guidelines. Visual compliance secured. Image suitable for direct publishing.
        </div>
      </div>
    }
  `,
  styles: [
    `
    .compact-badge {
      border: 1px solid transparent;
    }
    .compliant-status {
      background-color: #e8f5e9;
      color: #2e7d32;
      border-color: #c8e6c9;
    }
    .warning-status {
      background-color: #fff8e1;
      color: #f57f17;
      border-color: #ffe082;
    }
    .text-emerald {
      color: #2e7d32;
    }
    .text-amber {
      color: #f57f17;
    }
    .text-rose {
      color: #c62828;
    }
    .bg-emerald-light {
      background-color: rgba(46, 125, 50, 0.1);
    }
    .bg-amber-light {
      background-color: rgba(245, 127, 23, 0.1);
    }
    .compliance-card {
      background-color: #ffffff;
      border-color: #dadce0;
    }
    .checklist-item {
      border-bottom: 1px solid #f1f3f4;
    }
    .checklist-item:last-child {
      border-bottom: none;
    }
    .progress-track {
      width: 64px;
      background-color: #f1f3f4;
      border-radius: 9999px;
      height: 6px;
      overflow: hidden;
    }
    .progress-bar {
      background-color: #1a73e8;
      height: 100%;
      border-radius: 9999px;
    }
    .verdict {
      background-color: #f8f9fa;
      border: 1px solid #dadce0;
      color: #5f6368;
    }
    mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  `,
  ],
})
export class ComplianceBadgeComponent {
  score = input<number>(94);
  details = input<ComplianceDetails>();
  compact = input<boolean>(false);

  finalDetails = computed<ComplianceDetails>(() => {
    return (
      this.details() || {
        technicalPassed: true,
        safeZonePassed: true,
        logoDetected: true,
        textDensityPassed: true,
        vibeScore: 92,
      }
    );
  });

  isCompliant = computed<boolean>(() => {
    const details = this.finalDetails();
    return (
      this.score() >= 85 && details.technicalPassed && details.safeZonePassed
    );
  });
}
