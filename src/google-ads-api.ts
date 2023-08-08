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

export class GoogleAdsApi {
  private readonly _developerToken: string;
  private readonly _managerId: string;
  private readonly _customerId: string;
  private readonly _commonOptions: GoogleAds.Request;
  private readonly _basePath: string;

  constructor(developerToken: string, managerId: string, customerId: string) {
    this._developerToken = developerToken;
    this._managerId = managerId;
    this._customerId = customerId;
    this._commonOptions = {
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
        'developer-token': this._developerToken,
        'login-customer-id': this._managerId,
      },
    };
    this._basePath =
      'https://googleads.googleapis.com/v14/customers/' + this._customerId;
  }

  _getResult(httpResponse: GoogleAppsScript.URL_Fetch.HTTPResponse) {
    if (httpResponse.toString().startsWith('<!DOCTYPE html>')) {
      Logger.log('Unknown API error');
      return {};
    }
    return JSON.parse(httpResponse.getContentText('UTF-8'));
  }

  _buildUrl(url: string, params: any) {
    const paramString = Object.keys(params)
      .map(key => {
        return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      })
      .join('&');
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + paramString;
  }

  get(path: string, parameters: any) {
    const options = this._commonOptions;
    const url = this._buildUrl(this._basePath + path, parameters);
    options.method = 'get';
    return this._getResult(UrlFetchApp.fetch(url, options));
  }

  post(path: string, request: any, nextPageToken?: string) {
    const options = this._commonOptions;
    options.method = 'post';
    options.payload = JSON.stringify(request);
    if (nextPageToken) {
      options.pageToken = nextPageToken;
    }
    return this._getResult(UrlFetchApp.fetch(this._basePath + path, options));
  }

  executeSearch(query: string) {
    let nextPageToken: string | undefined = undefined;
    let results: any[] = [];
    const request = {
      query,
      pageSize: 10000,
    };
    do {
      const result = this.post('/googleAds:search', request, nextPageToken);
      if (result.error !== undefined) {
        throw new Error(JSON.stringify(result.error));
      } else if (result.results === undefined) {
        result.results = [];
      }
      results = results.concat(result.results);
      nextPageToken = result.nextPageToken;
    } while (nextPageToken);
    return results;
  }

  getAdGroups() {
    return this.executeSearch(GoogleAdsApi.QUERIES.ADGROUPS);
  }

  uploadImageAssets(files: GoogleCloud.Storage.Image[]) {
    Logger.log(`Uploading ${files.length} images...`);
    const operations = files.map(e => {
      return GoogleAdsApi.getCreateImageOperation(null, e.name, e.content);
    });
    const response = this._executeMutateOperations(operations);
    Logger.log(JSON.stringify(response, null, 2));
  }

  createExtensionFeedItem(imageAsset: string) {
    return this.post('/extensionFeedItems:mutate', {
      operations: [
        {
          create: {
            imageFeedItem: {
              imageAsset,
            },
          },
        },
      ],
    });
  }

  deleteExtensionFeedItem(resourceName?: string) {
    if (!resourceName) {
      return;
    }
    return this.post('/extensionFeedItems:mutate', {
      operations: [
        {
          remove: resourceName,
        },
      ],
    });
  }

  createAdGroupExtensionSetting(
    adGroupId: string,
    extensionFeedItems: string[]
  ) {
    return this.post('/adGroupExtensionSettings:mutate', {
      operations: [
        {
          create: {
            extensionType: 'IMAGE',
            extensionFeedItems,
            adGroup: `customers/${this._customerId}/adGroups/${adGroupId}`,
          },
        },
      ],
    });
  }

  updateAdGroupExtensionSetting(
    resourceName: string,
    extensionFeedItems: string[]
  ) {
    return this.post('/adGroupExtensionSettings:mutate', {
      operations: [
        {
          updateMask: 'extensionFeedItems',
          update: {
            resourceName,
            extensionFeedItems,
          },
        },
      ],
    });
  }

  getAssets(adGroup: string) {
    const feedItems = this.executeSearch(
      GoogleAdsApi.QUERIES.FEED_ITEMS
    ).reduce((acc, e) => {
      return {
        ...acc,
        [e.extensionFeedItem.imageFeedItem.imageAsset]:
          e.extensionFeedItem.resourceName,
      };
    }, {});
    const assets = this.executeSearch(
      GoogleAdsApi.QUERIES.ASSETS + ` AND asset.name LIKE '${adGroup}%'`
    ).map(e => {
      return {
        name: e.asset.name,
        resourceName: e.asset.resourceName,
        feedItemResourceName: feedItems[e.asset.resourceName],
      };
    });
    // TODO: Change asset name to include the Ad Group ID as well and search by that instead of name.
    return assets;
  }

  /**
   * Executes the given operations on the API, synchronously.
   *
   * @param {Array.<Object>} operations
   * @return {Object}
   */
  _executeMutateOperations(operations: Object[]): object {
    return this.post('/googleAds:mutate', { mutateOperations: operations });
  }

  /**
   * Yields an API operation to create an image asset.
   *
   * @param {string} [resourceName]
   * @param {string} fileName
   * @param {Array.<Byte>} fileBytes
   * @return {Object}
   */
  static getCreateImageOperation(
    resourceName: string | null,
    fileName: string,
    fileBytes: Array<number>
  ): object {
    const operation: GoogleAds.Operations.Asset = {
      assetOperation: {
        create: {
          type: 'IMAGE',
          name: fileName,
          imageAsset: { data: Utilities.base64Encode(fileBytes) },
        },
      },
    };
    if (resourceName) {
      operation.assetOperation.create.resourceName = resourceName;
    }
    return operation;
  }

  static get QUERIES() {
    return {
      SEARCH_ADS: `
        SELECT
          ad_group_ad.ad.final_urls,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions,
          ad_group_ad.status,
          ad_group.name,
          ad_group.resource_name
        FROM
          ad_group_ad
        WHERE
          ad_group_ad.ad.type = RESPONSIVE_SEARCH_AD
          AND ad_group_ad.status != REMOVED
        `,
      FEED_ITEMS: `
        SELECT extension_feed_item.image_feed_item.image_asset, extension_feed_item.resource_name, extension_feed_item.status, metrics.ctr, metrics.impressions FROM extension_feed_item WHERE extension_feed_item.extension_type = 'IMAGE' AND extension_feed_item.status != 'REMOVED'
      `,
      ASSETS: `
        SELECT asset.resource_name, asset.name FROM asset WHERE asset.type = 'IMAGE'
      `,
      ADGROUPS: `
        SELECT ad_group.name, ad_group.id, customer.id FROM ad_group  WHERE campaign.id IN (${CONFIG['Campaign IDs']}) AND ad_group.status = 'ENABLED'
      `,
      ADGROUP_EXTENSION_SETTINGS: `
        SELECT ad_group_extension_setting.resource_name, ad_group_extension_setting.extension_feed_items, ad_group.id FROM ad_group_extension_setting WHERE ad_group_extension_setting.extension_type = 'IMAGE'
      `,
    };
  }
}
