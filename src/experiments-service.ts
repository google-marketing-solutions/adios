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

export type AccountAndCampaign = {
  accountId: string;
  campaignId: string;
};

export class ExperimentsService {
  private readonly _googleAdsApi;

  constructor(private readonly _campaigns: AccountAndCampaign[]) {
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

    for (const campaign of this._campaigns) {
      Logger.log(
        `Creating experiment for campaign ${campaign.accountId}:${campaign.campaignId}.`
      );

      if (this._googleAdsApi.experimentExists(campaign.accountId, campaign.campaignId)) {
        Logger.log(
          `Experiment for campaign ${campaign.accountId}:${campaign.campaignId}
          already exists, cannot create a new one. Try removing the experiment
          or wait untill it is finished`
        );
        continue;
      }

      /*
      const experiment = this._googleAdsApi
        .createExperiment(campaign.accountId, campaign.campaignId);
      Logger.log(`Experiment ${experiment} was created.`);
      
      this._googleAdsApi.removeAdGroupLevelImageAssets(experiment);
      */
      Logger.log(`Ad Group level image extensions were removed.`);
    }

    Logger.log('Finished creating experiments.');
  }
}

function runExperimentsService() {
  if (!('Experiments sheet' in CONFIG) || !CONFIG['Experiments sheet']) {
    throw "Please specify 'Experiments sheet' in the config sheet";
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    CONFIG['Experiments sheet']
  );
  if (!sheet) {
    throw `Cannot open sheet "${CONFIG['Experiments sheet']}"`;
  }

  const campaigns = sheet
    .getRange('A2:B')
    .getDisplayValues()
    .filter(e => e[0])
    .map(e => {
      return {
        accountId: e[0],
        campaignId: e[1],
      };
    });

  const experimentsService = new ExperimentsService(campaigns);
  experimentsService.run();
}
