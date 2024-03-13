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
import { VertexAiApi } from './vertex-ai-api';

export class ImageGenerationService {
  private readonly _gcsApi;
  private readonly _vertexAiApi;
  private readonly _googleAdsApi;

  constructor() {
    this._gcsApi = new GcsApi(CONFIG['GCS Bucket']);
    this._vertexAiApi = new VertexAiApi(
      'us-central1-aiplatform.googleapis.com',
      CONFIG['GCP Project']!
    );
    this._googleAdsApi = new GoogleAdsApi(
      CONFIG['Ads API Key'],
      CONFIG['Manager ID'],
      CONFIG['Account ID']
    );
  }

  getMockedAdGroups(sheetName: string) {
    const error = `Error: No policies are found. 
        Please write the policies in the sheet "${sheetName}". 
        Remember, the first row is always header.`;

    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      throw error;
    }

    const sheetData = sheet.getDataRange().getDisplayValues();
    if (!sheetData) {
      throw error;
    }

    return sheetData
      .slice(1) // Removing the header
      .map((x, index) => ({
        adGroup: {
          id: x[0],
          name: x[0],
        },
        customer: { id: 'mocked' },
      })); // Only the first column contains the policy text
  }

  getAdGroups() {
    if (CONFIG['Mock Ad Groups Sheet']) {
      return this.getMockedAdGroups(CONFIG['Mock Ad Groups Sheet']);
    }

    return this._googleAdsApi.getAdGroups();
  }

  run() {
    const adGroups = this.getAdGroups();
    for (const adGroup of adGroups) {
      Logger.log(
        `Processing Ad Group ${adGroup.adGroup.name} (${adGroup.adGroup.id})...`
      );
      // TODO: Add logic to only generate images if < "Max. bad images"
      const existingImgCount = this._gcsApi.countImages(
        adGroup.customer.id,
        adGroup.adGroup.id,
        [
          CONFIG['Generated DIR'],
          CONFIG['Uploaded DIR'],
          CONFIG['Validated DIR'],
        ]
      );
      if (existingImgCount >= CONFIG['Number of images per Ad Group']!) {
        Logger.log(
          `Ad Group ${adGroup.adGroup.name}(${adGroup.adGroup.id}) has enough generated images, skipping...`
        );
        continue;
      }
      // Generate images
      let imgCount =
        CONFIG['Number of images per Ad Group']! - existingImgCount;
      if (imgCount > CONFIG['Number of images per API call']) {
        imgCount = CONFIG['Number of images per API call'];
      }
      Logger.log(
        `Generating ${imgCount} images for ${adGroup.adGroup.name}(${adGroup.adGroup.id})...`
      );
      if (imgCount === 0) {
        continue;
      }
      const regex = new RegExp(CONFIG['Ad Group Name Regex']);
      const matchGroups = this.getRegexMatchGroups(adGroup.adGroup.name, regex);
      let prompt;
      if (matchGroups) {
        prompt = this.createPrompt(matchGroups);
      } else {
        Logger.log(
          `No matching groups found for ${adGroup.adGroup.name} with ${regex}. Using full prompt.`
        );
        prompt = CONFIG['ImgGen Prompt'];
      }

      if (CONFIG['ImgGen Prompt Suffix']) {
        prompt += ', ' + CONFIG['ImgGen Prompt Suffix'];
      }

      const images = this._vertexAiApi.callVisionApi(prompt, imgCount);
      Logger.log(
        `Received ${images?.length || 0} images for ${adGroup.adGroup.name}(${
          adGroup.adGroup.id
        })...`
      );
      if (!images) {
        continue;
      }
      for (const image of images) {
        const filename = this.generateImageFileName(
          adGroup.adGroup.id,
          adGroup.adGroup.name
        );
        const folder = `${adGroup.customer.id}/${adGroup.adGroup.id}/${CONFIG[
          'Generated DIR'
        ]!}`;
        const imageBlob = Utilities.newBlob(
          Utilities.base64Decode(image),
          'image/png',
          filename
        );
        this._gcsApi.uploadImage(imageBlob, filename, folder);
      }
    }
    Logger.log('Finished generating.');
  }
  /**
   * Create the image file name.
   *
   * Google Ads filenames can be up to 128 characters long. If a long ad group
   * name is provided as an argument, this will be trimmed so that the final
   * name does not exceed this.
   *
   * @param {number} adGroupId: the ID of the ad group
   * @param {string} adGroupName: the name of the ad group
   * @returns {string} a file name that's less than 128 characters long, that
   *   takes the form `adGroupId|adGroupName|timestamp`
   */
  generateImageFileName(adGroupId: number, adGroupName: string) {
    // Remove any slashes in the ad group name as that would be problematic with
    // the file path
    adGroupName = adGroupName.replaceAll('/', '');
    // Some ad group names can be very long. Trim them to stay within the 128
    // character limit.
    const fileNameLimit = 128;
    const now = Date.now().toString();
    // These are the | characters added to the final string.
    const extraChars = 2;
    const adGroupNameLimit =
      fileNameLimit - now.length - adGroupId.toString().length - extraChars;
    const trimmedAdGroupName = adGroupName.slice(0, adGroupNameLimit);
    return `${adGroupId}|${trimmedAdGroupName}|${Date.now()}`;
  }
  /**
   * For a given string & regex return the match groups if they exist else null
   */
  getRegexMatchGroups(str: string, regex: RegExp) {
    const regexMatch = str.match(regex);
    if (regexMatch !== null) {
      return regexMatch.groups;
    }
    return null;
  }
  /**
   * Inject the values from the object into the prompt and return.
   *
   * A prompt can have placeholders for keys in the object. For example:
   * "A photo of a ${city} in sharp, 4k".
   * If an object with { 'city': 'London' } is provided it will replace the
   * placeholder and return "A photo of a London in sharp, 4k".
   */
  createPrompt(obj: { [key: string]: string }) {
    let prompt = CONFIG['ImgGen Prompt'];
    for (const [key, value] of Object.entries(obj)) {
      prompt = prompt.replaceAll('${' + key + '}', value);
    }
    return prompt;
  }
}

function runImageGeneration() {
  const imageGenerationService = new ImageGenerationService();
  imageGenerationService.run();
}
