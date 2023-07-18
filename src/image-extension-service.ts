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

  _createExtensionFeedItems(assets: GoogleAds.Entities.Asset[]) {
    for (const asset of assets) {
      asset.feedItemResourceName = this._googleAdsApi.createExtensionFeedItem(
        asset.resourceName
      )?.results[0]?.resourceName;
    }
  }

  _deleteExtensionFeedItems(assets: GoogleAds.Entities.Asset[]) {
    for (const asset of assets) {
      this._googleAdsApi.deleteExtensionFeedItem(asset.feedItemResourceName);
      asset.feedItemResourceName = undefined;
    }
  }

  run() {
    const adGroups = this._googleAdsApi.getAdGroups();
    Logger.log(adGroups);
    for (const adGroup of adGroups) {
      const uploadedImages = this._gcsApi
        .listImages(CONFIG['Account ID'], adGroup.adGroup.id, [
          CONFIG['Uploaded DIR'],
        ])
        ?.items?.map(e => e.name.split('/').slice(-1)[0]);
      const assets = this._googleAdsApi
        .getAssets(adGroup.adGroup.name)
        .filter(e => uploadedImages.includes(e.name));
      const assetsWithoutExtensionFeedItem = assets.filter(
        e => !e.feedItemResourceName && uploadedImages.includes(e.name)
      );
      Logger.log(
        `Creating ${assetsWithoutExtensionFeedItem.length} extension feed items...`
      );
      this._createExtensionFeedItems(assetsWithoutExtensionFeedItem);
      const imageExtension = this._googleAdsApi.executeSearch(
        GoogleAdsApi.QUERIES.ADGROUP_EXTENSION_SETTINGS +
          ` AND ad_group.id = ${adGroup.adGroup.id}`
      );
      if (imageExtension.length === 0) {
        // Create image extension
        Logger.log(
          `Creating Ad Group Extension Setting with ${assets.length} images...`
        );
        Logger.log(
          this._googleAdsApi.createAdGroupExtensionSetting(
            adGroup.adGroup.id,
            assets.map(e => e.feedItemResourceName)
          )
        );
      } else {
        // Ensure that the images are synced
        const feedItemsSet = new Set();
        for (const asset of assets) {
          feedItemsSet.add(asset.feedItemResourceName);
        }

        if (imageExtension[0]?.adGroupExtensionSetting?.extensionFeedItems) {
          for (const feedItemResourceName of imageExtension[0]
            .adGroupExtensionSetting.extensionFeedItems) {
            feedItemsSet.add(feedItemResourceName);
          }
        }

        const extensionFeedItemsLength =
          imageExtension[0]?.adGroupExtensionSetting?.extensionFeedItems
            ?.length ?? 0;
        if (
          feedItemsSet.size !== assets.length ||
          feedItemsSet.size !== extensionFeedItemsLength
        ) {
          // Update Ad Group Extension setting with new images
          Logger.log(
            `Updating Ad Group Extension Setting with ${assets.length} images...`
          );
          // TODO: If assets length is 0 should we delete the AdGroupExtensionSetting?
          Logger.log(
            this._googleAdsApi.updateAdGroupExtensionSetting(
              imageExtension[0].adGroupExtensionSetting.resourceName,
              assets.map(e => e.feedItemResourceName)
            )
          );
        } else {
          Logger.log('Nothing to update in Ad Group Extension Setting.');
        }
      }
    }
  }
}

function runImageExtensionService() {
  const imageExtensionService = new ImageExtensionService();
  imageExtensionService.run();
}
