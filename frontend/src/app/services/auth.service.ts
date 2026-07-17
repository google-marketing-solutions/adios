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

  loginWithGoogle(): void {
    const clientId = '141897281999-fh3h38o9f0j2onicr518q0l66j4tskvu.apps.googleusercontent.com';
    const redirectUri = encodeURIComponent(window.location.origin + '/auth-handler');
    const scope = encodeURIComponent('openid email profile');
    const responseType = 'id_token';
    const nonce = Math.random().toString(36).substring(2);
    
    // Redirect to Google's OAuth 2.0 endpoint for implicit flow
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}&nonce=${nonce}`;
    window.location.href = authUrl;
  }

  async handleAuthCallback(idToken: string): Promise<void> {
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
        throw new Error(`Authentication validation failed on backend (${response.status})`);
      }

      const userProfile: UserProfile = await response.json();
      this.userState.set(userProfile);
      localStorage.setItem('adios_user', JSON.stringify(userProfile));
      
      // Redirect home
      await this.router.navigate(['/']);
    } catch (error) {
      console.error('Error during Google authentication handling:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    this.userState.set(null);
    localStorage.removeItem('adios_user');
    await this.router.navigate(['/login']);
  }
}
