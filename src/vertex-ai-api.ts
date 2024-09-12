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
/**
 * Custom error class for Gemini API call failures.
 */
export class GeminiApiCallError extends Error {}
/**
 * Custom error class for image generation API call failures.
 */
export class ImageGenerationApiCallError extends Error {}
/**
 * Custom error class for JSON parsing errors.
 */
export class JsonParseError extends Error {}
/**
 * Main interface for the VertexAI api
 */
export class VertexAiApi {
  /**
   * Default options for UrlFetchApp.fetch(...) with the auth token
   */
  private readonly _baseOptions: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions =
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      },
    };
  /**
   * Limit on the image generation api side
   */
  readonly IMAGE_GENERATION_API_LIMIT = 4;
  /**
   * Creates a new client for interacting with Google Cloud's Vertex AI models.
   *
   * @constructor
   *
   * @param {string} _projectId - Your Google Cloud Project ID. This is required.
   * @param {string} [_region='us-central1'] - The region where your AI resources are located (e.g., 'us-central1', 'europe-west4'). Defaults to 'us-central1'.
   * @param {string} [_apiEndpoint='aiplatform.googleapis.com'] - The base API endpoint for Gemini. Usually, you won't need to change this.
   * @param {string} [_geminiModel='gemini-1.5-flash'] - The specific Gemini model for text generation tasks (e.g., 'gemini-1.5-flash'). Defaults to the latest flash model.
   * @param {string} [_imageGenerationModel='imagegeneration'] - The model for image generation tasks.
   */
  constructor(
    private _projectId: string,
    private _region = 'us-central1',
    private _apiEndpoint = 'aiplatform.googleapis.com',
    private _geminiModel = 'gemini-1.5-flash',
    private _imageGenerationModel = 'imagegeneration'
  ) {}
  /**
   * Constructs the API endpoint URL for the specified Gemini model.
   *
   * @protected
   * @param {string} model - The name of the Gen AI model (e.g., 'gemini-1.5-flash', 'imagegeneration').
   * @param {string} suffix - The model suffix. Can be found in the end point after ':' (e.g., 'generateContent', 'predict').
   * @returns {string} The complete API endpoint URL for making requests to the model.
   */
  protected getEndPoint(model: string, suffix: string) {
    return (
      `https://${this._region}-${this._apiEndpoint}/v1/projects/` +
      `${this._projectId}/locations/${this._region}/publishers/google/models/` +
      model +
      `:${suffix}`
    );
  }
  /**
   * Returns the specific API endpoint URL for the Gemini text model.
   *
   * @returns The Gemini API endpoint URL.
   * @protected
   */
  protected getGeminiEndPoint() {
    return this.getEndPoint(this._geminiModel, 'generateContent');
  }
  /**
   * Returns the specific API endpoint URL for the Vertex AI image generation model.
   *
   * @returns The image generation API endpoint URL.
   * @protected
   */
  protected getImageGenerationEndPoint() {
    return this.getEndPoint(this._imageGenerationModel, 'predict');
  }
  /**
   * Calls the Google Cloud Vertex AI API to generate images based on a text prompt.
   *
   * @param {string} prompt - The text prompt describing the desired image.
   * @param {number} [sampleCount=4] - (Optional) The number of image samples to generate. Defaults to 4.
   *
   * @returns {string[]} An array of base64-encoded image strings.
   *
   * @throws {ImageGenerationApiCallError} If the API call fails due to network issues, invalid credentials, or other errors.
   * @throws {JsonParseError} If there's an error parsing the JSON response from the Vision API.
   */
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
  /**
   * Calls the Gemini API to generate text responses, optionally using an image as context.
   *
   * @param {string} text - The text prompt to send to the Gemini model.
   * @param {string} [fileUri=''] - (Optional) A Google Cloud Storage URI (`gs://...`) to an image file for visual context.
   * @param {string} [image=''] - (Optional) Inline image data (base64 encoded) for visual context.  Use `fileUri` if possible for larger images.
   *
   * @returns {string} Generated text response from the Gemini model.
   *
   * @throws {GeminiApiCallError} If the API call fails due to network issues, invalid credentials, or other errors.
   * @throws {JsonParseError} If there's an error parsing the JSON response from the Gemini API.
   *
   * @remarks
   * Note: Only one of `fileUri` or `image` should be provided. If both are provided, `image` will be ignored.
   */
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
