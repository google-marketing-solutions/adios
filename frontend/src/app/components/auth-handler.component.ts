import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth-handler',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="auth-handler-container">
      <div class="card">
        @if (errorMsg()) {
          <div class="error-state">
            <span class="error-icon">⚠️</span>
            <h3>Authentication Failed</h3>
            <p>{{ errorMsg() }}</p>
            <button (click)="retry()" class="retry-btn">Return to Login</button>
          </div>
        } @else {
          <div class="loading-state">
            <div class="spinner"></div>
            <h3>Verifying Credentials</h3>
            <p>Please wait while we connect with Google to secure your session...</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-handler-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
      background-color: #f8f9fa;
      font-family: 'Roboto', sans-serif;
    }
    .card {
      width: 100%;
      max-width: 400px;
      padding: 40px;
      background-color: #ffffff;
      border: 1px solid #dadce0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      text-align: center;
      box-sizing: border-box;
    }
    .loading-state h3, .error-state h3 {
      font-size: 18px;
      color: #202124;
      margin: 20px 0 8px 0;
    }
    .loading-state p, .error-state p {
      font-size: 13px;
      color: #5f6368;
      line-height: 1.5;
      margin: 0;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #1a73e8;
      border-radius: 50%;
      margin: 0 auto;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error-icon {
      font-size: 48px;
      display: block;
      margin-bottom: 12px;
    }
    .retry-btn {
      margin-top: 24px;
      background-color: #1a73e8;
      color: white;
      border: none;
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 500;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .retry-btn:hover {
      background-color: #1557b0;
    }
  `]
})
export class AuthHandlerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) {
      const redirectUri = window.location.origin + '/auth-handler';
      this.verifyCode(code, redirectUri);
    } else {
      // Fallback/Error handling for fragments
      this.route.fragment.subscribe({
        next: (fragment) => {
          if (fragment) {
            const params = new URLSearchParams(fragment);
            const error = params.get('error');
            if (error) {
              this.errorMsg.set(`Google authentication error: ${error}`);
            } else {
              this.errorMsg.set('Unexpected response format. Please ensure Authorization Code flow is active.');
            }
          } else {
            const errorParam = this.route.snapshot.queryParamMap.get('error');
            if (errorParam) {
              this.errorMsg.set(`Google authentication error: ${errorParam}`);
            } else {
              this.errorMsg.set('Missing Authorization Code from Google response.');
            }
          }
        },
        error: (err) => {
          this.errorMsg.set('Failed to parse OAuth callback response.');
          console.error(err);
        }
      });
    }
  }

  private async verifyCode(code: string, redirectUri: string): Promise<void> {
    try {
      await this.authService.verifyCode(code, redirectUri);
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'Failed to exchange authorization code with the backend.');
    }
  }

  retry(): void {
    this.router.navigate(['/login']);
  }
}
