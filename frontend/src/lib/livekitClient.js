import { Room, RoomEvent, createLocalTracks, VideoPresets } from 'livekit-client';

export async function joinAndPublish(wsUrl, token, { video = true, audio = true, facingMode = 'user' } = {}) {
  const room = new Room({ adaptiveStream: true, dynacast: true });
  await room.connect(wsUrl, token);

  const tracks = await createLocalTracks({
    audio: audio,
    video: video ? { facingMode, resolution: VideoPresets.h720.resolution } : false,
  });

  for (const t of tracks) {
    await room.localParticipant.publishTrack(t);
  }
  return room;
}

export function attachSubscribed(container, room) {
  function render() {
    if (!container) return;
    container.innerHTML = '';
    // local participant preview can be omitted on interviewer
    room.participants.forEach((p) => {
      p.tracks.forEach((pub) => {
        const tr = pub.track;
        if (!tr) return;
        const el = tr.attach();
        el.style.maxWidth = '100%';
        el.style.borderRadius = '8px';
        container.appendChild(el);
      });
    });
  }
  room
    .on(RoomEvent.TrackSubscribed, render)
    .on(RoomEvent.TrackUnsubscribed, render)
    .on(RoomEvent.ParticipantConnected, render)
    .on(RoomEvent.ParticipantDisconnected, render);
  render();
}
