import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <!-- Logo Branding -->
        <div class="brand-header">
          <div class="logo-box">Ad</div>
          <h1 class="brand-title">Adios 2.0</h1>
          <p class="brand-subtitle">Asset Automation Platform</p>
        </div>

        <div class="divider"></div>

        <!-- Call to Action -->
        <div class="login-action">
          <h2 class="welcome-text">Welcome Back</h2>
          <p class="instruction-text">Sign in to manage and optimize your PMax and GMC media assets.</p>

          <!-- Custom Google Sign-In Button -->
          <button (click)="authService.loginWithGoogle()" class="google-signin-btn">
            <span class="logo-container">
              <svg class="google-logo" width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.938 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.549 0 9s.347 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.062.957 4.961L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            </span>
            <span class="button-text">Sign in with Google</span>
          </button>
        </div>
      </div>
      
      <!-- Footer Copyright -->
      <span class="footer-text">Google Marketing Solutions &copy; 2026</span>
    </div>
  `,
  styles: [`
    .login-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
      background-color: #f8f9fa;
      font-family: 'Roboto', sans-serif;
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 40px;
      background-color: #ffffff;
      border: 1px solid #dadce0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      box-sizing: border-box;
    }
    .brand-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 24px;
    }
    .logo-box {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #1a73e8 0%, #34a853 100%);
      font-size: 20px;
      font-weight: bold;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 700;
      color: #202124;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 11px;
      font-weight: 500;
      color: #5f6368;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 4px 0 0 0;
    }
    .divider {
      height: 1px;
      background-color: #dadce0;
      width: 100%;
      margin: 24px 0;
    }
    .login-action {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .welcome-text {
      font-size: 24px;
      font-weight: 400;
      color: #202124;
      margin: 0 0 8px 0;
    }
    .instruction-text {
      font-size: 13px;
      color: #5f6368;
      line-height: 1.5;
      margin: 0 0 32px 0;
    }
    .google-signin-btn {
      display: flex;
      align-items: center;
      background-color: #ffffff;
      border: 1px solid #dadce0;
      border-radius: 4px;
      color: #3c4043;
      cursor: pointer;
      font-family: 'Roboto', sans-serif;
      font-size: 14px;
      font-weight: 500;
      height: 40px;
      padding: 0;
      width: 100%;
      transition: background-color 0.2s, box-shadow 0.2s, border-color 0.2s;
      overflow: hidden;
    }
    .google-signin-btn:hover {
      background-color: #f8f9fa;
      border-color: #c3c7cb;
      box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
    }
    .google-signin-btn:active {
      background-color: #eeeeee;
    }
    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 100%;
      border-right: 1px solid #dadce0;
    }
    .button-text {
      flex-grow: 1;
      text-align: center;
      font-weight: 500;
      padding-right: 20px; /* Offset the logo container width for text centering */
    }
    .footer-text {
      font-size: 11px;
      color: #80868b;
      margin-top: 24px;
    }
  `]
})
export class LoginComponent {
  readonly authService = inject(AuthService);
}
