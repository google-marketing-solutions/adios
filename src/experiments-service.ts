import { transpileModule } from 'typescript';
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
      .map(e => '' + parseInt(e.trim()))
      .filter(e => e);

    this._googleAdsApi = new GoogleAdsApi(
      CONFIG['Ads API Key'],
      CONFIG['Manager ID'],
      CONFIG['Account ID']
    );
  }

  test() {
    const query = GoogleAdsApi.QUERIES.AD_GROUP_ASSETS_FOR_CAMPAIGN_ID.replace(
      '<campaign_id>',
      '844445550702759'
    );
    console.log(JSON.stringify(this._googleAdsApi.executeSearch(query)));
  }

  run() {
    Logger.log(
      `Starting creation of experiments for ${this._campaigns.length} campaigns.`
    );

    // Since it is not possible to create experiments for the campaigns under
    // runnign experiments we filter out those campaigns.
    const eligableCampaigns =
      this._googleAdsApi.filterOutCampaignsWithExperiments(this._campaigns);
    Logger.log(
      `Found ${eligableCampaigns.length} eligable campaigns: (${eligableCampaigns})`
    );

    const notEligableCampaigns = this._campaigns.filter(
      e => !eligableCampaigns.includes(e)
    );
    if (notEligableCampaigns) {
      Logger.log(
        `*Note*: Experiments for the campaigns "${notEligableCampaigns}" already 
        exist, cannot create new ones. Try removing the experiments or wait 
        untill they are finished`
      );
    }

    for (const campaignId of eligableCampaigns) {
      Logger.log(`Creating experiment for campaign ${campaignId}.`);

      const experiment = this._googleAdsApi.createExperiment(campaignId);
      Logger.log(`Partial experiment was created: ${experiment}`);

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
        .getAdGroupAssetsForCampaign(campaignCopy);

      /*
      this._googleAdsApi.removeAdGroupLevelImageAssets(experiment);
      Logger.log(`Ad Group level image extensions were removed.`);
     */
    }

    Logger.log('Finished creating experiments.');
  }
}

function runExperimentsService() {
  const experimentsService = new ExperimentsService(CONFIG['Campaign IDs']);
  experimentsService.test();
  //experimentsService.run();
}
