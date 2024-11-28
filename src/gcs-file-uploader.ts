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

const activeSheetName = SpreadsheetApp.getActiveSheet().getName();
const storageBucket = CONFIG['GCS Bucket'];

function getGcsUploaderHtml(gcsDir: string) {
  return `
    <script>##script##</script>
    <div id="status" style="display: none;">
      <span style="animation: bounceIn 2s;">⏳</span>
      Loading... please wait
    </div>
    <div>
        <label for="file">Select all files you want to upload</label>
        <input id="gcsFileUploader" type="file" multiple="multiple" />
    </div>
    <div style="margin-top: 20px;">
        <button
            type="button"
            onClick="GCSFileUploader.uploadSelectedFiles('${storageBucket}', '${activeSheetName}', '${ScriptApp.getOAuthToken()}', '${gcsDir}')"
        >
            Upload to GCS bucket
        </button>
    </div>
  `;
}

class GCSFileUploader {
  static async sendFile(
    bucket: string,
    dir: string,
    accessToken: string,
    file: File
  ) {
    const gcsApiUrl =
      'https:/' + // because everything after "//" is removed
      '/storage.googleapis.com/upload/storage/v1/b/' +
      `${bucket}/o?uploadType=media&name=${encodeURIComponent(
        dir + '/' + file.name
      )}`;

    try {
      const response = await fetch(gcsApiUrl, {
        method: 'POST',
        body: file,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        console.log(response.body);
        throw new Error(`Response status: ${response.status}`);
      }
    } catch (e: any) {
      console.error(e.message);
    }
  }

  static async uploadSelectedFiles(
    bucket: string,
    dir: string,
    accessToken: string,
    gcsDir: string
  ) {
    const files = (
      document.getElementById('gcsFileUploader') as HTMLInputElement
    )?.files;

    if (files && files.length) {
      for (let i = 0; i < files.length; i++) {
        try {
          await GCSFileUploader.sendFile(
            bucket,
            dir + '/' + gcsDir,
            accessToken,
            files[i]
          );
        } catch (e: unknown) {
          console.error(e);
          if (e instanceof Error) {
            alert(`❗ERROR: ${e.message}`);
          }
        }
      }

      alert('✅ Done');
    } else {
      alert('❗No files are selected.');
    }
  }
}

const showGCSFileUploader = (gcsDir: string) => {
  if ('Config' === activeSheetName) {
    return SpreadsheetApp.getUi().alert(
      `❗ Sorry, you cannot use this function on the "Config" sheet :)
      Please select another one.`
    );
  }

  const html = getGcsUploaderHtml(gcsDir).replace(
    '##script##',
    GCSFileUploader.toString()
  );
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(250)
    .setHeight(300);

  SpreadsheetApp.getUi().showModelessDialog(
    htmlOutput,
    'Upload Files to GCS (Google Cloud Storage)'
  );
};

export const showGCSFileUploaderForGuidelines = () => {
  showGCSFileUploader('guidelines');
};

export const showGCSFileUploaderForRepurpose = () => {
  showGCSFileUploader('repurpose');
};
