import { expect, type Page, test } from '@playwright/test';

const GESTURE_VIDEO_URLS = {
  cameraOff: '/test-videos/gestures/CameraOff_Landscape_H264.mp4',
  mute: '/test-videos/gestures/mute.mp4',
  unmute: '/test-videos/gestures/unmute.mp4',
  raiseHand: '/test-videos/gestures/raiseHand.mp4',
} as const;

const GESTURE_TIMEOUT_MS = 20_000;

type GestureName = keyof typeof GESTURE_VIDEO_URLS;

declare global {
  interface Window {
    __handyMeetGestureActions?: string[];
    __handyMeetGestureVideo?: HTMLVideoElement;
    __handyMeetSetGestureVideoSource?: (src: string) => Promise<void>;
  }
}

async function installVideoCamera(page: Page, initialGesture: GestureName) {
  await page.addInitScript((initialVideoSrc: string) => {
    let streamPromise: Promise<MediaStream> | undefined;
    window.__handyMeetGestureActions = [];
    window.addEventListener('handymeet:gesture-action', (event) => {
      const action = (event as CustomEvent<{ action: string }>).detail?.action;
      if (action) {
        window.__handyMeetGestureActions?.push(action);
      }
    });
    const waitForEvent = (target: EventTarget, eventName: string) =>
      new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error(`Timed out waiting for ${eventName}`));
        }, 10_000);

        target.addEventListener(
          eventName,
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });

    const buildStream = async (src: string) => {
      const video = document.createElement('video');
      video.src = src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.style.display = 'none';
      document.body.appendChild(video);

      video.load();
      await waitForEvent(video, 'loadedmetadata');
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const context = canvas.getContext('2d');
      const stream = canvas.captureStream(30);

      const drawFrame = () => {
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const destination = audioContext.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      destination.stream
        .getAudioTracks()
        .forEach((track) => stream.addTrack(track));

      window.__handyMeetGestureVideo = video;

      return stream;
    };

    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!constraints?.audio && !constraints?.video) {
        return getUserMedia(constraints);
      }

      streamPromise ??= buildStream(initialVideoSrc);
      const stream = await streamPromise;
      return new MediaStream([
        ...(constraints.audio ? stream.getAudioTracks() : []),
        ...(constraints.video ? stream.getVideoTracks() : []),
      ]);
    };

    window.__handyMeetSetGestureVideoSource = async (src: string) => {
      if (window.__handyMeetGestureVideo) {
        if (window.__handyMeetGestureVideo.src.endsWith(src)) {
          await window.__handyMeetGestureVideo.play();
          return;
        }

        window.__handyMeetGestureVideo.src = src;
        window.__handyMeetGestureVideo.load();
        await waitForEvent(window.__handyMeetGestureVideo, 'loadedmetadata');
        await window.__handyMeetGestureVideo.play();
        return;
      }

      streamPromise ??= buildStream(src);
      await streamPromise;
    };
  }, GESTURE_VIDEO_URLS[initialGesture]);
}

async function setGestureVideo(page: Page, gesture: GestureName) {
  await page.evaluate(async (src: string) => {
    await window.__handyMeetSetGestureVideoSource?.(src);
  }, GESTURE_VIDEO_URLS[gesture]);
}

async function readGestureActions(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__handyMeetGestureActions ?? []);
}

async function joinRoomWithGestureVideo(page: Page, gesture: GestureName) {
  const roomCode = `G${Date.now().toString(36).slice(-5)}`.toUpperCase();

  await installVideoCamera(page, gesture);
  await page.goto('/');
  await page.getByPlaceholder('Your name').fill(`gesture-${gesture}`);
  await page.getByPlaceholder('Room code').fill(roomCode);
  await page.getByRole('button', { name: 'Join Room' }).click();
  await expect(page).toHaveURL(new RegExp(`/room/${roomCode}`));
  await expect(page.getByTitle('Gestures')).toBeVisible({ timeout: 15_000 });
  await setGestureVideo(page, gesture);
}

async function enableHandTracking(page: Page) {
  await page.getByTitle('Gestures').click();
  const handTrackingButton = page.getByRole('button', {
    name: 'Hand tracking',
  });
  await expect(handTrackingButton).toBeEnabled({ timeout: 15_000 });
  await handTrackingButton.click();
  await expect(page.getByText(/hand detected|no hand detected/i)).toBeVisible();
}

test.describe('video-driven gesture E2E', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ permissions: ['camera', 'microphone'] });

  /*
  test('given cameraOff video when hand tracking runs then turns off the local camera', async ({
    page,
  }: {
    page: Page;
  }) => {
    await joinRoomWithGestureVideo(page, 'cameraOff');
    await enableHandTracking(page);

    await expect
      .poll(() => readGestureActions(page), { timeout: GESTURE_TIMEOUT_MS })
      .toContain('cameraOff');
  });
  */

  test('given mute video when hand tracking runs then turns off the local microphone', async ({
    page,
  }: {
    page: Page;
  }) => {
    await joinRoomWithGestureVideo(page, 'mute');
    await enableHandTracking(page);

    await expect
      .poll(() => readGestureActions(page), { timeout: GESTURE_TIMEOUT_MS })
      .toContain('mute');
  });

  test('given muted call when unmute video plays then turns the microphone back on', async ({
    page,
  }: {
    page: Page;
  }) => {
    await joinRoomWithGestureVideo(page, 'mute');
    await enableHandTracking(page);

    await expect
      .poll(() => readGestureActions(page), { timeout: GESTURE_TIMEOUT_MS })
      .toContain('mute');

    await setGestureVideo(page, 'unmute');

    await expect
      .poll(() => readGestureActions(page), { timeout: GESTURE_TIMEOUT_MS })
      .toContain('unmute');
  });

  test('given raiseHand video when hand tracking runs then shows the raised-hand reaction', async ({
    page,
  }: {
    page: Page;
  }) => {
    await joinRoomWithGestureVideo(page, 'raiseHand');
    await enableHandTracking(page);

    await expect
      .poll(() => readGestureActions(page), { timeout: GESTURE_TIMEOUT_MS })
      .toContain('raiseHand');
    await expect(page.getByText('Raised their hand')).toBeVisible({
      timeout: GESTURE_TIMEOUT_MS,
    });
  });
});
