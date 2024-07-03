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

export class ImageExtensionService extends Triggerable {
  private readonly MAX_AD_GROUP_ASSETS = 20;

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
    const lastImageExtensionProcessedAdGroupId =
      PropertiesService.getScriptProperties().getProperty(
        'lastImageExtensionProcessedAdGroupId'
      );
    let startIndex = 0;
    if (lastImageExtensionProcessedAdGroupId) {
      const lastIndex = adGroups.findIndex(
        adGroup => adGroup.adGroup.id === lastImageExtensionProcessedAdGroupId
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
          'lastImageExtensionProcessedAdGroupId',
          adGroup.adGroup.id
        );
        this.createTriggerForNextRun();
        return; // Exit the function to prevent further execution
      }
      Logger.log(
        `Processing Ad Group ${adGroup.adGroup.name} (${adGroup.adGroup.id})...`
      );
      const uploadedToGcsImages = this._gcsApi
        .listImages(CONFIG['Account ID'], adGroup.adGroup.id, [
          CONFIG['Uploaded DIR'],
        ])
        ?.items?.map(e => e.name.split('/').slice(-1)[0]);
      const notLinkedAssets = this._googleAdsApi
        .getAssetsForAdGroup(adGroup.adGroup.id)
        .filter(
          e =>
            uploadedToGcsImages?.includes(e.name) && !e.adGroupAssetResourceName
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      const existingAssets = this._googleAdsApi.getAllAdGroupAssetsForAdGroup(
        adGroup.adGroup.id
      );
      notLinkedAssets.length = Math.min(
        notLinkedAssets.length,
        this.MAX_AD_GROUP_ASSETS - existingAssets.length
      );
      if (notLinkedAssets?.length > 0) {
        Logger.log(
          `Creating ${notLinkedAssets.length} ad group assets for ad group ${adGroup.adGroup.id}...`
        );
        this._googleAdsApi.createAdGroupAssets(
          adGroup.adGroup.resourceName,
          notLinkedAssets
        );
      }
      const adGroupAssetsToDelete = this._googleAdsApi
        .getAdGroupAssetsForAdGroup(adGroup.adGroup.id)
        .filter(e => !uploadedToGcsImages?.includes(e.asset.name))
        .map(e => e.adGroupAsset.resourceName);
      if (adGroupAssetsToDelete?.length > 0) {
        Logger.log(
          `Deleting ${adGroupAssetsToDelete.length} ad group assets for ad group ${adGroup.adGroup.id}...`
        );
        this._googleAdsApi.deleteAdGroupAssets(adGroupAssetsToDelete);
      }
      PropertiesService.getScriptProperties().setProperty(
        'lastImageExtensionProcessedAdGroupId',
        adGroup.adGroup.id
      );
    }
    Logger.log('Finished Extension Process.');
    //If script completes without timing out, clear the stored ad group ID and any triggers
    PropertiesService.getScriptProperties().deleteProperty(
      'lastImageExtensionProcessedAdGroupId'
    );
    this.deleteTrigger();
  }

  static triggeredRun() {
    PropertiesService.getScriptProperties().setProperty(
      `${ImageExtensionService.name}StartTime`,
      new Date().getTime().toString()
    );
    const imageExtensionService = new ImageExtensionService();
    imageExtensionService.run();
  }

  static manuallyRun() {
    PropertiesService.getScriptProperties().setProperty(
      `${ImageExtensionService.name}StartTime`,
      new Date().getTime().toString()
    );
    const lastImageExtensionProcessedAdGroupId =
      PropertiesService.getScriptProperties().getProperty(
        'lastImageExtensionProcessedAdGroupId'
      );
    if (lastImageExtensionProcessedAdGroupId) {
      PropertiesService.getScriptProperties().deleteProperty(
        'lastImageExtensionProcessedAdGroupId'
      );
      Logger.log('Cleared last processed Ad Group ID for a fresh manual run.');
    }
    const imageExtensionService = new ImageExtensionService();
    imageExtensionService.run();
  }
}
