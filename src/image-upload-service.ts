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
import { CONFIG } from './config';
import { GcsApi } from './gcs-api';
import { GoogleAdsApi } from './google-ads-api';

export class ImageUploadService {
  private readonly _gcsApi;
  private readonly _googleAdsApi;

  constructor() {
    this._gcsApi = new GcsApi(CONFIG['GCS Bucket']);
    this._googleAdsApi = new GoogleAdsApi(
      CONFIG['Ads API Key'],
      CONFIG['Manager ID'],
      CONFIG['Account ID']
    );
  }

  run() {
    const adGroups = this._googleAdsApi.getAdGroups();
    for (const adGroup of adGroups) {
      Logger.log(
        `Processing Ad Group ${adGroup.adGroup.name} (${adGroup.adGroup.id})...`
      );
      const imgFolder = CONFIG['Validated DIR'] || CONFIG['Generated DIR'];
      const images = this._gcsApi.getImages(
        CONFIG['Account ID'],
        adGroup.adGroup.id,
        [imgFolder]
      ) as GoogleCloud.Storage.Image[];
      // Upload new images
      if (images.length === 0) {
        Logger.log('No images to upload.');
      } else {
        this._googleAdsApi.uploadImageAssets(images);
        this._gcsApi.moveImages(
          CONFIG['Account ID'],
          adGroup.adGroup.id,
          images,
          imgFolder,
          CONFIG['Uploaded DIR']
        );
      }
      // TODO: Remove assets from the Asset Library
    }
    Logger.log('Finished uploading images.');
  }
}

function runImageUploadService() {
  const imageUploadService = new ImageUploadService();
  imageUploadService.run();
}
