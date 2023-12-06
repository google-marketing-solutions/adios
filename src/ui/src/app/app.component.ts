/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  MatPaginator,
  MatPaginatorModule,
  PageEvent,
} from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiCallsService } from './api-calls/api-calls.service';
import { environment } from '../environments/environment';
import {
  AdGroup,
  IMAGE_STATUS,
  Image,
} from './api-calls/api-calls.service.interface';
import { ImageExtensionComponent } from './image-extension/image-extension.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSliderModule,
    MatToolbarModule,
    MatTooltipModule,
    ImageExtensionComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  env?: boolean;
  loading = false;
  adGroups: AdGroup[] = [];
  data: AdGroup[] = [];
  selectedImages: Image[] = [];
  imageSize: number = 1;

  constructor(private apiCallsService: ApiCallsService) {
    this.env = environment.production;
  }

  ngOnInit() {
    this.refreshData();
  }

  toggleImage(image: Image) {
    if (image.status !== IMAGE_STATUS.GENERATED) {
      return;
    }
    if (!image.selected) {
      this.selectedImages.push(image);
    } else {
      const index = this.selectedImages.indexOf(image);
      if (index >= 0) {
        this.selectedImages.splice(index, 1);
      }
    }
    image.selected = !image.selected;
  }

  refreshData = () => {
    this.loading = true;
    this.apiCallsService.getData().subscribe(adGroups => {
      this.adGroups = adGroups;
      this.adGroups.forEach(ag => {
        ag.images.sort((a, b) => {
          if (a.status === IMAGE_STATUS.GENERATED) {
            return -1;
          }
          if (b.status === IMAGE_STATUS.GENERATED) {
            return 1;
          }
          return 0;
        });
      });
      this.paginator?.page.emit({
        pageSize: this.paginator.pageSize,
        pageIndex: this.paginator.pageIndex,
        length: this.paginator.length,
      });
      this.loading = false;
    });
  };

  validateImages = () => {
    this.loading = true;
    this.apiCallsService
      .setImageStatus(this.selectedImages, IMAGE_STATUS.VALIDATED)
      .subscribe(() => {
        this.selectedImages = [];
        this.refreshData();
      });
  };

  rejectImages = () => {
    this.loading = true;
    this.apiCallsService
      .setImageStatus(this.selectedImages, IMAGE_STATUS.REJECTED)
      .subscribe(() => {
        this.selectedImages = [];
        this.refreshData();
      });
  };

  handlePageEvent = (e: PageEvent) => {
    this.data = this.adGroups.slice(
      e.pageIndex * e.pageSize,
      (e.pageIndex + 1) * e.pageSize
    );
  };

  resizeImages = (e: Event) => {
    this.imageSize = (e.target as HTMLInputElement).valueAsNumber;
  };
}
