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
import {
  ImagePolicyViolations,
  PolicyViolation,
  POLICY_VIOLATIONS_FILE,
} from './gemini-validation-service';
import { GoogleAdsApiFactory } from './google-ads-api-mock';

export const FRONTEND_HELPER = null;

export enum IMAGE_STATUS {
  GENERATED = 'Generated',
  VALIDATED = 'Validated',
  UPLOADED = 'Uploaded',
  DISAPPROVED = 'Disapproved',
  BAD_PERFORMANCE = 'Bad performance',
  REJECTED = 'Manually rejected',
}

export interface AdGroup {
  name: string;
  id: string;
  images: Image[];
}

export interface ImageIssue {
  message: string;
  description: string;
}

export interface Image {
  filename: string;
  url: string;
  status: IMAGE_STATUS;
  selected?: boolean;
  issues?: ImageIssue[];
}

const gcsApi = new GcsApi(CONFIG['GCS Bucket']);

const getData = () => {
  const gcsImages = gcsApi.listAllImages(GoogleAdsApiFactory.getAdsAccountId());
  const adGroups: { [id: string]: Image[] } = {};
  if (!gcsImages.items) {
    return [];
  }

  gcsImages.items.forEach(e => {
    const statusFolder = e.name.split('/')[2];
    let status: IMAGE_STATUS | null = null;
    switch (statusFolder) {
      case CONFIG['Generated DIR']:
        status = IMAGE_STATUS.GENERATED;
        break;
      case CONFIG['Uploaded DIR']:
        status = IMAGE_STATUS.UPLOADED;
        break;
      case CONFIG['Validated DIR']:
        status = IMAGE_STATUS.VALIDATED;
        break;
      case CONFIG['Disapproved DIR']:
        status = IMAGE_STATUS.DISAPPROVED;
        break;
      case CONFIG['Bad performance DIR']:
        status = IMAGE_STATUS.BAD_PERFORMANCE;
        break;
      case CONFIG['Rejected DIR']:
        status = IMAGE_STATUS.REJECTED;
        break;
      default:
        break;
    }
    if (!status) {
      return;
    }
    const filename = e.name.split('/')[3];
    const adGroupId = filename.split('|')[0];
    if (!adGroups[adGroupId]) {
      adGroups[adGroupId] = [];
    }

    const issues = PolicyStatusByAdGroup.getIssues(adGroupId, filename);

    adGroups[adGroupId].push({
      filename,
      url: `https://storage.mtls.cloud.google.com/${CONFIG['GCS Bucket']}/${e.name}`,
      status,
      issues,
    });
  });
  const result: AdGroup[] = [];
  for (const [adGroupId, images] of Object.entries(adGroups)) {
    result.push({
      id: adGroupId,
      name: images[0].filename.split('|').slice(1, -1).join('|'),
      images,
    });
  }
  return result;
};

const setImageStatus = (images: Image[], status: IMAGE_STATUS) => {
  const gcsApi = new GcsApi(CONFIG['GCS Bucket']);
  images.forEach(image => {
    const adGroupId = image.filename.split('|')[0];
    gcsApi.moveImage(
      GoogleAdsApiFactory.getAdsAccountId(),
      adGroupId,
      image.filename,
      CONFIG['Generated DIR'],
      status === IMAGE_STATUS.VALIDATED
        ? CONFIG['Validated DIR']
        : CONFIG['Rejected DIR']
    );
  });
};

class PolicyStatusByAdGroup {
  /**
   * @property {Object} adGroupIssues Cache for the issues related to the
   *  specific ad group.
   */
  static adGroupIssues: {
    [adGroupId: string]: { [filename: string]: PolicyViolation[] };
  } = {};

  static getIssues(adGroupId: string, filename: string) {
    if (!(adGroupId in PolicyStatusByAdGroup.adGroupIssues)) {
      PolicyStatusByAdGroup.adGroupIssues[adGroupId] =
        PolicyStatusByAdGroup.getIssuesFromJson(adGroupId);
    }

    return filename in PolicyStatusByAdGroup.adGroupIssues[adGroupId]
      ? PolicyStatusByAdGroup.policyViolationsToImageIssues(
          PolicyStatusByAdGroup.adGroupIssues[adGroupId][filename]
        )
      : [];
  }

  static policyViolationsToImageIssues(policyViolations: PolicyViolation[]) {
    return policyViolations.map(pv => ({
      message: `Policy violation: "${pv.policy}"`,
      description: pv.reasoning,
    }));
  }

  static getIssuesFromJson(adGroupId: string): {
    [filename: string]: PolicyViolation[];
  } {
    const fullName = `${GoogleAdsApiFactory.getAdsAccountId()}/${adGroupId}/${
      CONFIG['Generated DIR']
    }/${POLICY_VIOLATIONS_FILE}`;

    try {
      const json = JSON.parse(gcsApi.getFile(fullName, true).toString());

      return json.reduce(
        (accumulator: any, currentValue: ImagePolicyViolations) => ({
          ...accumulator,
          [currentValue.image]: currentValue.violations,
        }),
        {}
      );
    } catch (e) {
      Logger.log(e);
      return {};
    }
  }
}
