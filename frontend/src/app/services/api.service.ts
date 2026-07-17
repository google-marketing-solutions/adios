import { Injectable, signal, computed } from '@angular/core';

export interface HealthResponse {
  status_code: string;
  service: string;
  architecture: string;
  api_version: string;
}

export interface ErrorDetail {
  domain: string;
  reason: string;
  message: string;
}

export interface StructuredErrorResponse {
  error_code: number;
  status: string;
  message: string;
  details?: ErrorDetail[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly healthState = signal<HealthResponse | null>(null);
  private readonly loadingState = signal<boolean>(false);
  private readonly errorState = signal<StructuredErrorResponse | null>(null);

  readonly healthStatus = computed(() => this.healthState());
  readonly isLoading = computed(() => this.loadingState());
  readonly error = computed(() => this.errorState());

  constructor() {
    this.checkHealth();
  }

  async checkHealth(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const response = await fetch('/health', {
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw errJson || {
          error_code: response.status,
          status: response.statusText,
          message: `Failed to fetch health check from backend (${response.status})`
        };
      }
      const data: HealthResponse = await response.json();
      this.healthState.set(data);
    } catch (err: any) {
      this.errorState.set({
        error_code: err?.error_code || 500,
        status: err?.status || 'FETCH_ERROR',
        message: err?.message || 'Unable to connect to FastAPI backend service'
      });
    } finally {
      this.loadingState.set(false);
    }
  }
}
