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

export class GeminiApiCallError extends Error {}
export class ImageGenerationApiCallError extends Error {}
export class JsonParseError extends Error {}

export class VertexAiApi {
  private readonly _baseOptions: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;
  readonly VISION_API_LIMIT = 4;

  constructor(
    private _projectId: string,
    private _region = 'us-central1',
    private _apiEndpoint = 'aiplatform.googleapis.com',
    private _geminiModel = 'gemini-1.5-flash:generateContent',
    private _imageGenerationModel = 'imagegeneration:predict'
  ) {
    this._baseOptions = {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      },
    };
  }

  protected getEndPoint(model: string) {
    return (
      `https://${this._region}-${this._apiEndpoint}/v1/projects/` +
      `${this._projectId}/locations/${this._region}/publishers/google/models/` +
      model
    );
  }

  protected getGeminiEndPoint() {
    return this.getEndPoint(this._geminiModel);
  }

  protected getImageGenerationEndPoint() {
    return this.getEndPoint(this._imageGenerationModel);
  }

  callImageGenerationApi(prompt: string, sampleCount = 4) {
    const options = Object.assign({}, this._baseOptions);
    const payload = {
      instances: [{ prompt }],
      parameters: {
        sampleCount,
      },
    };
    options.payload = JSON.stringify(payload);
    const result = UrlFetchApp.fetch(
      this.getImageGenerationEndPoint(),
      options
    );
    if (200 !== result.getResponseCode()) {
      console.error(
        'Call to image generation API failed',
        result.getAllHeaders(),
        result.getContentText()
      );
      throw new ImageGenerationApiCallError(result.getContentText());
    }

    const resultParsed: VisionApiResponse = JSON.parse(
      result.getContentText('UTF-8')
    );
    return resultParsed.predictions?.map(e => e.bytesBase64Encoded);
  }

  callGeminiApi(text: string, fileUri = '', image = '') {
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
    const result = UrlFetchApp.fetch(this.getGeminiEndPoint(), options);
    if (200 !== result.getResponseCode()) {
      console.error(
        'Call to Gemini API failed',
        result.getAllHeaders(),
        result.getContentText()
      );
      throw new GeminiApiCallError(result.getContentText());
    }

    let resultParsed: any;
    try {
      resultParsed = JSON.parse(result.getContentText('UTF-8'));
    } catch (e) {
      console.error(
        'JSON parse error for Gemini output',
        result.getContentText('UTF-8'),
        e
      );
      throw new JsonParseError(result.getContentText('UTF-8'));
    }

    const geminiResponse = resultParsed.candidates
      .map((candidate: any) =>
        candidate?.content?.parts?.map((part: any) => part?.text).join('')
      )
      .join('');
    return geminiResponse;
  }
}
