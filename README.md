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
  Used to run the project without Docker (v24.22.1 LTS is recommended)
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

For the end-to-end testing, playwright is used. Run it with:

```bash
npx playwright test
npx playwright test ./path/to/file.ts # for a specific test
```

## Architecture

HandyMeet consists of several cooperating components.

                         ┌────────────────────────────┐
                         │        User Browser        │
                         │                            │
                         │   Next.js / React UI       │
                         │   MediaPipe                │
                         │   TensorFlow.js Model      │
                         │   tldraw Whiteboard        │
                         └─────────────┬──────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
       ┌────────────────────────┐           ┌────────────────────────┐
       │     Next.js Backend    │           │     LiveKit Cloud      │
       │        (Vercel)        │           │                        │
       │                        │           │ WebRTC Audio / Video   │
       │ API Routes             │           │ Chat & Screen Sharing │
       │ Meeting Tokens         │           │ Whiteboard Sync       │
       └────────────┬───────────┘           └────────────┬───────────┘
                    │                                    │
             ┌──────┴──────┐                             ▼
             │             │                ┌────────────────────────┐
             ▼             ▼                │      LiveKit Agent     │
       ┌───────────┐ ┌───────────┐          │        TypeScript      │
       │  Gemini   │ │   Groq    │          │                        │
       │           │ │           │          │ Audio Processing       │
       │ Meeting   │ │ Live      │          │ Transcription          │
       │ Summaries │ │ Action    │          │ Live Captions          │
       │           │ │ Items     │          └────────────┬───────────┘
       └───────────┘ └───────────┘                       │
                                                        ▼
                                           ┌────────────────────────┐
                                           │        Deepgram        │
                                           │                        │
                                           │     Speech-to-Text     │
                                           └────────────────────────┘

### Next.js Application

The main application is built on the Next.js and React framework.

This handles:

- All meeting user interfaces and visual features
- Meeting creation and joining
- Video conferencing controls

Next.js API routes are also used for simple backend functionality such as creation of LiveKit room tokens and application routing.

### LiveKit

LiveKit is used to provide the background real time communications infrastructure.

This handles:

- Audio communication
- Video communication
- Screen sharing
- Message communication

### LiveKit Agent

LiveKit agent is a server side agent in TypeScript which joins all active meetings through LiveKit.

Its responsibilities include:

- Receiving meeting audio
- Sending captured audio to Deepgram
- Producing captions and transcript

### Deepgram

Deepgram performs the actual speech-to-text conversion.

Meeting audio is sent via the LiveKit agent to Deepgram where it is then converted into transcript/caption data which is displayed in the application.

### Gemini

Gemini is used to generate a meeting summary after a meeting is completed from the captured transcript.

### Groq

Groq is used within the live action items feature where it identifies potential action items from the live transcript being captured.

### MediaPipe and TensorFlow.js

MediaPipe and TensorFlow.js is used for the hand tracking and gesture recognition locally within the user's browser.
MediaPipe looks at the webcam frames and identfies the 42 hand landmarks (21 landmarks per hand).

These landmark coordinates are passed into the custom trained TensorFlow.js model which classifies the detected hand pose into one of the trained and supported signs/gestures.

Since this processing is done within the browser, webcam frames do not need to be sent to any gesture-recognition server.

## Sign Language and Gesture Recognition Model

### Important Files / Directories

**Model**: `./scripts/gesture-recognition/model.h5`
**Raw videos**: `./scripts/gesture-recognition/training_data/00_videos/`
**Images captured from videos**: `./scripts/gesture-recognition/training_data/01_images/`
**Training dataset**: `./scripts/gesture-recognition/training_data/02_training_data/`

### Adding a New Gesture

Detailed instructions are in `./scripts/gesture-recognition/README.md`. This includes creating raw training data, rules for multi-hand inference, and instructions for training a new model.

## Repository Structure

The Next.js frontend lives in the repository root, alongside the LiveKit agent and gesture recognition scripts.

```
HandyMeet/
├── app/                          # Next.js pages and API routes
│   ├── api/
│   └── room/
├── components/                   # React UI components
├── hooks/                        # React hooks
├── helpers/                      # Shared utility functions
├── constants/                    # Shared application constants
├── agent/                        # LiveKit transcription agent
│   └── transcription.ts
├── scripts/
│   └── gesture-recognition/      # Gesture model training and export
│       ├── training_data/
│       ├── model.h5
│       ├── train_model.py
│       ├── export_tfjs.py
│       └── README.md
├── public/                       # Static assets
│   └── model/                    # Exported TensorFlow.js model
├── tests/                        # Automated tests
├── docs/                         # Project documentation
├── .github/
│   └── workflows/
│       ├── deploy-agent.yml
│       └── ...
├── .env.example
├── .env.local                    # Never pushed to Git
├── .gitignore
├── Dockerfile
├── Dockerfile.nextjs
├── docker-compose.yml
├── livekit.toml
├── package.json
├── tsconfig.json
└── README.md
```

## Deployment

HandyMeet uses two main platforms for deployment.

### Web Application

The Next.js application is deployed through **Vercel**.

Production URL:

```
https://2026-w1-handy-meet.vercel.app/
```

Vercel project owner:

```
Michael Alexander: https://www.linkedin.com/in/michael-alexander2/
```

### LiveKit Agent

The meeting agent is deployed with the second platform, LiveKit Cloud

Deployment configuration and automation can be found in this directory:

```
.github/workflows/deploy-agent.yml
```

### Account Ownership and Handover

The following external accounts must be transferred to the next development team/project owner for full access:

| Service           | Current Owner                                                         | Handover Requirement                 |
| ----------------- | --------------------------------------------------------------------- | ------------------------------------ |
| Vercel            | Michael Alexander                                                     | Transfer project/access              |
| LiveKit Cloud     | Michael Alexander                                                     | Add future developers/project owner  |
| GitHub Repository | Tam Quan, Shen-Kit Hia, Michael Alexander, 2026 FIT3170 Teaching Team | Add developers for repository access |

## Versioning and Git Practice

### Versioning and Releases

The original development team will no longer maintain this repository. Developers continuing the project should create a fork and manage future releases within that fork. The following strategy is recommended and can be adapted to suit the new team's needs.

#### Version Numbers

Use semantic versioning in the format `MAJOR.MINOR.PATCH`:

| Component | When to increase it                                                                 | Example                                                                        |
| --------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **MAJOR** | A release introduces breaking changes that require users or maintainers to migrate. | Changing the deployment configuration in a way that requires manual migration. |
| **MINOR** | A release adds functionality while preserving existing supported behaviour.         | Adding a new meeting feature.                                                  |
| **PATCH** | A release fixes bugs without introducing breaking changes.                          | Correcting how participant names appear in chat.                               |

The application currently declares version `0.1.0` in `package.json`. Versions below `1.0.0` represent initial development, during which compatibility may change. During this stage, document breaking changes clearly and use minor version increments for significant changes.

Future maintainers should choose a `1.0.0` release when they consider the application stable, its supported behaviour defined, and its deployment and handover documentation complete.

#### Preparing a Release

For each release, maintainers should:

1. Select the next version based on the changes included.
2. Update the version in `package.json` and the corresponding entries in `package-lock.json`.
3. Document new features, fixes, breaking changes, configuration changes, and known limitations.
4. Complete automated checks and manually verify the main meeting workflows.
5. Merge the approved release into `main`.
6. Tag the released commit as `vX.Y.Z`, such as `v1.0.0`, and create a GitHub Release with the release notes.
7. Verify the deployed application and LiveKit agent, recording any deployment steps that require manual action.

Release notes should include migration instructions whenever existing deployments need changes.

#### Suggested Branch Structure

Use `dev` to integrate ongoing development and `main` for approved releases. A `staging` branch can optionally support testing in a separate environment before release.

Feature and bug-fix branches should normally target `dev`. Release changes should progress from `dev` to `staging`, if used, and then to `main` through reviewed pull requests.

Fork maintainers must configure their own deployment accounts, secrets, branch protections, and automation. Review the existing GitHub workflows before adopting this structure, as some checks and deployment actions are configured for particular branches.

### Contributing and Pull Requests

Future development should take place in a maintained fork. Contributors should submit pull requests to that fork rather than relying on review or merging by the original development team.

#### Original Team Pull Request Strategy

The original team used ticket-based feature branches and pull requests to integrate changes into `dev`. The workflow was:

1. Create a focused branch from `dev`, using the ticket number and a short description in the branch name.
2. Include the same ticket number in commit messages and the pull request title so changes can be traced to their task.
3. Open a pull request targeting `dev` and complete the repository's pull request template below.
4. Validate changes locally and check the GitHub Actions results. The existing workflows run lint, formatting, TypeScript checks, and unit tests for pull requests targeting `dev`, `staging`, and `main`.
5. Request reviewer approval and address feedback before merging. Review should consider design decisions and overall correctness as well as individual code changes.
6. Resolve conflicts with the target branch and rerun relevant checks before merging.
7. Merge the approved changes and delete the completed feature branch.

The recommendations below extend this workflow for future maintainers. In particular, squash merging and the suggested release process are recommendations rather than requirements imposed on a fork.

#### Pull Request Template Used by the Team

The team used [`.github/pull_request_template.md`](.github/pull_request_template.md) to record the purpose, scope, validation, and limitations of each change. Future maintainers can retain this file in their fork and use the following template when submitting a pull request:

```markdown
## Summary

Briefly describe the purpose of this PR

## Checklist

- [ ] Removed debug code and unnecessary comments
- [ ] Updated documentation if needed
- [ ] PR is focused on a single feature/fix
- [ ] Added screenshots/videos if applicable

## Changes

-
-
-

## Testing

Describe how this was tested, and how reviewers can test the changes.

## Additional Notes

- **limitations**:
- **follow-up work**:
- **known issues**:
- **design decisions**:
```

#### Starting a Change

Create a branch from the fork's latest `dev` branch. Keep each branch focused on one feature, bug fix, or documentation task.

Use a descriptive branch name, preferably including a ticket or issue identifier:

```text
<ticket-number>-<short-description>
```

For example:

```text
14yhc7kvt89-handover-versioning-guide
```

Use the same identifier in related commit messages and pull request titles. A recommended commit format is:

```text
<ticket-number>: <brief imperative description>

Explain the reason for the change and any useful implementation context.
```

Future maintainers can adopt their own issue numbering system.

#### Preparing a Pull Request

Before submitting a pull request:

1. Review the diff and remove debug code, unused code, and unrelated changes.
2. Update documentation and tests where the change affects existing behaviour.
3. Run the repository checks:

   ```bash
   npm run check
   npm test -- --runInBand
   npm run build
   ```

4. Run relevant Playwright tests and manually verify affected workflows where applicable.
5. Bring the branch up to date with its target branch and resolve conflicts.

For branches owned by one contributor, rebasing onto the latest target branch is recommended. For shared branches, coordinate with other contributors before rewriting history.

#### Review and Merge

Open the pull request against the fork's `dev` branch and complete the template in [`.github/pull_request_template.md`](.github/pull_request_template.md).

Include the purpose of the change, its associated ticket or issue, testing evidence, and any limitations. Add screenshots or recordings for visible interface changes.

Maintainers should require at least one reviewer's approval and passing required checks before merging. Reviewers should check correctness, readability, test coverage, and compatibility with existing functionality.

Squash merging is recommended for focused feature branches to keep the integration history easy to follow. Preserve the ticket or issue identifier in the resulting commit message.

After merging, delete the completed branch. Promote approved changes to release branches through separate pull requests following the release strategy above.

## Commmon Issues and Troublesohoting

### Camera/Microphone does not work

Possible causes:

- Browser permission denied
- Operating system permission denied
- Another open application is using that input device
- Wrong input device is selected

Check all permissions and confirm the correct device is selected.

### LiveKit Agent does not join the meeting

Check:

- LIVEKIT_URL
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET
- Agent process logs
- LiveKit Cloud project status
- Network connectivity

If the frontend meeting is working as intended, but the agent is not joining (the agent does not visually join as a participant, but as a hidden member), the LiveKit agent should be the first component investigated.

### Transcription does not work

Check:

- Agent has joined the meeting (hidden member)
- Microphone audio is reaching HandyMeet and LiveKit
- DEEPGRAM_API_KEY is valid
- DEEPGRAM quota has not been exhausted
- Deepgram service is available and not under maintenance
- Agent logs for any API-related errors

### Gemini Summary does not generate

Check:

- GEMINI_API_KEY
- Gemini quota has not been exhausted
- Check that a transcript has been generated to summarise
- Gemini service is available and not under maintenance

### Groq action items are missing

Check:

- GROQ_API_KEY
- Groq quota has not been exhausted
- Groq service is available and not under maintenance
- Server logs for short-term rate limits

### API Free tier limits

HandyMeet relies on several services with usage quotas depending on which tier plan is used, currently all plans are using the base free tier.

These include:

- Deepgram
- Gemini
- Groq
- Livekit

If a previously working feature suddenly no longer works, check whether the account tied to that feature has not reached its free tier quota.

## Known Technical Debt

No outstanding technical debt has been identified at the time of writing this handover documentation. Previously identified deprecated packages such as react-test-renderer, have been addressed and rectified.

## Notes for Future Developers

- The Next.js app deploys through Vercel and the LiveKit agent deploys through LiveKit Cloud. Details on deploying and maintaining the agent can be found in the LiveKit Cloud docs and .github/workflows/deploy-agent.yml

## Team Member Contacts

Student email accounts may eventually expire, so **GitHub accounts should be treated as the primary long-term contact method** where possible.

| Name               | GitHub         | Monash Email                                                      | Long-term Contact                                      |
| ------------------ | -------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| Richard Li         | RichardLi88    | [rlii0102@student.monash.edu](mailto:rlii0102@student.monash.edu) | `https://www.linkedin.com/in/richard-li-swe/`          |
| Dasun Udugoda      | Dasun-Udugoda  | [wudu0002@student.monash.edu](mailto:wudu0002@student.monash.edu) | `https://www.linkedin.com/in/dasun-udugoda-468936299/` |
| May McGrath        | maymcgrath     | [mmcg0028@student.monash.edu](mailto:mmcg0028@student.monash.edu) | `https://www.linkedin.com/in/maymcgrath/`              |
| Michael Alexander  | mimgl          | [male0019@student.monash.edu](mailto:male0019@student.monash.edu) | `https://www.linkedin.com/in/michael-alexander2/`      |
| Param Dhaliwal     | prmdhaliwal    | [pdha0007@student.monash.edu](mailto:pdha0007@student.monash.edu) | `https://www.linkedin.com/in/prmdhaliwal/`             |
| Sebastian Aisea    | sebastianaisea | [sais0004@student.monash.edu](mailto:sais0004@student.monash.edu) | `sebastianaisea5@gmail.com`                            |
| Jared Kosem        | niceguys72     | [jkos0011@student.monash.edu](mailto:jkos0011@student.monash.edu) | `https://www.linkedin.com/in/jared-kosem-0b09ba242/`   |
| May Tran           | maytrran       | [mtra0067@student.monash.edu](mailto:mtra0067@student.monash.edu) | `https://www.linkedin.com/in/may-tran-b870b222b/`      |
| Bita Afshar        | bitafsh        | [bafs0001@student.monash.edu](mailto:bafs0001@student.monash.edu) | `https://www.linkedin.com/in/bita-afshar-3140632b9/`   |
| Naveen Rajeev      | naveenrajeev16 | [nraj0031@student.monash.edu](mailto:nraj0031@student.monash.edu) | `https://www.linkedin.com/in/naveen-rajeev-19b191334/` |
| Tam Quan           | TamvyQuan      | [tqua0013@student.monash.edu](mailto:tqua0013@student.monash.edu) | `https://www.linkedin.com/in/tam-quan/`                |
| Shen-Kit Hia       | shen-kit       | [shia0001@student.monash.edu](mailto:shia0001@student.monash.edu) | `https://www.linkedin.com/in/shen-kit-hia/`            |
| Sinan Ummu         | sua22          | [summ0001@student.monash.edu](mailto:summ0001@student.monash.edu) | `https://www.linkedin.com/in/sinan-ummu/`              |
| Keith Ng           | kngg0077       | [kngg0077@student.monash.edu](mailto:kngg0077@student.monash.edu) | `https://linkedin.com/in/k31thng`                      |
| Neil Savio Pereira | neilsbp        | [nper0041@student.monash.edu](mailto:nper0041@student.monash.edu) | `https://www.linkedin.com/in/neil-pereira-5b0858247/`  |
