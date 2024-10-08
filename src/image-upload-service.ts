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
import { CONFIG, PROMOTION_CONFIG } from './config';
import { GcsApi } from './gcs-api';
import { GoogleAdsApi } from './google-ads-api';
import { Triggerable } from './triggerable';

export class ImageUploadService extends Triggerable {
  private readonly _gcsApi;
  private readonly _googleAdsApi;
  private readonly _config;
  private readonly _isPromotionMode: boolean;

  constructor(isPromotionMode: boolean) {
    super();
    this._isPromotionMode = isPromotionMode;
    this._config = this._isPromotionMode ? PROMOTION_CONFIG : CONFIG;
    Logger.log(
      `Config sheet chosen is: ${
        this._isPromotionMode ? 'PROMOTION_CONFIG' : 'CONFIG'
      }`
    );
    this._gcsApi = new GcsApi(this._config['GCS Bucket']);
    this._googleAdsApi = new GoogleAdsApi(
      this._config['Ads API Key'],
      this._config['Manager ID'],
      this._config['Account ID']
    );
  }

  run() {
    this.deleteTrigger();
    Logger.log(`config bucket chosen: ${this._config['GCS Bucket']}`);
    const adGroups = this._googleAdsApi.getAdGroups();
    const lastProcessedKey = this._isPromotionMode
      ? 'lastPromotionImageUploadProcessedAdGroupId'
      : 'lastImageUploadProcessedAdGroupId';
    const lastImageUploadProcessedAdGroupId =
      PropertiesService.getScriptProperties().getProperty(lastProcessedKey);
    let startIndex = 0;
    if (lastImageUploadProcessedAdGroupId) {
      const lastIndex = adGroups.findIndex(
        adGroup => adGroup.adGroup.id === lastImageUploadProcessedAdGroupId
      );
      startIndex = Math.max(lastIndex, 0);
    }
    for (let i = startIndex; i < adGroups.length; i++) {
      const adGroup = adGroups[i];
      if (this.shouldTerminate()) {
        Logger.log(
          `The function is reaching the 6 minute timeout, and therefore will create a trigger to rerun from this ad group: ${adGroup.adGroup.name} and then self terminate.`
        );
        PropertiesService.getScriptProperties().setProperty(
          lastProcessedKey,
          adGroup.adGroup.id
        );
        this.createTriggerForNextRun();
        return; // Exit the function to prevent further execution
      }
      Logger.log(
        `Processing Ad Group ${adGroup.adGroup.name} (${adGroup.adGroup.id})...`
      );
      const imgFolder =
        this._config['Validated DIR'] || this._config['Generated DIR'];
      const images = this._gcsApi.getImages(
        this._config['Account ID'],
        adGroup.adGroup.id,
        [imgFolder]
      ) as GoogleCloud.Storage.Image[];
      // Upload new images
      if (images.length === 0) {
        Logger.log('No images to upload.');
      } else {
        this._googleAdsApi.uploadImageAssets(images);
        this._gcsApi.moveImages(
          this._config['Account ID'],
          adGroup.adGroup.id,
          images,
          imgFolder,
          this._config['Uploaded DIR']
        );
        PropertiesService.getScriptProperties().setProperty(
          lastProcessedKey,
          adGroup.adGroup.id
        );
      }
      // TODO: Remove assets from the Asset Library
    }
    Logger.log('Finished uploading images.');
    // If script completes without timing out, clear the stored ad group ID and any triggers
    PropertiesService.getScriptProperties().deleteProperty(lastProcessedKey);
    this.deleteTrigger();
  }

  static triggeredRun() {
    const isPromotionMode = CONFIG['Is Promotion Mode'] === 'yes';
    PropertiesService.getScriptProperties().setProperty(
      `${ImageUploadService.name}StartTime`,
      new Date().getTime().toString()
    );
    const imageUploadService = new ImageUploadService(isPromotionMode);
    imageUploadService.run();
  }

  static manuallyRun() {
    const isPromotionMode = CONFIG['Is Promotion Mode'] === 'yes';
    PropertiesService.getScriptProperties().setProperty(
      `${ImageUploadService.name}StartTime`,
      new Date().getTime().toString()
    );
    const lastProcessedKey = isPromotionMode
      ? 'lastPromotionImageUploadProcessedAdGroupId'
      : 'lastImageUploadProcessedAdGroupId';
    const lastImageUploadProcessedAdGroupId =
      PropertiesService.getScriptProperties().getProperty(lastProcessedKey);
    if (lastImageUploadProcessedAdGroupId) {
      PropertiesService.getScriptProperties().deleteProperty(lastProcessedKey);
      Logger.log('Cleared last processed Ad Group ID for a fresh manual run.');
    }
    const imageUploadService = new ImageUploadService(isPromotionMode);
    imageUploadService.run();
  }
}
