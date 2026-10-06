import {Routes} from '@angular/router';
import {AuthHandlerComponent} from './components/auth-handler.component';
import {LoginComponent} from './components/login.component';
import {MainLayoutComponent} from './components/main-layout.component';
import {authGuard} from './shared/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'uploader',
    pathMatch: 'full',
  },
  {
    path: 'uploader',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    data: {section: 'uploader'},
    title: 'Asset Group Uploader | Adios 2.0',
  },
  {
    path: 'image-protector',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    data: {section: 'protection'},
    title: 'Image Protector | Adios 2.0',
  },
  {
    path: 'protection',
    redirectTo: 'image-protector',
    pathMatch: 'full',
  },
  {
    path: 'background-studio',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    data: {section: 'background'},
    title: 'AI Image Studio | Adios 2.0',
  },
  {
    path: 'animation-machine',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    data: {section: 'animation'},
    title: 'Animation Machine | Adios 2.0',
  },
  {
    path: 'spell-check',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    data: {section: 'spell'},
    title: 'Spell Check Center | Adios 2.0',
  },
  {
    path: 'rules-presets',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    data: {section: 'settings'},
    title: 'Rules & Presets | Adios 2.0',
  },
  {
    path: 'settings',
    redirectTo: 'rules-presets',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginComponent,
    title: 'Sign In | Adios 2.0',
  },
  {
    path: 'auth-handler',
    component: AuthHandlerComponent,
    title: 'Authenticating... | Adios 2.0',
  },
  {
    path: '**',
    redirectTo: 'uploader',
  },
];
