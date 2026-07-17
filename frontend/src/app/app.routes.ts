import { Routes } from '@angular/router';
import { MainLayoutComponent } from './components/main-layout.component';
import { LoginComponent } from './components/login.component';
import { AuthHandlerComponent } from './components/auth-handler.component';
import { authGuard } from './shared/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    title: 'Adios 2.0 Advanced | Unified Interface'
  },
  {
    path: 'login',
    component: LoginComponent,
    title: 'Sign In | Adios 2.0'
  },
  {
    path: 'auth-handler',
    component: AuthHandlerComponent,
    title: 'Authenticating... | Adios 2.0'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
