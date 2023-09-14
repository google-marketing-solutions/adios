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

  run() {
    const adGroups = this._googleAdsApi.getAdGroups();
    for (const adGroup of adGroups) {
      // TODO: Add logic to only generate images if < "Max. bad images"
      const existingImgCount = this._gcsApi.countImages(
        adGroup.customer.id,
        adGroup.adGroup.id,
        [CONFIG['Generated DIR'], CONFIG['Uploaded DIR']]
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
          `No matching groups found for ${adGroup.adGroup.name} with ${regex}. Using full prompt.`);
        prompt = CONFIG['ImgGen Prompt'];
      }
      const images = this._vertexAiApi.callVisionApi(adGroup.adGroup.name, prompt, imgCount);
      const images = this._vertexAiApi.callVisionApi(
        adGroup.adGroup.name,
        CONFIG['ImgGen Prompt'],
        imgCount
      );
      Logger.log(
        `Received ${images?.length || 0} images for ${adGroup.adGroup.name}(${
          adGroup.adGroup.id
        })...`
      );
      if (!images) {
        continue;
      }
      for (const image of images) {
        // TODO: Check for slashes in the Ad Group name
        const filename = `${adGroup.adGroup.id}|${
          adGroup.adGroup.name
        }|${Date.now()}`;
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
   * For a given string & regex return the match groups if they exist else null
   */
  getRegexMatchGroups(str, regex) {
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
  createPrompt(obj) {
    let prompt = CONFIG['ImgGen Prompt'];
    for (const [key, value] of Object.entries(obj)) {
      const regex = new RegExp('(\\${' + key + '})', 'gi');
      prompt = prompt.replaceAll(regex, value);
    }
    return prompt;
  }
}

function runImageGeneration() {
  const imageGenerationService = new ImageGenerationService();
  imageGenerationService.run();
}
