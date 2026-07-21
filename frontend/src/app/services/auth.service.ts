import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

export interface UserProfile {
  email: string;
  name: string;
  picture: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly userState = signal<UserProfile | null>(null);
  private readonly tokenState = signal<string | null>(localStorage.getItem('adios_access_token'));

  readonly currentUser = computed(() => this.userState());
  readonly isAuthenticated = computed(() => !!this.userState());

  constructor() {
    // Load existing session on initialize
    const storedUser = localStorage.getItem('adios_user');
    if (storedUser) {
      try {
        this.userState.set(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('adios_user');
      }
    }
  }

  getAccessToken(): string | null {
    return this.tokenState() || localStorage.getItem('adios_access_token');
  }

  loginWithGoogle(): void {
    const clientId = '861767703303-n46fjc9lovuo4ar4c6e6qk6i9cmi86du.apps.googleusercontent.com';
    const redirectUri = encodeURIComponent(window.location.origin + '/auth-handler');
    const scope = encodeURIComponent('openid email profile https://www.googleapis.com/auth/adwords');
    const responseType = encodeURIComponent('id_token token');
    const nonce = Math.random().toString(36).substring(2);
    
    // Redirect to Google's OAuth 2.0 endpoint for implicit flow
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}&nonce=${nonce}`;
    window.location.href = authUrl;
  }

  async handleAuthCallback(idToken: string, accessToken?: string | null): Promise<void> {
    try {
      const response = await fetch('/v1/auth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ id_token: idToken })
      });

      if (!response.ok) {
        let errorDetail = '';
        try {
          const body = await response.json();
          if (body && body.detail) {
            errorDetail = `: ${body.detail}`;
          }
        } catch {
          // ignore parsing error
        }
        throw new Error(`Authentication validation failed on backend (${response.status})${errorDetail}`);
      }

      const userProfile: UserProfile = await response.json();
      this.userState.set(userProfile);
      localStorage.setItem('adios_user', JSON.stringify(userProfile));

      if (accessToken) {
        this.tokenState.set(accessToken);
        localStorage.setItem('adios_access_token', accessToken);
      }
      
      // Redirect home
      await this.router.navigate(['/']);
    } catch (error) {
      console.error('Error during Google authentication handling:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    this.userState.set(null);
    this.tokenState.set(null);
    localStorage.removeItem('adios_user');
    localStorage.removeItem('adios_access_token');
    await this.router.navigate(['/login']);
  }
}
