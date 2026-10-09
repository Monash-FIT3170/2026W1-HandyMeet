# 2026W1-HandyMeet

### Project Overview

HandyMeet is a real time video conferencing platform built with accessibility as its focus, offering features such as gesture controls, live captions and sign-language interpretation. It's designed for people who face barriers with existing video conferencing tools, such as people with audio or visual impairments, as well as general users through features like automatic meeting summaries and live action item generation.

## Current Features

- Live video conferencing through LiveKit
- Meeting chat and screen sharing
- Live speech transcription and captions
- Gesture and sign language recognition using MediaPipe and a custom TensorFlow.js model
- Integrated tldraw whiteboard synchronised through LiveKit
- Live Action-item extraction using Groq
- Post-meeting transcript summary using Gemini

## Requirements

### Software Requirements

The following software is required for development of HandyMeet.

- Docker
  used to build and run the application locally (https://www.docker.com/get-started/)
- Git
  Used to clone and manage the repository
- Node.js
  Used to run the project without Docker (v26.10.0 is recommended)
- npm
  Used to install dependencies and run development scripts
- Accounts and API keys for:
  - LiveKit Cloud
  - Deepgram
  - Google AI Studio (Gemini)
  - Groq
  - tldraw

### Hardware Requirements

A device for development of all features requires:

- Webcam
- Microphone
- Audio Output (speakers, headphones)
- Internet Connection

### Browser Requirements

HandyMeet is desgined mainly for Chromium browsers or any modern browser with support for:

- WebRTC
- Camera and Microphone access
- WebGL
- JavaScript
- WebSockets

Chrome is the main recommended development browser.

## Getting Started

### 1. Cloning the Repository

```
git clone https://github.com/Monash-FIT3170/2026W1-HandyMeet.git
cd <repository-folder>
```

### 2. Configure environment variables

In the project root, copy `.env.example` to `.env.local`:

```
cp .env.example .env.local
```

`.env.local` will contain all the API keys and sensitive credentials and should never be committed to Git.

`.env.example` should never be populated with API keys/secret values.

| Variable                                  | Purpose                       | Source                  |
| ----------------------------------------- | ----------------------------- | ----------------------- |
| `LIVEKIT_URL` / `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit project WebSocket URL | LiveKit Cloud dashboard |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`  | LiveKit project auth          | LiveKit Cloud dashboard |
| `DEEPGRAM_API_KEY`                        | Transcription agent STT       | Deepgram dashboard      |
| `GEMINI_API_KEY`                          | Transcript summary            | Google AI Studio        |
| `NEXT_PUBLIC_TLDRAW_LICENSE_KEY`          | Whiteboard (tldraw) license   | tldraw                  |
| `GROQ_API_KEY`                            | Live Action item detection    | GroqCloud               |

For CI and deployment, these values are stored as **GitHub Environment secrets** under the `production` environment.

## Running with Docker

Open a terminal tab and from the project root, run:

```
docker compose up --build
```

This command builds all the required Docker images and starts HandyMeet. On the first build of the application expect a 5-10 minute build period.

On subsequent builds, if no dependecies or Docker-related files are edited, the application can be started with this command instead:

```
docker compose up
```

Once the containers are running and the previous command is complete, open:

```
http://localhost:<PORT>
```

Most likely, this port will be 3000, but Docker can specify another port in the terminal output:

```
http://localhost:3000
```

To stop the application:

```
docker compose down
```

## Running without Docker

For faster development, the application can be run directly without Docker.

Install dependecies:

```
npm install
```

Start the development server:

```
npm run dev
```

In your browser open:

```
http://localhost:3000
```

The caption agent will also need to be manually run:

```
node --env-file=.env.local ./agent/transcription.ts dev
```

## Confirming the caption agent has joined a meeting

When a meeting room is created, the LiveKit agent should also join the room, this can be verified by:

1. Start the application (with Docker or without Docker including running the caption agent command)

2. Create a HandyMeet meeting room

3. Ensure your microphone is unmuted, and speak into the microphone

4. Confirm the live captions appears at the bottom

5. Check the LiveKit agent logs for a successful room connection.

## Running Tests

Install dependecies:

```
npm install
```

Run the project's tests with:

```
npm test
```

Note: the project currently uses `react-test-renderer` for some React unit tests.
However `react-test-renderer` has been deprecated, so future developers should consider migrating these tests to a more modern supported testing approach.

## Architecture

HandyMeet consists of several cooperating components.

                         ┌──────────────────────┐
                         │      User Browser    │
                         │                      │
                         │ Next.js / React UI   │
                         │ MediaPipe            │
                         │ TensorFlow.js Model  │
                         │ tldraw Whiteboard    │
                         └──────────┬───────────┘
                                    │
                             WebRTC / WebSocket
                                    │
                           ┌────────▼────────┐
                           │    LiveKit      │
                           │     Cloud       │
                           └───────┬─────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      LiveKit Agent          │
                    │        TypeScript           │
                    │                             │
                    │ Deepgram transcription      │
                    │ Gemini summaries            │
                    │ Groq action-item processing │
                    └─────────────────────────────┘

### Next.js Application

### LiveKit

### LiveKit Agent

### Deepgram

### Groq

### MediaPipe and TensorFlow.js

## Sign and Gesture Recognition Model

### Model Location

### Input Data

### Training Dataset

### Adding a new sign/gesture

## Repository Structure

## Deployment

### Web Application

### LiveKit Agent

### Account Ownership and Handover

## Commmon Issues and Troublesohoting

### Camera/Microphone does not work

### LiveKit Agent does not join the meeting

### Transcription does not work

### Gemini Summary does not generate

### Groq action items are missing

### API Free tier limits

## Known Technical Debt

### react-test-renderer

## Notes for Future Developers

- The Next.js app deploys through Vercel and the LiveKit agent deploys through LiveKit Cloud. Details on deploying and maintaining the agent can be found in the LiveKit Cloud docs and .github/workflows/deploy-agent.yml

- Unit tests are currently utilising react-test-render, which is now deprecated

## Team Member Contacts

Student email accounts may eventually expire, so **GitHub accounts should be treated as the primary long-term contact method** where possible.

| Name               | GitHub         | Monash Email                                                      | Long-term Contact               |
| ------------------ | -------------- | ----------------------------------------------------------------- | ------------------------------- |
| Richard Li         | RichardLi88    | [rlii0102@student.monash.edu](mailto:rlii0102@student.monash.edu) | `<LinkedIn/professional email>` |
| Dasun Udugoda      | Dasun-Udugoda  | [wudu0002@student.monash.edu](mailto:wudu0002@student.monash.edu) | `<contact>`                     |
| May McGrath        | maymcgrath     | [mmcg0028@student.monash.edu](mailto:mmcg0028@student.monash.edu) | `<contact>`                     |
| Michael Alexander  | mimgl          | [male0019@student.monash.edu](mailto:male0019@student.monash.edu) | `<contact>`                     |
| Param Dhaliwal     | prmdhaliwal    | [pdha0007@student.monash.edu](mailto:pdha0007@student.monash.edu) | `<contact>`                     |
| Sebastian Aisea    | sebastianaisea | [sais0004@student.monash.edu](mailto:sais0004@student.monash.edu) | `<contact>`                     |
| Jared Kosem        | niceguys72     | [jkos0011@student.monash.edu](mailto:jkos0011@student.monash.edu) | `<contact>`                     |
| May Tran           | maytrran       | [mtra0067@student.monash.edu](mailto:mtra0067@student.monash.edu) | `<contact>`                     |
| Bita Afshar        | bitafsh        | [bafs0001@student.monash.edu](mailto:bafs0001@student.monash.edu) | `<contact>`                     |
| Naveen Rajeev      | naveenrajeev16 | [nraj0031@student.monash.edu](mailto:nraj0031@student.monash.edu) | `<contact>`                     |
| Tam Quan           | TamvyQuan      | [tqua0013@student.monash.edu](mailto:tqua0013@student.monash.edu) | `<LinkedIn/professional email>` |
| Shen-Kit Hia       | shen-kit       | [shia0001@student.monash.edu](mailto:shia0001@student.monash.edu) | `<contact>`                     |
| Sinan Ummu         | sua22          | [summ0001@student.monash.edu](mailto:summ0001@student.monash.edu) | `<contact>`                     |
| Keith Ng           | kngg0077       | [kngg0077@student.monash.edu](mailto:kngg0077@student.monash.edu) | `<contact>`                     |
| Neil Savio Pereira | neilsbp        | [nper0041@student.monash.edu](mailto:nper0041@student.monash.edu) | `<contact>`                     |
