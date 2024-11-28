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

import { ADIOS_MODES, ADIOS_MODE_CELL, sheet } from './config';
import {
  showGCSFileUploaderForGuidelines,
  showGCSFileUploaderForRepurpose,
} from './gcs-file-uploader';

export const menu = null;
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('DemandGen 🚀')
    //.addItem('Download campaigns from Ads', 'notImplemented')
    .addItem(
      'Upload guidelines (CI/brand/etc.)',
      showGCSFileUploaderForGuidelines.name
    )
    .addItem('Upload images to repurpose', showGCSFileUploaderForRepurpose.name)
    .addItem(
      'Extract the guidelines',
      'PmaxGenerationService.getGuidelinesFromFiles'
    )
    .addItem(
      'Generate: Text Assets',
      'PmaxGenerationService.generateTextAssets'
    )
    .addItem('Generate: Image Assets', 'PmaxGenerationService.manuallyRun')
    //.addItem('Upload to Ads', 'notImplemented')
    //.addItem('Suggest improvements', 'notImplemented')
    .addToUi();
  // Show only the corresponding rows for the Adios Mode on page load
  toggleRows(sheet.getRange(ADIOS_MODE_CELL).getValue());
}

function notImplemented() {
  SpreadsheetApp.getUi().alert(
    '⚠️ Demo Environment: Sorry, this feature is off now'
  );
}

function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit) {
  if (e.range.getA1Notation() === ADIOS_MODE_CELL) {
    const adiosMode = sheet.getRange(ADIOS_MODE_CELL).getValue();
    toggleRows(adiosMode);
  }
}
function toggleRows(adiosMode: string) {
  switch (adiosMode) {
    case ADIOS_MODES.AD_GROUP:
      // Show rows 7,8. Hide rows 9,10,11
      sheet.showRows(7, 2);
      sheet.hideRows(9, 3);
      break;
    case ADIOS_MODES.KEYWORDS:
      // Hide rows 7,8. Show rows 9,10,11
      sheet.showRows(9, 3);
      sheet.hideRows(7, 2);
      break;
    default:
      console.error(`Unknown mode: ${adiosMode}`);
  }
}

const allowedFunctions = [
  'ImageGenerationService.manuallyRun',
  'ImageUploadService.manuallyRun',
  'ImageExtensionService.manuallyRun',
];
class AdiosTriggers {
  /**
   * Adds time driven triggers.
   */
  static scheduleForEveryDay() {
    allowedFunctions.forEach(f =>
      ScriptApp.newTrigger(f).timeBased().everyDays(1).create()
    );
  }
}
