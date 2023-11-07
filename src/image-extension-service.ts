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

export class ImageExtensionService {
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
      const uploadedToGcsImages = this._gcsApi
        .listImages(CONFIG['Account ID'], adGroup.adGroup.id, [
          CONFIG['Uploaded DIR'],
        ])
        ?.items?.map(e => e.name.split('/').slice(-1)[0]);
      const assets = this._googleAdsApi
        .getAssetsForAdGroup(adGroup.adGroup.id)
        .filter(e => uploadedToGcsImages?.includes(e.name));
      const notLinkedAssets = assets.filter(
        e =>
          !e.adGroupAssetResourceName && uploadedToGcsImages?.includes(e.name)
      );

      // Adding images from GCS to Ad Groups
      Logger.log(
        `Creating ${notLinkedAssets.length} ad group assets for ad group ${adGroup.adGroup.id}...`
      );
      this._googleAdsApi.createAdGroupAssets(
        adGroup.adGroup.resourceName,
        notLinkedAssets
      );

      // Removing ad group assets which are not on GCS anymore
      const adGroupAssetsToDelete = this._googleAdsApi
        .getAdGroupAssetsForAdGroup(adGroup.adGroup.id)
        .filter(e => !uploadedToGcsImages?.includes(e.asset.name))
        .map(e => e.adGroupAsset.resourceName);

      if (adGroupAssetsToDelete) {
        Logger.log(
          `Deleting ${adGroupAssetsToDelete.length} ad group assets for ad group ${adGroup.adGroup.id}...`
        );
        this._googleAdsApi.deleteAdGroupAssets(adGroupAssetsToDelete);
      }
    }
  }
}

function runImageExtensionService() {
  const imageExtensionService = new ImageExtensionService();
  imageExtensionService.run();
}
