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

export class GcsApi {
  private readonly _BASE_PATH: string;
  private readonly _bucket: string;

  constructor(bucket: string) {
    this._BASE_PATH = `https://storage.googleapis.com`;
    this._bucket = bucket;
  }

  uploadImage(
    blob: GoogleAppsScript.Base.Blob,
    name: string,
    folderName: string
  ): string {
    const fullName = encodeURIComponent(`${folderName}/${name}`);
    const url = `${this._BASE_PATH}/upload/storage/v1/b/${this._bucket}/o?uploadType=media&name=${fullName}`;
    const bytes = blob.getBytes();
    const accessToken = ScriptApp.getOAuthToken();

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: blob.getContentType(),
      payload: bytes,
      muteHttpExceptions: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const result = JSON.parse(response.getContentText());
    return `https://storage.cloud.google.com/${result.bucket}/${result.name}`;
  }

  listImages(accountId: string, adGroupId: string, imageTypes: string[]) {
    const imageDirs = imageTypes.join(',');
    const matchGlob = `${accountId}/${adGroupId}/{${imageDirs}}/*`;
    const url = `${this._BASE_PATH}/storage/v1/b/${
      this._bucket
    }/o?matchGlob=${encodeURIComponent(matchGlob)}`;
    const accessToken = ScriptApp.getOAuthToken();

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const result: GoogleCloud.Storage.ListResponse = JSON.parse(
      response.getContentText()
    );
    return result;
  }

  _getImage(fileName: string) {
    const url = `${this._BASE_PATH}/storage/v1/b/${
      this._bucket
    }/o/${encodeURIComponent(fileName)}?alt=media`;
    const accessToken = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.getContent();
  }

  countImages(
    accountId: string,
    adGroupId: string,
    imageTypes: string[]
  ): number {
    const result = this.listImages(accountId, adGroupId, imageTypes);
    return result.items?.length || 0;
  }

  getImages(accountId: string, adGroupId: string, imageTypes: string[]) {
    const imageList = this.listImages(accountId, adGroupId, imageTypes);
    if (!imageList?.items?.length) {
      return [];
    }
    const images = imageList.items.map(e => {
      return {
        name: e.name.split('/').slice(-1)[0],
        fullName: e.name,
        content: this._getImage(e.name),
      };
    });
    return images;
  }

  _deleteImage(accountId: string, adGroupId: string, fileName: string) {
    const objectPath = encodeURIComponent(
      `${accountId}/${adGroupId}/${CONFIG['Generated DIR']}/${fileName}`
    );
    const url = `${this._BASE_PATH}/storage/v1/b/${this._bucket}/o/${objectPath}`;
    const accessToken = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(url, {
      method: 'delete',
      muteHttpExceptions: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.getResponseCode();
  }

  _moveImage(accountId: string, adGroupId: string, fileName: string) {
    const fromObject = encodeURIComponent(
      `${accountId}/${adGroupId}/${CONFIG['Generated DIR']}/${fileName}`
    );
    const toObject = encodeURIComponent(
      `${accountId}/${adGroupId}/${CONFIG['Uploaded DIR']}/${fileName}`
    );
    const url = `${this._BASE_PATH}/storage/v1/b/${this._bucket}/o/${fromObject}/rewriteTo/b/${this._bucket}/o/${toObject}`;
    const accessToken = ScriptApp.getOAuthToken();

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      muteHttpExceptions: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (response.getResponseCode() === 200) {
      return this._deleteImage(accountId, adGroupId, fileName);
    }
  }

  moveImages(
    accountId: string,
    adGroupId: string,
    images: GoogleCloud.Storage.Image[]
  ) {
    for (const image of images) {
      this._moveImage(accountId, adGroupId, image.name);
    }
  }

  _copyImage(fromFile: string, toFile: string) {
    const fromObject = encodeURIComponent(fromFile);
    const toObject = encodeURIComponent(toFile);
    const url = `${this._BASE_PATH}/storage/v1/b/${this._bucket}/o/${fromObject}/rewriteTo/b/${this._bucket}/o/${toObject}`;
    const accessToken = ScriptApp.getOAuthToken();

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      muteHttpExceptions: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.getResponseCode();
  }

  copyAllImages(
    fromAccountId: string,
    fromAdGroupId: string,
    fromDirs: string[],
    toAccountId: string,
    toAdGroupId: string,
    toDir: string
  ) {
    Logger.log(
      `Starting copying the files FROM account "${fromAccountId}" ad group "${fromAdGroupId}" TO account "${toAccountId}" ad group "${toAdGroupId}"`
    );
    const images = this.listImages(fromAccountId, fromAdGroupId, fromDirs);
    if (!images?.items?.length) {
      Logger.log('Empty files list, nothing to copy');
      return;
    }

    for (const image of images.items) {
      const newFileName = image.name
        .split('/')
        .slice(-1)[0]
        .replace(/_br\|/, '_ph|');
      const toFile = `${toAccountId}/${toAdGroupId}/${toDir}/${newFileName}`;
      Logger.log(`Copying from "${image.name}" to "${toFile}"`);
      this._copyImage(image.name, toFile);
    }
  }
}
