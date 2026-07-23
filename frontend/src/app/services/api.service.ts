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

export interface AssetGroupItem {
  id: string;
  name: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  total_image_count: number;
  total_image_capacity: number;
  landscape_count: number;
  landscape_capacity: number;
  portrait_count: number;
  portrait_capacity: number;
  tall_portrait_count: number;
  tall_portrait_capacity: number;
}

export interface AssetGroupListResponse {
  total_count: number;
  asset_groups: AssetGroupItem[];
  source?: string;
  error_message?: string;
}

export interface AccountItem {
  id: string;
  name: string;
  descriptive_name?: string;
  is_manager?: boolean;
}

export interface AccountListResponse {
  total_count: number;
  accounts: AccountItem[];
  source?: string;
  error_message?: string;
}

export interface ImageUploadResponse {
  file_token: string;
  filename: string;
  width: number;
  height: number;
  ratio_type: string;
  field_type: string;
  aspect_ratio: number;
}

export interface SwapRules {
  lookback_window: string;
  custom_lookback_days?: number | null;
  min_impressions?: number | null;
  min_clicks?: number | null;
  eviction_kpi: string;
  allow_cross_aspect_ratio_swap: boolean;
}

export interface EvictedAssetInfo {
  asset_id: string;
  name: string;
  url: string;
  kpi_metric: string;
  kpi_value: number;
}

export interface AssignmentResult {
  asset_group_id: string;
  status: string;
  asset_resource_name: string;
  asset_group_asset_resource_name: string;
  evicted_asset?: EvictedAssetInfo | null;
  error_message?: string | null;
}

export interface AssignResponse {
  file_token: string;
  field_type: string;
  total_assigned: number;
  results: AssignmentResult[];
}

export interface CampaignAssetItem {
  id: string;
  name: string;
  url: string;
  performance_score: string;
  kpi_value?: number;
  is_protected: boolean;
  upload_date: string;
}

export interface CampaignAssetListResponse {
  total_count: number;
  assets: CampaignAssetItem[];
  source?: string;
  error_message?: string;
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

  private getHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    const token = localStorage.getItem('adios_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async checkHealth(): Promise<void> {
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const response = await fetch('/health', {
        headers: this.getHeaders({ 'Accept': 'application/json' })
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

  async fetchAccessibleAccounts(): Promise<AccountListResponse> {
    const response = await fetch('/v1/campaign/accounts', {
      headers: this.getHeaders({ 'Accept': 'application/json' })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to load accessible accounts' }));
      throw new Error(err.detail || 'Failed to fetch customer accounts');
    }
    return response.json();
  }

  async fetchAssetGroups(customerId?: string): Promise<AssetGroupListResponse> {
    const url = customerId
      ? `/v1/campaign/asset-groups?customer_id=${encodeURIComponent(customerId)}`
      : '/v1/campaign/asset-groups';
    const response = await fetch(url, {
      headers: this.getHeaders({ 'Accept': 'application/json' })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to load asset groups' }));
      throw new Error(err.detail || 'Failed to fetch asset groups from Google Ads API');
    }
    return response.json();
  }

  async fetchCampaignAssets(customerId?: string): Promise<CampaignAssetListResponse> {
    const url = customerId
      ? `/v1/campaign/assets?customer_id=${encodeURIComponent(customerId)}`
      : '/v1/campaign/assets';
    const response = await fetch(url, {
      headers: this.getHeaders({ 'Accept': 'application/json' })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to load assets' }));
      throw new Error(err.detail || 'Failed to fetch assets from Google Ads API');
    }
    return response.json();
  }

  async toggleAssetProtection(assetId: string, isProtected: boolean): Promise<any> {
    const response = await fetch('/v1/campaign/assets/toggle-protection', {
      method: 'POST',
      headers: this.getHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }),
      body: JSON.stringify({
        asset_id: assetId,
        is_protected: isProtected
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to update protection status' }));
      throw new Error(err.detail || 'Failed to update protection status');
    }
    return response.json();
  }

  async uploadImage(file: File): Promise<ImageUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/v1/campaign/upload', {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to upload image' }));
      throw new Error(err.detail || 'Image validation failed');
    }
    return response.json();
  }

  async assignAsset(
    fileToken: string,
    assetGroupIds: string[],
    customerId?: string,
    startDate?: string,
    endDate?: string,
    swapRules?: SwapRules
  ): Promise<AssignResponse> {
    const response = await fetch('/v1/campaign/assign', {
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        file_token: fileToken,
        asset_group_ids: assetGroupIds,
        customer_id: customerId || '9044713567',
        start_date: startDate || null,
        end_date: endDate || null,
        swap_rules: swapRules || null
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to assign assets' }));
      throw new Error(err.detail || 'Assignment failed');
    }
    return response.json();
  }
}
