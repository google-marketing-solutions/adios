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
import { Component, Input } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Image,
  ImageIssue,
  IMAGE_STATUS,
} from '../api-calls/api-calls.service.interface';

@Component({
  selector: 'image-extension',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, MatIconModule, MatTooltipModule],
  templateUrl: './image-extension.component.html',
  styleUrls: ['./image-extension.component.css'],
})
export class ImageExtensionComponent {
  @Input({ required: true }) image!: Image;
  @Input() imageSize: number = 1;

  getIcon = (image: Image) => {
    if (image?.issues?.length) {
      return 'error';
    }

    switch (image.status) {
      case IMAGE_STATUS.GENERATED:
        return 'pending';
      case IMAGE_STATUS.VALIDATED:
      case IMAGE_STATUS.UPLOADED:
        return 'check_circle';
      case IMAGE_STATUS.DISAPPROVED:
      case IMAGE_STATUS.BAD_PERFORMANCE:
      case IMAGE_STATUS.REJECTED:
        return 'cancel';

      default:
        return '';
    }
  };

  getStyle = (image: Image) => {
    if (image?.issues?.length) {
      return { color: '#EA4335' };
    }

    switch (image.status) {
      case IMAGE_STATUS.GENERATED:
        return { color: '#FBBC04' };
      case IMAGE_STATUS.VALIDATED:
      case IMAGE_STATUS.UPLOADED:
        return { color: '#34A853' };
      case IMAGE_STATUS.DISAPPROVED:
      case IMAGE_STATUS.BAD_PERFORMANCE:
      case IMAGE_STATUS.REJECTED:
        return { color: '#EA4335' };

      default:
        return { color: 'white' };
    }
  };

  getTooltip = (image: Image) => {
    let text = `Image: ${image.filename}
    Status: ${image.status}`;

    if (image?.issues?.length) {
      text += '\n\n' + `❗ Found (${image.issues.length}) issues:`;
      text +=
        '\n' +
        image.issues
          .map(
            issue => `⚠️ Message: "${issue.message}"
          Description: "${issue.description}"`
          )
          .join('\n------------\n');
    }

    return text;
  };

  getImageSize = () => {
    const baseSize = 128;
    return `${baseSize * this.imageSize}px`;
  };
}
