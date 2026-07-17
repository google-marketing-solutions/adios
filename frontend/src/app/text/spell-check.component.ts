/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CampaignStateService } from '../services/campaign-state.service';
import { SpellingError } from '../models/types';

@Component({
  selector: 'app-spell-check',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="space-y-6" id="spellcheck-section">
      <!-- Title block -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 class="font-bold text-lg text-slate-800 m-0">Automatic Spell Check (Adios 2.0)</h2>
          <p class="text-xs text-muted m-0 mt-1">
            Audit copy headlines, long headlines, and descriptions using BrandAlign heuristics. Detect and resolve typos on campaign level.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1.5 bg-white border px-3 py-1.5 rounded text-xs font-bold text-slate-600">
            <mat-icon class="text-slate-400 icon-size">calendar_today</mat-icon>
            <span>Schedule: </span>
            <select 
              [(ngModel)]="scheduleConfig" 
              class="bg-transparent border-none text-brand font-bold focus:outline-none p-0 cursor-pointer"
            >
              <option value="Monthly (1st of month)">Monthly (1st)</option>
              <option value="Weekly (Mondays)">Weekly (Mondays)</option>
              <option value="Manual Only">Manual Only</option>
            </select>
          </div>

          <button
            (click)="handleTriggerScan()"
            [disabled]="isScanning()"
            class="flex items-center gap-1.5 px-4 py-2 rounded bg-brand hover:bg-brand-dark text-white text-xs font-bold border-none transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            @if (isScanning()) {
              <mat-icon class="animate-spin icon-size">refresh</mat-icon>
            } @else {
              <mat-icon class="icon-size">play_arrow</mat-icon>
            }
            <span>{{ isScanning() ? 'Auditing copy...' : 'Run Diagnostics' }}</span>
          </button>
        </div>
      </div>

      <!-- Scanning active bar -->
      @if (isScanning()) {
        <div class="panel bg-white border rounded p-6 shadow-sm space-y-3">
          <div class="flex justify-between text-xs font-bold text-slate-700">
            <span>Scanning active PMax Text Assets...</span>
            <span class="font-mono text-brand">{{ scanProgress() }}%</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              class="bg-brand h-2 rounded-full transition-all duration-300" 
              [style.width.%]="scanProgress()"
            ></div>
          </div>
          <div class="flex gap-4 text-[10px] text-muted font-mono">
            <span>Searching headlines...</span>
            <span>Checking long_headlines...</span>
            <span>Checking descriptions...</span>
          </div>
        </div>
      }

      <!-- Done notification -->
      @if (doneNotification()) {
        <div class="p-4 bg-emerald-light border border-emerald-250 rounded flex items-center gap-2.5 text-xs text-emerald font-bold shadow-sm">
          <mat-icon class="text-emerald icon-size">check_circle</mat-icon>
          <span>{{ doneNotification() }}</span>
        </div>
      }

      @if (hasScanned() && !isScanning()) {
        <div class="panel bg-white border rounded p-6 shadow-sm space-y-5">
          <div class="flex items-center justify-between border-b pb-3">
            <div>
              <h3 class="font-bold text-xs text-slate-800 uppercase tracking-wide m-0">
                Spelling & Grammar Diagnostics Report
              </h3>
              <p class="text-xs text-muted mt-1 m-0">
                BrandAlign successfully flagged <span class="text-rose font-bold">{{ stateService.pendingErrorsCount() }} spelling anomalies</span> this month. Review and approve recommendations.
              </p>
            </div>
            <div>
              <span class="text-[10px] bg-rose-light text-rose border border-rose-100 px-2 py-0.5 rounded-full font-bold">
                {{ stateService.pendingErrorsCount() }} Flagged Issues
              </span>
            </div>
          </div>

          <!-- Spell check errors Table -->
          <div class="table-container border rounded overflow-hidden">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-500 border-b font-medium">
                  <th class="p-3 w-16">Asset Type</th>
                  <th class="p-3">Campaign / Asset Group</th>
                  <th class="p-3 w-1/3">Flagged Copy Text</th>
                  <th class="p-3">Correction Suggestion</th>
                  <th class="p-3 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-sans">
                @for (err of stateService.spellingErrors(); track err.id) {
                  @let isPending = err.status === 'pending';
                  @let isAccepted = err.status === 'accepted';
                  @let isDenied = err.status === 'denied';
                  @let isModified = err.status === 'modified';
                  @let splitResult = getHighlightParts(err);

                  <tr 
                    [class.bg-emerald-light]="isAccepted"
                    [class.bg-slate-50-opacity]="isDenied"
                    [class.bg-indigo-light]="isModified"
                    class="hover:bg-slate-50/20 transition-all"
                  >
                    <!-- Asset Type badge -->
                    <td class="p-3">
                      <span [class]="'inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ' + getBadgeClass(err.type)">
                        {{ err.type === 'long_headline' ? 'Long Headline' : err.type }}
                      </span>
                    </td>

                    <!-- Context -->
                    <td class="p-3">
                      <p class="font-bold text-slate-700 leading-tight m-0">{{ err.assetGroupName }}</p>
                      <p class="text-[10px] text-muted font-mono m-0 mt-1">{{ err.campaignName }}</p>
                    </td>

                    <!-- Original text highlights -->
                    <td class="p-3 leading-relaxed">
                      @if (isPending) {
                        <p class="text-slate-700 m-0">
                          <span>{{ splitResult.before }}</span>
                          <span class="text-rose underline font-bold bg-rose-light px-1 rounded">
                            {{ err.errorWord }}
                          </span>
                          <span>{{ splitResult.after }}</span>
                        </p>
                      } @else {
                        <p class="text-slate-400 line-through m-0">
                          {{ err.originalText }}
                        </p>
                      }
                      
                      <!-- Display active revised copy below if approved/modified -->
                      @if (!isPending) {
                        <p [class]="'text-xs font-bold m-0 mt-1.5 flex items-center gap-1.5 ' + getActiveCopyTextClass(err.status)">
                          <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                          <span>Active: "{{ err.userModifiedText }}"</span>
                        </p>
                      }
                    </td>

                    <!-- Input fields / suggestions -->
                    <td class="p-3">
                      <input 
                        type="text" 
                        [disabled]="!isPending"
                        [ngModel]="getInputValue(err)"
                        (ngModelChange)="handleModifyText(err.id, $event)"
                        [class]="'text-xs border rounded px-2.5 py-1.5 w-full focus:outline-none transition-all ' + getInputClass(err.status)"
                      />
                    </td>

                    <!-- Review triggers -->
                    <td class="p-3 text-right">
                      @if (isPending) {
                        <div class="flex justify-end gap-1.5">
                          <button
                            (click)="handleDeny(err.id)"
                            class="p-1.5 border hover:border-rose-250 text-slate-400 hover:text-rose hover:bg-rose-light rounded transition-colors cursor-pointer bg-white"
                            title="Ignore error"
                          >
                            <mat-icon class="icon-size">close</mat-icon>
                          </button>
                          <button
                            (click)="handleAccept(err.id)"
                            class="px-2.5 py-1.5 bg-brand hover:bg-brand-dark text-white rounded font-bold flex items-center gap-1 border-none transition-all shadow-xs cursor-pointer"
                            title="Accept correction"
                          >
                            <mat-icon class="icon-xs">check</mat-icon>
                            <span>Adopt</span>
                          </button>
                        </div>
                      } @else {
                        <div class="flex justify-end items-center gap-2">
                          <span [class]="'text-[10px] font-bold uppercase px-2 py-0.5 rounded ' + getStatusBadgeClass(err.status)">
                            {{ err.status === 'accepted' ? 'Adopted' : err.status === 'modified' ? 'Customised' : 'Ignored' }}
                          </span>
                          
                          <button
                            (click)="handleReset(err.id)"
                            class="text-[10px] text-muted hover:text-brand hover:underline border-none bg-transparent cursor-pointer font-bold"
                          >
                            Reset
                          </button>
                        </div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Sync actions Done -->
          <div class="flex items-center justify-between border-t pt-4">
            <div class="text-[11px] text-muted flex items-center gap-1.5">
              <mat-icon class="text-brand icon-size">info</mat-icon>
              <span>Adopting corrections writes updates directly back to Google Ads assets without requiring Editor downloads.</span>
            </div>
            
            <button
              (click)="handleDone()"
              class="px-6 py-2.5 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded border-none transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <mat-icon class="icon-size">check_circle</mat-icon>
              <span>Submit & Finalize Spelling Audit</span>
            </button>
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
    .text-brand {
      color: #1a73e8;
    }
    .bg-emerald-light {
      background-color: rgba(30, 142, 62, 0.03);
    }
    .bg-indigo-light {
      background-color: rgba(26, 115, 232, 0.03);
    }
    .bg-rose-light {
      background-color: rgba(217, 48, 37, 0.03);
    }
    .bg-slate-50-opacity {
      background-color: rgba(248, 249, 250, 0.6);
      opacity: 0.7;
    }
    .border-rose-250 {
      border-color: #f5c2c1;
    }
    .border-emerald-250 {
      border-color: #a8dab5;
    }
    .table-container {
      border-color: #dadce0;
      background-color: #ffffff;
    }
    table th {
      border-bottom: 1px solid #dadce0;
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
  `]
})
export class SpellCheckComponent {
  readonly stateService = inject(CampaignStateService);

  readonly isScanning = signal<boolean>(false);
  readonly scanProgress = signal<number>(0);
  readonly hasScanned = signal<boolean>(true); // Mock default showing errors
  readonly scheduleConfig = signal<string>('Monthly (1st of month)');
  readonly doneNotification = signal<string | null>(null);

  getHighlightParts(err: SpellingError): { before: string; after: string } {
    const parts = err.originalText.split(err.errorWord);
    return {
      before: parts[0] || '',
      after: parts[1] || ''
    };
  }

  handleTriggerScan(): void {
    this.isScanning.set(true);
    this.scanProgress.set(0);
    this.doneNotification.set(null);
    this.hasScanned.set(false);

    // Reset spelling errors
    const errors = this.stateService.spellingErrors();
    const reset = errors.map(e => ({
      ...e,
      status: 'pending' as const,
      userModifiedText: undefined
    }));
    this.stateService.updateBulkSpellingErrors(reset);

    const interval = setInterval(() => {
      const current = this.scanProgress();
      if (current >= 100) {
        clearInterval(interval);
        this.isScanning.set(false);
        this.hasScanned.set(true);
      } else {
        this.scanProgress.set(current + 20);
      }
    }, 50);
  }

  handleAccept(id: string): void {
    const target = this.stateService.spellingErrors().find(e => e.id === id);
    if (!target) return;

    const correctedText = target.originalText.replace(target.errorWord, target.suggestion);
    this.stateService.updateSpellingError({
      ...target,
      status: 'accepted',
      userModifiedText: correctedText
    });
  }

  handleDeny(id: string): void {
    const target = this.stateService.spellingErrors().find(e => e.id === id);
    if (!target) return;

    this.stateService.updateSpellingError({
      ...target,
      status: 'denied',
      userModifiedText: target.originalText
    });
  }

  handleModifyText(id: string, text: string): void {
    const target = this.stateService.spellingErrors().find(e => e.id === id);
    if (!target) return;

    this.stateService.updateSpellingError({
      ...target,
      status: 'modified',
      userModifiedText: text
    });
  }

  handleReset(id: string): void {
    const target = this.stateService.spellingErrors().find(e => e.id === id);
    if (!target) return;

    this.stateService.updateSpellingError({
      ...target,
      status: 'pending',
      userModifiedText: undefined
    });
  }

  handleDone(): void {
    const acceptedCount = this.stateService.spellingErrors().filter(
      e => e.status === 'accepted' || e.status === 'modified'
    ).length;
    
    this.doneNotification.set(
      `Audit Complete! Synced ${acceptedCount} corrected text assets directly back to Google Ads PMax campaigns.`
    );
    setTimeout(() => this.doneNotification.set(null), 5000);
  }

  getInputValue(err: SpellingError): string {
    if (err.status === 'pending') return err.suggestion;
    if (err.status === 'denied') return err.originalText;
    return err.userModifiedText || err.suggestion;
  }

  getBadgeClass(type: string): string {
    if (type === 'headline') return 'bg-indigo-light text-brand border border-indigo-100';
    if (type === 'long_headline') return 'bg-purple-100 text-purple-800';
    return 'bg-amber-light text-amber-800';
  }

  getInputClass(status: string): string {
    if (status === 'pending') {
      return 'bg-slate-50 border-slate-200 focus:bg-white';
    }
    if (status === 'accepted') {
      return 'bg-emerald-light border-emerald-250 text-emerald font-bold';
    }
    if (status === 'modified') {
      return 'bg-indigo-light border-brand text-brand font-bold';
    }
    return 'bg-slate-100 border-transparent text-slate-400';
  }

  getActiveCopyTextClass(status: string): string {
    if (status === 'accepted') return 'text-emerald';
    if (status === 'modified') return 'text-brand';
    return 'text-slate-500';
  }

  getStatusBadgeClass(status: string): string {
    if (status === 'accepted') return 'bg-emerald-light text-emerald';
    if (status === 'modified') return 'bg-indigo-light text-brand';
    return 'bg-slate-200 text-slate-500';
  }
}
