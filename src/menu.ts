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
        .addItem('Image generation', 'runImageGeneration')
        .addItem('Image upload', 'runImageUploadService')
        .addItem('Image extension linking', 'runImageExtensionService')
        .addItem('Create experiments', 'runExperimentsService')
        .addItem('Policy validation', 'runGeminiValidationService')
    )
    .addSubMenu(
      ui
        .createMenu('🕒 Schedule')
        .addSubMenu(
          ui
            .createMenu('All Services')
            .addItem('Every 30 mins', 'AdiosTriggers.allEvery30Mins')
            .addItem('Every 60 mins', 'AdiosTriggers.allEvery60Mins')
        )
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
  'runImageGeneration',
  'runImageUploadService',
  'runImageExtensionService',
];
class AdiosTriggers {
  /**
   * Adds a time driven trigger.
   * @param {number} howOften How often in minutes
   * @param {string} [functionToRun] Which function to schedule
   */
  static addTrigger(howOften: number, functionToRun?: string) {
    let allFunctions = [...allowedFunctions];
    if (functionToRun) {
      if (!allowedFunctions.includes(functionToRun)) {
        throw Error(`Function ${functionToRun} is not allowed to schedule`);
      }
      allFunctions = [functionToRun];
    }

    allFunctions.forEach(f => {
      ScriptApp.newTrigger(f).timeBased().everyMinutes(howOften).create();
    });
  }

  static allEvery30Mins() {
    AdiosTriggers.addTrigger(30);
  }

  static allEvery60Mins() {
    AdiosTriggers.addTrigger(60);
  }
}
