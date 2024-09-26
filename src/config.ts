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
interface Config {
  'Ads API Key': string;
  'Manager ID': string;
  'Account ID': string;
  'Campaign IDs': string;
  'CTR Threshold': number;
  'Impression Threshold': number;
  'ImgGen Prompt': string;
  'ImgGen Prompt Suffix': string;
  'Number of images per Ad Group': number;
  'GCP Project': string;
  'GCS Bucket': string;
  'Max. bad images': number;
  'Disapproved DIR': string;
  'Bad performance DIR': string;
  'Uploaded DIR': string;
  'Generated DIR': string;
  'Validated DIR': string;
  'Rejected DIR': string;
  'Ad Group Name Regex': string;
  'Image Validation Prompt': string;
  'Adios Mode': string;
  'Text Prompt Context': string;
  'Text Prompt': string;
  'Text Prompt Suffix': string;
  'Prompt translations sheet': string;
  'Google Ads Mock Sheet': string;
  'GCP Region'?: string;
  'VertexAI Api Domain Part'?: string;
  'Gemini Model'?: string;
  'Image Generation Model'?: string;
}

export const sheet =
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config')!;
const DEFAULT_CONFIG = {
  'Ads API Key': '',
  'Manager ID': '',
  'Account ID': '',
  'Campaign IDs': '',
  'CTR Threshold': 0,
  'Impression Threshold': 0,
  'ImgGen Prompt': '${name}',
  'ImgGen Prompt Suffix': 'HDR, taken by professional',
  'Number of images per Ad Group': 0,
  'GCP Project': '',
  'GCS Bucket': '',
  'Max. bad images': 0,
  'Disapproved DIR': '',
  'Bad performance DIR': '',
  'Uploaded DIR': '',
  'Generated DIR': '',
  'Validated DIR': '',
  'Rejected DIR': '',
  'Image Validation Prompt': '',
  'Ad Group Name Regex': '^(?<name>.*)$', // capture everything by default
  'Adios Mode': '',
  'Text Prompt Context': '',
  'Text Prompt': '',
  'Text Prompt Suffix': '',
  'Prompt translations sheet': '',
  'Google Ads Mock Sheet': '',
  'GCP Region': undefined,
  'VertexAI Api Domain Part': undefined,
  'Gemini Model': undefined,
  'Image Generation Model': undefined,
};

export const ADIOS_MODES = {
  AD_GROUP: 'AdGroup Name',
  KEYWORDS: 'AdGroup Keywords',
};
export const ADIOS_MODE_CELL = 'B6';

export const CONFIG: Config =
  sheet
    ?.getRange('A2:B')
    .getDisplayValues()
    .filter(e => e[0])
    .reduce((res, e) => {
      return { ...res, [e[0]]: e[1] };
    }, DEFAULT_CONFIG) ?? DEFAULT_CONFIG;
