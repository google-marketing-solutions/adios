<!--
Copyright 2023 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->
# Adios: One-stop solution for Google Ads image assets management

## Overview

**Adios** is an open-source solution that can generate and/or upload image assets for your Ad Groups. If you already have images Adios will be able to upload them to the Google Ads asset library and link to the corresponding ad groups in bulk. If you don't, then Adios will use AI to generate personalised images based on the specified ad group context (e.g. based on the ad group name).

To generate images Adios uses Google Cloud's [Vertex AI image generation API](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview).

## Getting Started

1. Make a copy of the [template Spreadsheet](https://docs.google.com/spreadsheets/d/1YnFCTif5ruLqs4qJIMcJmvejMEhvFHBzkBwfDp_oWRE/copy?resourcekey=0-mj_eJDv4XRwv2zwOJnYXug)

1. Create or use an existing [Google Cloud Platform](https://console.cloud.google.com/) (GCP) project

    - Ensure that billing is enabled on the project

    - Enable the [Google Ads API](https://console.cloud.google.com/apis/api/googleads.googleapis.com)

    - Enable the [Cloud Storage API](https://console.cloud.google.com/apis/api/storage.googleapis.com)

    - If you would like to generate images, make sure that you have access to the [Vertex AI API](https://cloud.google.com/vertex-ai/docs/generative-ai/image/overview)

1. On the copied Spreadsheet, open Extensions > Apps Script

1. Go to Project Settings and [change the GCP project](https://developers.google.com/apps-script/guides/cloud-platform-projects)

1. Fill in the required configuration in the Spreadsheet, as instructed in the comments

1. Now you can run or schedule the Adios services using the Adios menu

## Development Guide

If you'd like to make your own changes to the solution or contribute to it, you can run the code as follows:

1. Follow the steps outlined in our [Contributing Guide](CONTRIBUTING)

1. Clone this repository

    ```
    git clone https://github.com/google-marketing-solutions/adios.git
    ```

1. Go to the newly created folder

    ```
    cd adios
    ```

1. Install dependencies

    ```
    npm install
    ```

1. Make a copy of the [template Spreadsheet](https://docs.google.com/spreadsheets/d/1YnFCTif5ruLqs4qJIMcJmvejMEhvFHBzkBwfDp_oWRE/copy?resourcekey=0-mj_eJDv4XRwv2zwOJnYXug)

1. On the copied Spreadsheet, open Extensions > Apps Script

1. Copy the Apps Script ID. For example:

    > script.google.com/[...]/projects/*<SCRIPT_ID>*/edit

1. Enable the Google Apps Script API (if you haven't done it before)
  <https://script.google.com/home/usersettings>

1. Initialize ASIDE

    ```
    npx @google/aside init && rm test/example-module.test.ts
    ```

    - **Don't replace or overwrite any of the files if asked to**

    - When prompted for the Script ID, enter the ID you copied in the previous step

    - (optional) If you would like to have a different environment for development and for production, make another copy of the template Spreadsheet and enter the Apps Script ID when prompted for a Script ID for production environment

1. Build the code

    ```
    npm run build
    ```

1. (optional) Run the UI locally

    It is possible to run the Angular validation UI locally.

    However, the functions which are supposed to run on the Apps Script back-end (`google.script.run`) cannot run locally, so there is a mock service for API calls ([api-calls.mock.service.ts](src/ui/src/app/api-calls/api-calls.mock.service.ts)) which mocks API responses (e.g. from Google Ads API) to test locally.

    Start the UI locally by running:

    ```
    npm run serve-ui
    ```

1. Deploy to Apps Script

    To deploy to the development environment run

    ```
    npm run deploy
    ```

    (optional) To deploy to the production environment run

    ```
    npm run deploy:prod
    ```

## Disclaimer

**This is not an official Google product.**
