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

export class ImagePauseService extends Triggerable {
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
    const adGroups = this._googleAdsApi.getAdGroups();
    const lastProcessedKey = this._isPromotionMode
      ? 'lastPromotionImagePauseProcessedAdGroupId'
      : 'lastImagePauseProcessedAdGroupId';
    const lastImagePauseProcessedAdGroupId =
      PropertiesService.getScriptProperties().getProperty(lastProcessedKey);
    let startIndex = 0;
    if (lastImagePauseProcessedAdGroupId) {
      const lastIndex = adGroups.findIndex(
        adGroup => adGroup.adGroup.id === lastImagePauseProcessedAdGroupId
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

      const uploadedImages = this._gcsApi
        .listImages(this._config['Account ID'], adGroup.adGroup.id, [
          this._config['Uploaded DIR'],
        ])
        ?.items?.map(e => e.name.split('/').slice(-1)[0]);

      if (uploadedImages && uploadedImages.length > 0) {
        const adGroupAssets = this._googleAdsApi.getAdGroupAssetsForAdGroup(
          adGroup.adGroup.id
        );
        const assetsToPause = adGroupAssets
          .filter(asset => uploadedImages.includes(asset.asset.name))
          .map(asset => asset.adGroupAsset.resourceName);

        if (assetsToPause.length > 0) {
          Logger.log(
            `Pausing ${assetsToPause.length} ad group assets for ad group ${adGroup.adGroup.id}...`
          );
          this._googleAdsApi.pauseAdGroupAssets(assetsToPause);
        } else {
          Logger.log(`No assets to pause for ad group ${adGroup.adGroup.id}.`);
        }
      } else {
        Logger.log(
          `No uploaded images found for ad group ${adGroup.adGroup.id}.`
        );
      }

      PropertiesService.getScriptProperties().setProperty(
        lastProcessedKey,
        adGroup.adGroup.id
      );
    }
    Logger.log('Finished Pause Process.');
    //If script completes without timing out, clear the stored ad group ID and any triggers
    PropertiesService.getScriptProperties().deleteProperty(lastProcessedKey);
    this.deleteTrigger();
  }

  static triggeredRun() {
    const isPromotionMode = CONFIG['Is Promotion Mode'] === 'yes';
    Logger.log(`triggeredRun method:`);
    Logger.log(`Is Promotion Mode: ${isPromotionMode}`);

    PropertiesService.getScriptProperties().setProperty(
      `${ImagePauseService.name}StartTime`,
      new Date().getTime().toString()
    );
    const imagePauseService = new ImagePauseService(isPromotionMode);
    imagePauseService.run();
  }

  static manuallyRun() {
    const isPromotionMode = CONFIG['Is Promotion Mode'] === 'yes';
    Logger.log(`manuallyRun method:`);
    Logger.log(`Is Promotion Mode: ${isPromotionMode}`);

    PropertiesService.getScriptProperties().setProperty(
      `${ImagePauseService.name}StartTime`,
      new Date().getTime().toString()
    );
    const lastProcessedKey = isPromotionMode
      ? 'lastPromotionImagePauseProcessedAdGroupId'
      : 'lastImagePauseProcessedAdGroupId';
    const lastImagePauseProcessedAdGroupId =
      PropertiesService.getScriptProperties().getProperty(lastProcessedKey);
    if (lastImagePauseProcessedAdGroupId) {
      PropertiesService.getScriptProperties().deleteProperty(lastProcessedKey);
      Logger.log('Cleared last processed Ad Group ID for a fresh manual run.');
    }
    const imagePauseService = new ImagePauseService(isPromotionMode);
    imagePauseService.run();
  }
}
