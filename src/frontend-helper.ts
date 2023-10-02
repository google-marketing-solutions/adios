import { CONFIG } from './config';
import { GcsApi } from './gcs-api';

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
export const FRONTEND_HELPER = null;

export enum IMAGE_STATUS {
  GENERATED = 'Generated',
  VALIDATED = 'Validated',
  UPLOADED = 'Uploaded',
  DISAPPROVED = 'Disapproved',
  BAD_PERFORMANCE = 'Bad performance',
  REJECTED = 'Manually rejected',
}

export interface AdGroup {
  name: string;
  id: string;
  images: Image[];
}

export interface Image {
  filename: string;
  url: string;
  status: IMAGE_STATUS;
  selected?: boolean;
}

const getData = () => {
  const gcsApi = new GcsApi(CONFIG['GCS Bucket']);
  const gcsImages = gcsApi.listAllImages(CONFIG['Account ID']);
  const adGroups: { [id: string]: Image[] } = {};
  if (!gcsImages.items) {
    return [];
  }
  gcsImages.items.forEach(e => {
    const statusFolder = e.name.split('/')[2];
    let status: IMAGE_STATUS | null = null;
    switch (statusFolder) {
      case 'GENERATED':
        status = IMAGE_STATUS.GENERATED;
        break;
      case 'UPLOADED':
        status = IMAGE_STATUS.UPLOADED;
        break;
      case 'VALIDATED':
        status = IMAGE_STATUS.VALIDATED;
        break;
      case 'DISAPPROVED':
        status = IMAGE_STATUS.DISAPPROVED;
        break;
      case 'BAD_PERFORMANCE':
        status = IMAGE_STATUS.BAD_PERFORMANCE;
        break;
      case 'REJECTED':
        status = IMAGE_STATUS.REJECTED;
        break;
      default:
        break;
    }
    if (!status) {
      return;
    }
    const filename = e.name.split('/')[3];
    const adGroupId = filename.split('|')[0];
    if (!adGroups[adGroupId]) {
      adGroups[adGroupId] = [];
    }
    adGroups[adGroupId].push({
      filename,
      url: `https://storage.mtls.cloud.google.com/${CONFIG['GCS Bucket']}/${e.name}`,
      status,
    });
  });
  const result: AdGroup[] = [];
  for (const [adGroupId, images] of Object.entries(adGroups)) {
    result.push({
      id: adGroupId,
      name: images[0].filename.split('|')[1],
      images,
    });
  }
  return result;
};

const setImageStatus = (images: Image[], status: IMAGE_STATUS) => {
  const gcsApi = new GcsApi(CONFIG['GCS Bucket']);
  images.forEach(image => {
    const adGroupId = image.filename.split('|')[0];
    gcsApi.moveImage(
      CONFIG['Account ID'],
      adGroupId,
      image.filename,
      CONFIG['Generated DIR'],
      status === IMAGE_STATUS.VALIDATED
        ? CONFIG['Validated DIR']
        : CONFIG['Rejected DIR']
    );
  });
};
