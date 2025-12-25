<p align="center">
  <a href="https://trueconf.com" target="_blank" rel="noopener noreferrer">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/TrueConf/.github/refs/heads/main/logos/logo-dark.svg">
      <img width="150" alt="trueconf" src="https://raw.githubusercontent.com/TrueConf/.github/refs/heads/main/logos/logo.svg">
    </picture>
  </a>
</p>

<h1 align="center">One-Click TrueConf Conference Integration for Your Website</h1>

<p align="center">This project demonstrates how easily you can integrate a conference on your website with automatic user connection to the conference</p>

<p align="center">
    <img src="https://img.shields.io/badge/Express.js-%23404d59.svg?logo=express&logoColor=%2361DAFB" />
    <a href="https://t.me/trueconf_chat" target="_blank">
        <img src="https://img.shields.io/badge/Telegram-2CA5E0?logo=telegram&logoColor=white" />
    </a>
    <a href="https://discord.gg/2gJ4VUqATZ">
        <img src="https://img.shields.io/badge/Discord-%235865F2.svg?&logo=discord&logoColor=white" />
    </a>
</p>

<p align="center">
  <a href="./README.md">English</a> /
  <a href="./README-ru.md">Русский</a>
</p>

<p align="center">
  <img src="assets/head_en.png" width="800" height="auto">
</p>

## Description

**Case:** On your website, a doctor can invite a patient to a video conference without requiring any complicated steps on the patient’s side. In the chat, the doctor clicks **Invite to conference**, and the patient is shown a form where they enter their name. With a single click, a guest account and a conference are created. The patient is automatically connected to the conference without any additional steps.

How it works:

1. The doctor and the patient are already authenticated in the medical services system (hereinafter — the **Website**) and each has a unique user identifier (ID) obtained at sign-in.

> [!TIP]
> In this example, the doctor already has an account on TrueConf Server, so we can use their TrueConf ID. In real-world scenarios where the doctor does not have an account on the server, you need to generate a TrueConf ID on the fly, as shown below in the patient example.

2. While chatting with the patient on the Website, the doctor determines that an online meeting is required and clicks the button to create a conference.
3. The Website then sends an invitation message to the chat, and the patient is presented with a connection form.
4. The patient sees the form in the chat, fills it out by entering their name (or it can be auto-filled from the user account if needed), and clicks **Join**.
5. A script on the Website automatically uses the TrueConf Server API to create a guest account for the patient based on their unique ID and starts a new video conference.
6. The patient instantly joins the conference using the specified name and unique ID.

Thus, this project showcases the integration of TrueConf video conferencing with any website, providing a quick and easy process for connecting participants, minimizing additional steps, and simplifying interaction for users.

## Preliminary Actions

1. Install the following dependencies:

   - Node.js version 18 or higher;
   - npm version 9 or higher.

1. Create an OAuth application on TrueConf Server by following the instructions [here](https://trueconf.com/blog/knowledge-base/how-to-get-started-with-trueconf-api) and grant the application the `conferences` permission.
1. Copy the `env.sample` file and fill it with values that match your
configuration:

```sh
copy env.sample .env   # For Windows
cp env.sample .env     # For macOS/Linux
```

1. Edit the `.env` file by filling it with the following values:

```env
SERVER=your.trueconf.server          # Address of your TrueConf server
CLIENT_ID=generated_client_id       # Client ID obtained when creating the OAuth application
CLIENT_SECRET=generated_client_secret  # Client secret obtained when creating the OAuth application
TRUECONF_ID=username_used_as_owner  # Username to be used as the conference owner (doctor)
PORT=3000                            # Optional: port on which the web application will run (default is 3000)
ALLOW_SELF_SIGNED=false              # Set to true if using a self-signed TLS certificate
```

1. Set the dependencies:

```bash
npm install
```

## Usage

* To start in development mode with automatic reload:

```bash
npm run dev
```

* To launch in production mode:

```bash
npm start
```

>[!TIP]
> If TrueConf Server uses a self-signed TLS certificate, the browser may block the page from loading (including inside an iframe) until the certificate is marked as trusted.
>
> Open TrueConf Server directly in the browser, for example https://10.110.2.240, confirm the security warning, and add an exception (or install the certificate as trusted). After that, the guest page and HTTPS embedding will work correctly.

Then open the address shown in the terminal after the project starts. By default, it is `http://localhost:3000`. In the window that opens, enter the patient’s name.

The web application will generate the conference payload (including access rights, invitations, and other data) and send it to the backend. The backend will perform the following steps:

1. Request an OAuth access token from your TrueConf Server.
1. Create and start a conference, assigning the doctor as the owner (the doctor’s TrueConf ID is specified in the `.env` file above).
1. Retrieve the iframe HTML and return it to the frontend, which will render the conference as a web application on your website.

## Frontend Architecture

- `public/js/conferencePayload.js` is a file that contains conference parameters.
It defines the access rights template for participants and constructs the
payload for creating a conference via the API, including parameters such as the
title, owner, description, and participant rights.
- `public/js/dom.js` is responsible for managing the state of the user interface.
This file defines functions for interacting with page elements, such as
showing/hiding registration, rendering an iframe with the video conference,
updating status, and handling user actions.
- `public/js/utils.js` — provides utility functions for error handling,
extracting, and rendering an iframe with TrueConf Web. This file also includes
the logic for creating an iframe from data received from the server.
- `public/js/main.js` is the main file for managing the interaction process with
the server and frontend. It retrieves the patient's name from the interface,
initiates a request to create a conference on the server, and upon receiving a
response from the server, displays an iframe with the videoconference in the
user interface.
- `public/js/MessageChannel.js` manages message listening from an embedded
iframe. This file tracks events such as the user leaving a conference and
performs necessary actions, like clearing the interface and resetting the state
when a conference exit occurs.

## Backend Architecture

The backend is built on `Express.js` and is managed through the `server.js` file.
It interacts with the TrueConf API to create and manage conferences. Main
components:

1. The file defines environment variables for connecting to the TrueConf Server
API via a created OAuth application.
1. API and routes:

   - The main page (/) sends HTML with environment variables for the frontend.
   - The `/api/conference` route handles the creation of a conference and retrieving
the list of connected clients via the TrueConf Server API.

1. Main features:

   - `fetchAccessToken()` retrieves the `access_token`;
   - `createTrueConfClient()` creates a client for interacting with the TrueConf
Server API.
   - `createConferenceLifecycle()` creates and starts a conference.
   - The `fetchWebClientClients()` function retrieves the list of clients connected
to the conference.

1. Actions are also logged and errors are processed.

## Troubleshooting Potential Errors

- If environment variables are missing in the .env file, the user interface will
display which variables were not provided.
- In case of `401` or `403` errors, ensure that the client ID and secret key
belong to the specified TrueConf Server.
- If you encounter a `400` error, verify that the user with the specified
TrueConf ID exists on the server.
- If you encounter a connection timeout, ensure that the server is accessible
from the machine running the application. Check if a secure connection to the
server is established and make sure the root certificate is installed (or trust
self-signed certificates).

## Useful materials

- [How to get started with TrueConf API](https://trueconf.com/blog/knowledge-base/how-to-get-started-with-trueconf-api)
- [Automatic deletion of conferences with TrueConf API](https://trueconf.com/blog/knowledge-base/how-to-delete-past-meetings-automatically)
- [How to connect a guest to a conference directly](https://trueconf.com/blog/knowledge-base/how-to-connect-a-guest-to-a-conference-directly)
- [How to Use TrueConf API to Make Video Calls from the Website](https://trueconf.com/blog/knowledge-base/how-to-use-trueconf-api-to-make-video-calls-from-the-website)
- [Embedding TrueConf video conferencing into your website](https://trueconf.com/blog/knowledge-base/embedding-trueconf-video-conferencing-into-your-website)
