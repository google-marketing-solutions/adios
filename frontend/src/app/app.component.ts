import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="app-header">
      <div class="logo">Adios 2.0 Advanced</div>
      <nav class="nav-links">
        <span class="badge angular-badge">Angular 19+ Standalone</span>
        <span class="badge fastapi-badge">Python / FastAPI</span>
      </nav>
    </header>

    <main class="dashboard-container">
      <section class="status-card">
        <h2>Backend Health Status (REST / Signals)</h2>
        
        <div *ngIf="apiService.isLoading()" class="status-loading">
          Connecting to FastAPI endpoint /health...
        </div>

        <div *ngIf="apiService.error() as err" class="status-error">
          <p><strong>Status:</strong> {{ err.status }} ({{ err.error_code }})</p>
          <p>{{ err.message }}</p>
          <button (click)="apiService.checkHealth()" class="btn-refresh">Retry Connection</button>
        </div>

        <div *ngIf="apiService.healthStatus() as health" class="status-healthy">
          <div class="status-indicator">
            <span class="dot green"></span>
            <strong>{{ health.service }}</strong> is {{ health.status_code.toUpperCase() }}
          </div>
          <ul class="metadata-list">
            <li><strong>Architecture:</strong> {{ health.architecture }}</li>
            <li><strong>API Version:</strong> {{ health.api_version }}</li>
          </ul>
          <button (click)="apiService.checkHealth()" class="btn-refresh">Refresh Status</button>
        </div>
      </section>

      <section class="info-card">
        <h3>Architecture & Governance</h3>
        <p>
          The target frontend has been migrated to <strong>Angular 19+ Standalone Components with Signals</strong>.
          All state management and REST JSON communication strictly follow the 150ms-300ms motion specifications
          and decoupled resource boundaries defined in <code>PRD.md</code> and <code>AGENTS.md</code>.
        </p>
      </section>
    </main>
  `
})
export class AppComponent {
  readonly apiService = inject(ApiService);
}
