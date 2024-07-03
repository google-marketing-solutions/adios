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
import { Triggerable } from './triggerable';

export class ImageUploadService extends Triggerable {
  private readonly _gcsApi;
  private readonly _googleAdsApi;

  constructor() {
    super();
    this._gcsApi = new GcsApi(CONFIG['GCS Bucket']);
    this._googleAdsApi = new GoogleAdsApi(
      CONFIG['Ads API Key'],
      CONFIG['Manager ID'],
      CONFIG['Account ID']
    );
  }

  run() {
    this.deleteTrigger();
    const adGroups = this._googleAdsApi.getAdGroups();
    const lastImageUploadProcessedAdGroupId =
      PropertiesService.getScriptProperties().getProperty(
        'lastImageUploadProcessedAdGroupId'
      );
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
          `The function is reaching the 6 minute timeout, and therfore will create a trigger to rerun from this ad group: ${adGroup.adGroup.name} and then self terminate.`
        );
        PropertiesService.getScriptProperties().setProperty(
          'lastImageUploadProcessedAdGroupId',
          adGroup.adGroup.id
        );
        this.createTriggerForNextRun();
        return; // Exit the function to prevent further execution
      }
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
        PropertiesService.getScriptProperties().setProperty(
          'lastImageUploadProcessedAdGroupId',
          adGroup.adGroup.id
        );
      }
      // TODO: Remove assets from the Asset Library
    }
    Logger.log('Finished uploading images.');
    // If script completes without timing out, clear the stored ad group ID and any triggers
    PropertiesService.getScriptProperties().deleteProperty(
      'lastImageUploadProcessedAdGroupId'
    );
    this.deleteTrigger();
  }

  static triggeredRun() {
    PropertiesService.getScriptProperties().setProperty(
      `${ImageUploadService.name}StartTime`,
      new Date().getTime().toString()
    );
    const imageUploadService = new ImageUploadService();
    imageUploadService.run();
  }

  static manuallyRun() {
    PropertiesService.getScriptProperties().setProperty(
      `${ImageUploadService.name}StartTime`,
      new Date().getTime().toString()
    );
    const lastImageUploadProcessedAdGroupId =
      PropertiesService.getScriptProperties().getProperty(
        'lastImageUploadProcessedAdGroupId'
      );
    if (lastImageUploadProcessedAdGroupId) {
      PropertiesService.getScriptProperties().deleteProperty(
        'lastImageUploadProcessedAdGroupId'
      );
      Logger.log('Cleared last processed Ad Group ID for a fresh manual run.');
    }
    const imageUploadService = new ImageUploadService();
    imageUploadService.run();
  }
}
