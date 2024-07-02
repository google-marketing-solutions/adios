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

export abstract class GoogleAdsApiInterface {
  abstract getAdGroups(): any[];
  abstract getKeywordsForAdGroup(id: string): any[];
}

export class GoogleAdsApi implements GoogleAdsApiInterface {
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
      'https://googleads.googleapis.com/v17/customers/' + this._customerId;
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
    this._executeMutateOperations(operations);
  }

  createAdGroupAssets(
    adGroup: string,
    imageAssets: GoogleAds.Entities.Asset[]
  ) {
    const operations = imageAssets.map(e => ({
      create: {
        ad_group: adGroup,
        asset: e.resourceName,
        field_type: 'AD_IMAGE',
      },
    }));

    return this.post('/adGroupAssets:mutate', {
      customer_id: this._customerId,
      operations,
    });
  }

  deleteAdGroupAssets(resourceNames: string[]) {
    const operations = resourceNames.map(e => ({
      remove: e,
    }));

    return this.post('/adGroupAssets:mutate', {
      customer_id: this._customerId,
      operations,
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

  getAssetsForAdGroup(adGroupId: string) {
    const adGroupAssets = this.getAdGroupAssetsForAdGroup(adGroupId).reduce(
      (acc, e) => ({
        ...acc,
        [e.adGroupAsset.asset]: e.adGroupAsset.resourceName,
      }),
      {}
    );

    const assets = this.executeSearch(
      GoogleAdsApi.QUERIES.ASSETS + ` AND asset.name LIKE '${adGroupId}|%'`
    ).map(e => ({
      name: e.asset.name,
      resourceName: e.asset.resourceName,
      adGroupAssetResourceName: adGroupAssets[e.asset.resourceName],
    }));

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
        SELECT
          extension_feed_item.image_feed_item.image_asset,
          extension_feed_item.resource_name,
          extension_feed_item.status,
          extension_feed_item.targeted_campaign,
          extension_feed_item.targeted_ad_group,
          metrics.ctr,
          metrics.impressions
        FROM
          extension_feed_item
        WHERE
          extension_feed_item.extension_type = 'IMAGE'
          AND extension_feed_item.status != 'REMOVED'
      `,
      AD_GROUP_ASSETS_FOR_CAMPAIGN_ID: `
        SELECT
          ad_group_asset.resource_name,
          campaign.id
        FROM
          ad_group_asset
        WHERE
          ad_group_asset.field_type = 'AD_IMAGE'
          AND ad_group_asset.primary_status != 'REMOVED'
          AND campaign.id = <campaign_id>

        PARAMETERS include_drafts=true
      `,
      AD_GROUP_ASSETS_FOR_AD_GROUP_ID: `
        SELECT
          ad_group.id,
          ad_group_asset.resource_name,
          ad_group_asset.asset,
          asset.name
        FROM
          ad_group_asset
        WHERE
          ad_group_asset.field_type = 'AD_IMAGE'
          AND ad_group_asset.primary_status != 'REMOVED'
          AND ad_group.id = <ad_group_id>
          AND asset.name LIKE '<ad_group_id>|%'
      `,
      ALL_AD_GROUP_ASSETS_FOR_AD_GROUP_ID: `
        SELECT
          ad_group.id,
          ad_group_asset.resource_name,
          ad_group_asset.asset,
          asset.name
        FROM
          ad_group_asset
        WHERE
          ad_group_asset.field_type = 'AD_IMAGE'
          AND ad_group_asset.primary_status != 'REMOVED'
          AND ad_group.id = <ad_group_id>
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
      EXPERIMENT_ARMS: `
        SELECT experiment_arm.campaigns FROM experiment_arm WHERE experiment.status = 'ENABLED'
      `,
      KEYWORDS_FOR_ADGROUP_ID: `
        SELECT
          ad_group_criterion.keyword.text
        FROM ad_group_criterion
        WHERE ad_group.id = <ad_group_id>
        AND ad_group_criterion.status = 'ENABLED'
        AND ad_group_criterion.negative = FALSE
        LIMIT 1000
      `,
    };
  }

  /**
   * Returns a list of campaigns for which experiments can be created.
   *
   * @param campaignIds List of campaigns where experiments need to be created
   */
  filterOutCampaignsWithExperiments(campaignIds: string[]) {
    const campaignsWithExperiments = this.executeSearch(
      GoogleAdsApi.QUERIES.EXPERIMENT_ARMS
    )
      .map(e => e.experimentArm.campaigns)
      .reduce(
        (acc, value) =>
          acc.concat(value.map((e: string) => e.split('/').slice(-1)).flat()),
        []
      );

    return campaignIds.filter(e => !campaignsWithExperiments.includes(e));
  }

  /**
   * Creates a partial experiment (without experiment arms)
   *
   * @param campaignId Campaign ID
   */
  createExperiment(campaignId: string) {
    const experiment = {
      // Name must be unique.
      name: `Adios Experiment for campaignId ${campaignId} (timestamp:${Date.now()})`,
      type: 'SEARCH_CUSTOM',
      suffix: '[Adios Experiment]',
      status: 'SETUP',
    };

    const operationResult = this.post('/experiments:mutate', {
      operations: [{ create: experiment }],
    });

    return operationResult.results[0].resourceName;
  }

  /**
   * Creates both A and B variants (aka experiment arms) of the A/B test
   *
   * @param customerId Customer Id
   * @param campaignId Campaign Id
   * @param experiment Experiment resource name
   * @returns Result of the API call
   */
  createExperimentArms(
    customerId: string,
    campaignId: string,
    experiment: string
  ) {
    const contrtolArm = {
      experiment,
      name: 'Version A (with ad group assets)',
      control: true,
      traffic_split: 50,
      campaigns: [`customers/${customerId}/campaigns/${campaignId}`],
    };

    const testArm = {
      experiment,
      name: 'Version B (without ad group assets)',
      control: false,
      traffic_split: 50,
    };

    const operationResult = this.post('/experimentArms:mutate', {
      customer_id: customerId,
      operations: [{ create: contrtolArm }, { create: testArm }],
      // To get automatically created campaign name
      response_content_type: 'MUTABLE_RESOURCE',
    });

    return operationResult;
  }

  /**
   * The in design campaign will be converted into a real campaign.
   *
   * @param resourceName
   */
  scheduleExperiment(resourceName: string) {
    return this.post(
      `/experiments/${this._getIdFromResourceName(
        resourceName
      )}:scheduleExperiment`,
      {}
    );
  }

  /**
   * Gets the last part in the the pattern XXX/YYY/ZZZ/<lastPart>
   *
   * @param resourceName
   */
  _getIdFromResourceName(resourceName: string) {
    return resourceName.split('/').slice(-1)[0];
  }

  /**
   * Returns the list of ad group level assets for the specific campaign
   *
   * @param campaignResourceName Resource name
   */
  getAdGroupAssetsForCampaign(campaignResourceName: string) {
    const campaignId = this._getIdFromResourceName(campaignResourceName);
    const query = GoogleAdsApi.QUERIES.AD_GROUP_ASSETS_FOR_CAMPAIGN_ID.replace(
      '<campaign_id>',
      campaignId
    );

    return this.executeSearch(query);
  }

  /**
   * Returns the list of Adios-managed ad group level assets for the specific
   * ad group
   *
   * @param adGroupId Ad Group ID
   */
  getAdGroupAssetsForAdGroup(adGroupId: string) {
    const query =
      GoogleAdsApi.QUERIES.AD_GROUP_ASSETS_FOR_AD_GROUP_ID.replaceAll(
        '<ad_group_id>',
        adGroupId
      );

    return this.executeSearch(query);
  }

  /**
   * Returns the list of all (including non-Adios-managed) ad group level assets
   * for the specific ad group
   *
   * @param adGroupId Ad Group ID
   */
  getAllAdGroupAssetsForAdGroup(adGroupId: string) {
    const query =
      GoogleAdsApi.QUERIES.ALL_AD_GROUP_ASSETS_FOR_AD_GROUP_ID.replaceAll(
        '<ad_group_id>',
        adGroupId
      );

    return this.executeSearch(query);
  }

  /**
   * Returns the list of keywords for the specific ad group
   *
   * @param adGroupId Ad Group ID
   */
  getKeywordsForAdGroup(adGroupId: string) {
    const query = GoogleAdsApi.QUERIES.KEYWORDS_FOR_ADGROUP_ID.replaceAll(
      '<ad_group_id>',
      adGroupId
    );

    return this.executeSearch(query);
  }

  /**
   * Remove the specified assets from the ad group
   *
   * @param assets Array of asset resourceNames
   */
  removeAssetsFromAdGroup(assets: string[]) {
    return this.post('/adGroupAssets:mutate', {
      operations: assets.map(e => ({ remove: e })),
    });
  }
}
