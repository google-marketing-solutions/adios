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
import { GoogleAdsApi, GoogleAdsApiInterface } from './google-ads-api';

export class GoogleAdsApiFactory {
  static mockAccountId = 'Mock';

  static checkSheet() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      CONFIG['Google Ads Mock Sheet']
    );
    if (!sheet) {
      throw `Mock sheet for Google Ads '${CONFIG['Google Ads Mock Sheet']}' does not exist.`;
    }
  }

  static createObject() {
    if (!CONFIG['Google Ads Mock Sheet']) {
      return new GoogleAdsApi(
        CONFIG['Ads API Key'],
        CONFIG['Manager ID'],
        CONFIG['Account ID']
      );
    }

    GoogleAdsApiFactory.checkSheet();

    Logger.log(
      `Mocking Google Ads API from the sheet '${CONFIG['Google Ads Mock Sheet']}'`
    );
    return new GoogleAdsApiMock(CONFIG['Google Ads Mock Sheet']);
  }

  static getAdsAccountId() {
    if (!CONFIG['Google Ads Mock Sheet']) {
      return CONFIG['Account ID'];
    }

    GoogleAdsApiFactory.checkSheet();

    return GoogleAdsApiFactory.mockAccountId;
  }
}

class GoogleAdsApiMock implements GoogleAdsApiInterface {
  protected data?: string[][];

  constructor(readonly sheetName: string) {
    this.data = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(sheetName)
      ?.getDataRange()
      .getDisplayValues()
      .slice(1); // Remove header row
  }

  getAdGroups() {
    if (!this.data) {
      return [];
    }

    return this.data.map(row => ({
      customer: { id: GoogleAdsApiFactory.mockAccountId },
      adGroup: {
        id: row[0],
        name: row[0],
      },
    }));
  }

  getKeywordsForAdGroup(id: string) {
    if (!this.data) {
      return [];
    }

    return this.data
      .filter(row => row[0] === id)
      .map(row => ({
        adGroupCriterion: {
          keyword: {
            text: row[1],
          },
        },
      }));
  }
}
