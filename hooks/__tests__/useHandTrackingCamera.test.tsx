/** @jest-environment jsdom */

import { EventEmitter } from 'node:events';
import { act, renderHook, waitFor } from '@testing-library/react';
import { RoomEvent, Track, type Room } from 'livekit-client';
import { useHandTrackingCamera } from '../useHandTrackingCamera';

type MockTrack = {
  readyState: MediaStreamTrackState;
  enabled: boolean;
  stop: jest.Mock<void, []>;
  clone: jest.Mock<MockTrack, []>;
};

function makeTrack(): MockTrack {
  const track: MockTrack = {
    readyState: 'live',
    enabled: true,
    stop: jest.fn(() => {
      track.readyState = 'ended';
    }),
    clone: jest.fn(() => makeTrack()),
  };
  return track;
}

class FakeMediaStream {
  constructor(private tracks: MediaStreamTrack[]) {}

  getTracks() {
    return this.tracks;
  }
}

function makeStream(track = makeTrack()) {
  return {
    track,
    stream: new FakeMediaStream([
      track as unknown as MediaStreamTrack,
    ]) as unknown as MediaStream,
  };
}

function makeRoom(track?: ReturnType<typeof makeTrack>) {
  const publication = {
    source: Track.Source.Camera,
    track: { mediaStreamTrack: track },
  };
  const localParticipant = {
    getTrackPublication: jest.fn(() => publication),
  };
  const events = Object.assign(new EventEmitter(), {
    localParticipant,
    getActiveDevice: jest.fn(() => 'selected-camera'),
  });
  return {
    room: events as unknown as Room,
    events,
    publication,
    localParticipant,
  };
}

function renderCamera(room: Room, enabled = true) {
  const video = document.createElement('video');
  const options = { room, enabled, videoRef: { current: video } };
  return {
    ...renderHook(useHandTrackingCamera, { initialProps: options }),
    video,
    options,
  };
}

describe('useHandTrackingCamera', () => {
  const getUserMedia = jest.fn();
  const originalMediaDevices = Object.getOwnPropertyDescriptor(
    navigator,
    'mediaDevices',
  );
  const originalMediaStream = Object.getOwnPropertyDescriptor(
    globalThis,
    'MediaStream',
  );

  beforeEach(() => {
    getUserMedia.mockReset();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(globalThis, 'MediaStream', {
      configurable: true,
      value: FakeMediaStream,
    });
    jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
    } else {
      Reflect.deleteProperty(navigator, 'mediaDevices');
    }
    if (originalMediaStream) {
      Object.defineProperty(globalThis, 'MediaStream', originalMediaStream);
    } else {
      Reflect.deleteProperty(globalThis, 'MediaStream');
    }
  });

  it('does not acquire a camera until hand tracking is enabled', () => {
    const sharedTrack = makeTrack();
    renderCamera(makeRoom(sharedTrack).room, false);

    expect(sharedTrack.clone).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('keeps its local clone alive when shared video stops, then releases it when tracking stops', async () => {
    const sharedTrack = makeTrack();
    const { room, events, publication, localParticipant } =
      makeRoom(sharedTrack);
    const { video, options, rerender } = renderCamera(room);
    await waitFor(() => expect(video.play).toHaveBeenCalled());
    const clone = sharedTrack.clone.mock.results[0].value;
    const stream = video.srcObject as MediaStream;

    act(() => {
      sharedTrack.stop();
      events.emit(RoomEvent.TrackMuted, publication, localParticipant);
    });

    expect(stream.getTracks()).toEqual([clone]);
    expect(clone.readyState).toBe('live');
    expect(clone.stop).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();

    rerender({ ...options, enabled: false });
    expect(clone.stop).toHaveBeenCalledTimes(1);
    expect(sharedTrack.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(events.eventNames()).toEqual([]);
  });

  it('opens only the selected video device when tracking starts with video already off', async () => {
    const { stream, track } = makeStream();
    getUserMedia.mockResolvedValue(stream);
    const { video, unmount } = renderCamera(makeRoom().room);

    await waitFor(() => expect(video.srcObject).toBe(stream));
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { deviceId: { exact: 'selected-camera' } },
    });

    unmount();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
  });

  it('releases a camera request that finishes after tracking is disabled', async () => {
    const { stream, track } = makeStream();
    let resolveCamera!: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        resolveCamera = resolve;
      }),
    );
    const { options, rerender, video } = renderCamera(makeRoom().room);

    rerender({ ...options, enabled: false });
    await act(async () => resolveCamera(stream));

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(video.play).not.toHaveBeenCalled();
  });

  it('ignores a stale camera request when shared video resumes first', async () => {
    const pendingCamera = makeStream();
    let resolveCamera!: (stream: MediaStream) => void;
    getUserMedia.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        resolveCamera = resolve;
      }),
    );
    const { room, events, publication, localParticipant } = makeRoom();
    const { video } = renderCamera(room);
    const resumedTrack = makeTrack();

    await act(async () => {
      publication.track.mediaStreamTrack = resumedTrack;
      events.emit(RoomEvent.TrackUnmuted, publication, localParticipant);
      resolveCamera(pendingCamera.stream);
    });

    const clone = resumedTrack.clone.mock.results[0].value;
    expect((video.srcObject as MediaStream).getTracks()).toEqual([clone]);
    expect(pendingCamera.track.stop).toHaveBeenCalledTimes(1);
    expect(clone.stop).not.toHaveBeenCalled();
    expect(resumedTrack.stop).not.toHaveBeenCalled();
  });

  it('switches the private camera when the selected video device changes', async () => {
    const firstCamera = makeStream();
    const nextCamera = makeStream();
    getUserMedia
      .mockResolvedValueOnce(firstCamera.stream)
      .mockResolvedValueOnce(nextCamera.stream);
    const { room, events } = makeRoom();
    const { video } = renderCamera(room);
    await waitFor(() => expect(video.srcObject).toBe(firstCamera.stream));

    await act(async () => {
      events.emit(RoomEvent.ActiveDeviceChanged, 'audioinput', 'microphone');
      events.getActiveDevice.mockReturnValue('next-camera');
      events.emit(RoomEvent.ActiveDeviceChanged, 'videoinput', 'next-camera');
    });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia).toHaveBeenLastCalledWith({
      audio: false,
      video: { deviceId: { exact: 'next-camera' } },
    });
    expect(video.srcObject).toBe(nextCamera.stream);
    expect(firstCamera.track.stop).toHaveBeenCalledTimes(1);
    expect(nextCamera.track.stop).not.toHaveBeenCalled();
  });

  it('reports permission failures without enabling shared video', async () => {
    getUserMedia.mockRejectedValue(
      new DOMException('Denied', 'NotAllowedError'),
    );
    const { result, video } = renderCamera(makeRoom().room);

    await waitFor(() =>
      expect(result.current.cameraError).toMatch(/permissions/),
    );
    expect(video.srcObject).toBeNull();
  });

  it('releases the private camera if video playback fails', async () => {
    const { stream, track } = makeStream();
    getUserMedia.mockResolvedValue(stream);
    jest
      .mocked(HTMLMediaElement.prototype.play)
      .mockRejectedValue(new Error('Playback failed'));
    const { result, video } = renderCamera(makeRoom().room);

    await waitFor(() => expect(result.current.cameraError).not.toBeNull());
    expect(track.readyState).toBe('ended');
    expect(video.srcObject).toBeNull();
  });
});
