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
export abstract class Triggerable {
  className: string;
  constructor() {
    this.className = this.constructor.name;
  }
  shouldTerminate() {
    const startTime = Number(
      PropertiesService.getScriptProperties().getProperty(
        `${this.className}StartTime`
      )
    );
    const elapsedTime = (new Date().getTime() - startTime) / 1000; // Time in seconds
    const threshold = 300; // 5 minutes threshold
    return elapsedTime > threshold;
  }
  createTriggerForNextRun() {
    const trigger = ScriptApp.newTrigger(`${this.className}.triggeredRun`)
      .timeBased()
      .after(2 * 60 * 1000) // Set to 2 minutes later
      .create();
    console.log('Created a trigger for next run.');
    PropertiesService.getScriptProperties().setProperty(
      `${this.className}TriggerId`,
      trigger.getUniqueId()
    );
  }
  deleteTrigger() {
    const triggerId = PropertiesService.getScriptProperties().getProperty(
      `${this.className}TriggerId`
    );
    if (triggerId) {
      const allTriggers = ScriptApp.getProjectTriggers();
      for (const trigger of allTriggers) {
        if (trigger.getUniqueId() === triggerId) {
          ScriptApp.deleteTrigger(trigger);
          console.log('Deleted used image extension trigger.');
          break;
        }
      }
      PropertiesService.getScriptProperties().deleteProperty(
        `${this.className}TriggerId`
      ); // Clear the trigger ID property
    }
  }
}
