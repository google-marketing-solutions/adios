/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
  styles: [
    `
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
    }
  `,
  ],
})
export class AppComponent {}
