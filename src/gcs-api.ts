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

export class GcsApi {
  private readonly _BASE_PATH: string;
  private readonly _bucket: string;

  constructor(bucket: string) {
    this._BASE_PATH = `https://storage.googleapis.com`;
    this._bucket = bucket;
  }

  uploadFile(content: string, gcsPath: string) {
    const url = `${this._BASE_PATH}/upload/storage/v1/b/${this._bucket}/o?uploadType=media&name=${gcsPath}`;
    const accessToken = ScriptApp.getOAuthToken();

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: content,
      muteHttpExceptions: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const result = JSON.parse(response.getContentText());
    return `https://storage.cloud.google.com/${result.bucket}/${result.name}`;
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

  listImages(
    accountId: string,
    adGroupId: string,
    imageStatusFolders: string[]
  ) {
    const imageDirs = imageStatusFolders.join(',');

    // We want to exclude *.json metadata files
    const matchGlob = `${accountId}/${adGroupId}/{${imageDirs}}/*[^jJ][^sS][^oO][^nN]`;

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

  listAllImages(accountId: string) {
    return this.listImages(accountId, '*', ['*']);
  }

  getFile(fileName: string, isTextFile = false) {
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

    if (isTextFile) {
      return response.getContentText();
    }

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
        content: this.getFile(e.name),
      };
    });
    return images;
  }

  _deleteImage(
    accountId: string,
    adGroupId: string,
    fromDir: string,
    fileName: string
  ) {
    const objectPath = encodeURIComponent(
      `${accountId}/${adGroupId}/${fromDir}/${fileName}`
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

  moveImage(
    accountId: string,
    adGroupId: string,
    fileName: string,
    fromDir: string,
    toDir: string
  ) {
    const fromObject = encodeURIComponent(
      `${accountId}/${adGroupId}/${fromDir}/${fileName}`
    );
    const toObject = encodeURIComponent(
      `${accountId}/${adGroupId}/${toDir}/${fileName}`
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
      return this._deleteImage(accountId, adGroupId, fromDir, fileName);
    }
  }

  moveImages(
    accountId: string,
    adGroupId: string,
    images: GoogleCloud.Storage.Image[],
    fromDir: string,
    toDir: string
  ) {
    for (const image of images) {
      this.moveImage(accountId, adGroupId, image.name, fromDir, toDir);
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
      const newFileName = image.name.split('/').slice(-1)[0];

      const toFile = `${toAccountId}/${toAdGroupId}/${toDir}/${newFileName}`;
      Logger.log(`Copying from "${image.name}" to "${toFile}"`);
      this._copyImage(image.name, toFile);
    }
  }
}
