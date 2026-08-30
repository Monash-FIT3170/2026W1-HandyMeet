import {
  cli,
  defineAgent,
  type JobContext,
  voice,
  ServerOptions,
} from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import { Participant } from 'livekit-client';
import { fileURLToPath } from 'node:url';

function createTranscriptionSession() {
  return new voice.AgentSession({
    stt: new deepgram.STT({
      model: 'nova-3',
    }),
  });
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    const sessions = new Map<string, voice.AgentSession>();

    const startTranscribingParticipant = async (
      participantIdentity: string,
    ) => {
      if (sessions.has(participantIdentity)) return;

      const session = createTranscriptionSession();
      sessions.set(participantIdentity, session);

      await session.start({
        agent: new voice.Agent({
          instructions:
            'You are a transcription agent, converting speech to text.',
        }),
        room: ctx.room,
        inputOptions: {
          participantIdentity,
        },
      });
    };

    // Add agents for existing people
    for (const participant of ctx.room.remoteParticipants.values()) {
      await startTranscribingParticipant(participant.identity);
    }

    // Add agent when a new person joins
    ctx.room.on('participantConnected', async (participant) => {
      await startTranscribingParticipant(participant.identity);
    });

    // Remove agent when person leaves
    ctx.room.on('participantDisconnected', (participant) => {
      const session = sessions.get(participant.identity);
      session?.close();
      sessions.delete(participant.identity);
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
  }),
);
