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
import { GoogleAdsApi } from './google-ads-api';

export class ExperimentsService {
  private readonly _googleAdsApi;
  private _campaigns: string[];

  constructor(private readonly _campaignsCsv: string) {
    this._campaigns = this._campaignsCsv
      .split(',')
      .map(e => e.trim())
      .filter(e => e);

    this._googleAdsApi = new GoogleAdsApi(
      CONFIG['Ads API Key'],
      CONFIG['Manager ID'],
      CONFIG['Account ID']
    );
  }

  run() {
    Logger.log(
      `Starting creation of experiments for ${this._campaigns.length} campaigns.`
    );

    // Since it is not possible to create experiments for the campaigns under
    // running experiments we filter out those campaigns.
    const eligibleCampaigns =
      this._googleAdsApi.filterOutCampaignsWithExperiments(this._campaigns);
    Logger.log(
      `Found ${eligibleCampaigns.length} eligible campaigns: (${eligibleCampaigns})`
    );

    const notEligibleCampaigns = this._campaigns.filter(
      e => !eligibleCampaigns.includes(e)
    );
    if (notEligibleCampaigns.length) {
      Logger.log(
        `*Note*: Experiments for the campaigns "${notEligibleCampaigns}" already 
        exist, cannot create new ones. Try switching off the experiments or wait 
        untill they are finished`
      );
    }

    for (const campaignId of eligibleCampaigns) {
      Logger.log(`Creating experiment for campaign ${campaignId}.`);

      const experiment = this._googleAdsApi.createExperiment(campaignId);
      Logger.log(`Experiment draft was created: ${experiment}`);

      const experimentArms = this._googleAdsApi.createExperimentArms(
        CONFIG['Account ID'],
        campaignId,
        experiment
      );
      Logger.log(
        `Experiment arms were created: ${JSON.stringify(experimentArms)}`
      );

      const campaignCopy =
        experimentArms.results[1].experimentArm.inDesignCampaigns[0];
      Logger.log(
        `Automatically created copy of the initial campaign: ${campaignCopy}`
      );

      const assetsToRemove = this._googleAdsApi
        .getAdGroupAssetsForCampaign(campaignCopy)
        .map(e => e.adGroupAsset.resourceName);
      Logger.log(
        `Following ${assetsToRemove.length} assets will be removed: ${assetsToRemove}`
      );

      Logger.log(
        'Assets removed: ' +
          JSON.stringify(
            this._googleAdsApi.removeAssetsFromAdGroup(assetsToRemove)
          )
      );

      Logger.log(
        'Scheduled the experiment: ' +
          JSON.stringify(this._googleAdsApi.scheduleExperiment(experiment))
      );
    }

    Logger.log('Finished creating all experiments.');
  }
}

function runExperimentsService() {
  const experimentsService = new ExperimentsService(CONFIG['Campaign IDs']);
  experimentsService.run();
}
