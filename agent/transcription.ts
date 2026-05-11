import {
  cli,
  defineAgent,
  type JobContext,
  voice,
  ServerOptions,
} from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import { fileURLToPath } from 'node:url';

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const session = new voice.AgentSession({
      stt: new deepgram.STT({
        model: 'nova-3',
      }),
    });

    await session.start({
      agent: new voice.Agent({
        instructions:
          'You are a transcription agent, converting speech to text.',
      }),
      room: ctx.room,
    });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
