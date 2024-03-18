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

interface VisionApiResponse {
  predictions: [
    {
      bytesBase64Encoded: string;
    }
  ];
}

interface GeminiRequest {
  text?: string;
  inlineData?: {
    image: string;
    mimeType: string;
  };
  fileData?: {
    fileUri: string;
    mimeType: string;
  };
}

export class VertexAiApi {
  private readonly _apiEndpoint: string;
  private readonly _projectId: string;
  private readonly _baseOptions: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;
  readonly VISION_API_LIMIT = 4;

  constructor(apiEndpoint: string, projectId: string) {
    this._apiEndpoint = apiEndpoint;
    this._projectId = projectId;
    this._baseOptions = {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      },
    };
  }

  callVisionApi(prompt: string, sampleCount = 4) {
    console.log('prompt', prompt);
    const options = Object.assign({}, this._baseOptions);
    const payload = {
      instances: [{ prompt }],
      parameters: {
        sampleCount,
      },
    };
    options.payload = JSON.stringify(payload);
    const result = UrlFetchApp.fetch(
      `https://${this._apiEndpoint}/v1/projects/${this._projectId}/locations/us-central1/publishers/google/models/imagegeneration:predict`,
      options
    );
    if (200 !== result.getResponseCode()) {
      Logger.log(result.getAllHeaders());
      throw `ERROR: ${result.getContentText()}`;
    }

    const resultParsed: VisionApiResponse = JSON.parse(
      result.getContentText('UTF-8')
    );
    return resultParsed.predictions?.map(e => e.bytesBase64Encoded);
  }

  callGeminiApi(text: string, fileUri = '', image = '') {
    const GEMINI_URI =
      `https://${this._apiEndpoint}/v1/projects/${this._projectId}` +
      `/locations/us-central1/publishers/google/models/gemini-pro-vision:streamGenerateContent`;
    const options = Object.assign({}, this._baseOptions);

    const mimeType = 'image/png';
    const parts: GeminiRequest[] = [{ text }];
    if (image) {
      parts.push({
        inlineData: { image, mimeType },
      });
    } else if (fileUri) {
      parts.push({
        fileData: { fileUri, mimeType },
      });
    }

    const payload = {
      contents: {
        role: 'user',
        parts: parts,
      },
      safety_settings: {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
      generation_config: {
        temperature: 0.4,
        topP: 1,
        topK: 10,
        maxOutputTokens: 2048,
      },
    };
    options.payload = JSON.stringify(payload);
    const result = UrlFetchApp.fetch(GEMINI_URI, options);
    if (200 !== result.getResponseCode()) {
      Logger.log(result.getAllHeaders());
      throw `ERROR: ${result.getContentText()}`;
    }
    const resultParsed = JSON.parse(result.getContentText('UTF-8'));
    let geminiResponse = '';
    resultParsed.forEach((geminiItem: any) => {
      geminiResponse +=
        geminiItem['candidates'][0]['content']['parts'][0]['text'];
    });
    return geminiResponse;
  }
}
