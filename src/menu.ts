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
export const menu = null;
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Adios')
    .addSubMenu(
      ui
        .createMenu('▶️ Run')
        .addItem('Image generation', 'ImageGenerationService.manuallyRun')
        .addItem('Image upload', 'ImageUploadService.manuallyRun')
        .addItem('Image assets linking', 'ImageExtensionService.manuallyRun')
        .addItem('Create experiments', 'runExperimentsService')
        .addItem('Policy validation', 'runGeminiValidationService')
    )
    .addSubMenu(
      ui
        .createMenu('🕒 Schedule')
        .addItem('Every day', 'AdiosTriggers.scheduleForEveryDay')
    )
    .addToUi();
  // Show only the corresponding rows for the Adios Mode on page load
  toggleRows(sheet.getRange(ADIOS_MODE_CELL).getValue());
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
