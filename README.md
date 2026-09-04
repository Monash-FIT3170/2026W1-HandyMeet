# 2026W1-HandyMeet

### Project Overview

HandyMeet is a real time video conferencing platform built with accessibility as its focus, offering features such as gesture controls, live captions and sign-language interpretation. It's designed for people who face barriers with existing video conferencing tools, such as people with audio or visual impairments, as well as general users through features like automatic meeting summaries and live action item generation.

## Current Features

- Live video conferencing through LiveKit
- Meeting chat and screen sharing
- Live speech transcription and captions
- Browser-side hand tracking and gesture recognistion using MediaPipe and a TensorFlow.js model
- Integrated tldraw whiteboard synchronised through LiveKit
- Live Action-item extraction using Groq
- Post-meeting transcript summary using Gemini

## Requirements

- Docker, used to build and run the application locally (https://www.docker.com/get-started/)
- Accounts and API keys for the following services (see Environment & Secrets below): LiveKit Cloud, Deepgram, Google AI Studio (Gemini), Groq, tldraw

## How to run

1. Create a .env.local file in the project root and include the necessary environment variables (listed below)
2. The application can be built and run locally using Docker by executing:

`docker compose up --build`

This will build the required container images. Subsequent runs after building the image (without changes) can be run without the `--build` flag

### Architecture

- Next.js: The web application is built on Next.js, handling the UI, while also offering a simple backend to manage rooms
- LiveKit agent: a Python based agent that joins meetings server side to provide real time transcription (via Deepgram) and generates post meeting summaries (via Gemini)

### Environment & Secrets

| Variable                                  | Purpose                       | Source                  |
| ----------------------------------------- | ----------------------------- | ----------------------- |
| `LIVEKIT_URL` / `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit project WebSocket URL | LiveKit Cloud dashboard |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`  | LiveKit project auth          | LiveKit Cloud dashboard |
| `DEEPGRAM_API_KEY`                        | Transcription agent STT       | Deepgram dashboard      |
| `GEMINI_API_KEY`                          | Transcript summary            | Google AI Studio        |
| `NEXT_PUBLIC_TLDRAW_LICENSE_KEY`          | Whiteboard (tldraw) license   | tldraw                  |
| `GROQ_API_KEY`                            | Live Action item detection    | GroqCloud               |

- Local dev: set these in `.env.local`
- CI/deploy: stored as GitHub **Environment secrets** on the `production` environment

## Notes for Future Developers

- The Next.js app deploys through Vercel and the LiveKit agent deploys through LiveKit Cloud. Details on deploying and maintaining the agent can be found in the LiveKit Cloud docs and .github/workflows/deploy-agent.yml
- Unit tests are currently utilising react-test-render, which is now deprecated

## Team Member Contacts

1. Richard Li RichardLi88 rlii0102@student.monash.edu
2. Dasun Udugoda Dasun-Udugoda wudu0002@student.monash.edu
3. May McGrath maymcgrath mmcg0028@student.monash.edu
4. Michael Alexander mimgl male0019@student.monash.edu
5. Param Dhaliwal prmdhaliwal pdha0007@student.monash.edu
6. Sebastian Aisea sebastianaisea sais0004@student.monash.edu
7. Jared Kosem niceguys72 jkos0011@student.monash.edu
8. May Tran maytrran mtra0067@student.monash.edu
9. Bita Afshar bitafsh bafs0001@student.monash.edu
10. Naveen Rajeev naveenrajeev16 nraj0031@student.monash.edu
11. Tam Quan TamvyQuan tqua0013@student.monash.edu
12. Shen-Kit Hia shen-kit shia0001@student.monash.edu
13. Sinan Ummu sua22 summ0001@student.monash.edu
14. Keith Ng kngg0077 kngg0077@student.monash.edu
15. Neil Savio Pereira neilsbp nper0041@student.monash.edu
