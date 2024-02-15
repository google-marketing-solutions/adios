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

interface PolicyViolation {
  policy: string;
  reasoning: string;
}

interface ImagePolicyViolations {
  image: string;
  violations: PolicyViolation[];
}

export class GeminiValidationService {
  private readonly _gcsApi;
  private readonly _googleAdsApi;
  private readonly _vertexAiApi;

  private readonly sheetName = 'Policies';
  private readonly prompt = `
You are a policy checker who checks one by one the policies on the images and highlights the issues with the images.
Here is a list of policies (one policy per line):
"<policies>"

Please check the image and if it violates any policy please highlight those violations.
If there are violations respond in the following JSON format (as a JSON array):
[
  {
    "policy": Violated policy text,
    "reasoning": Reason: Explnation why the image violates that policy
  }, 
  ...
]
`;

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

  getPolicies() {
    const error = `Error: No policies are found. 
      Please write the policies in the sheet "${this.sheetName}". 
      Remember, the first row is always the header.`;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      this.sheetName
    );
    if (!sheet) {
      throw error;
    }

    const sheetData = sheet.getDataRange().getValues();
    if (!sheetData) {
      throw error;
    }

    return sheetData
      .map(x => x[0]) // Only the first column contains the policy text
      .slice(1) // Removing the header
      .join('\n');
  }

  run() {
    const prompt = this.prompt.replaceAll('<policies>', this.getPolicies());

    const adGroups = this._googleAdsApi.getAdGroups();
    for (const adGroup of adGroups) {
      Logger.log(
        `Processing Ad Group ${adGroup.adGroup.name} (${adGroup.adGroup.id})...`
      );

      const images = this._gcsApi.getImages(
        CONFIG['Account ID'],
        adGroup.adGroup.id,
        [CONFIG['Generated DIR']]
      );

      if (images.length === 0) {
        Logger.log('No images to validate.');
      } else {
        const violationsPerImage: ImagePolicyViolations[] = [];
        images.forEach(image => {
          const gcsPath = `gs://${CONFIG['GCS Bucket']}/${image.fullName}`;
          Logger.log(`Validating ${gcsPath}`);

          const validationResult = this._vertexAiApi.callGeminiApi(
            prompt,
            gcsPath
          );

          Logger.log('Response from Gemini:');
          Logger.log(validationResult);
          Logger.log(JSON.parse(validationResult));

          if (validationResult) {
            try {
              const json = JSON.parse(validationResult);
              if (json.length) {
                violationsPerImage.push({
                  image: image.name,
                  violations: json,
                });
              }
            } catch (e) {
              Logger.log(e);
            }
          }
        });

        if (violationsPerImage.length) {
          const jsonPath = `${adGroup.customer.id}/${adGroup.adGroup.id}/${CONFIG['Generated DIR']}/policyViolations.json`;
          Logger.log(`Saving violations on GCS: ${jsonPath}`);

          Logger.log(jsonPath);
          Logger.log(violationsPerImage);
          Logger.log(JSON.stringify(violationsPerImage));

          this._gcsApi.uploadFile(JSON.stringify(violationsPerImage), jsonPath);
        }
      }
    }

    Logger.log('Finished validating images.');
  }
}

function runGeminiValidationService() {
  const geminiValidationService = new GeminiValidationService();
  geminiValidationService.run();
}
