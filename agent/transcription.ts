import {
  cli,
  defineAgent,
  type JobContext,
  voice,
  ServerOptions,
} from '@livekit/agents';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import { fileURLToPath } from 'node:url';
import {
  extractLiveActionItems,
  type LiveInsightActionItemFields,
  type LiveInsightActionItem,
} from '../helpers/liveInsights';
import {
  isLiveInsightsCoordinatorClaim,
  isLiveInsightsCoordinatorHandoff,
  isLiveInsightsCoordinatorStateRequest,
  isLiveInsightsMutation,
  LIVE_INSIGHTS_MESSAGE_TYPE,
  isLiveInsightsSnapshotRequest,
  LIVE_INSIGHTS_COORDINATOR_STATE_TYPE,
  LIVE_INSIGHTS_TOPIC,
} from '../helpers/liveInsightsProtocol';
import { randomUUID } from 'node:crypto';

const COLLECTION_DELAY_MS = 1000;

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
    const pendingTranscriptLines: string[] = [];
    const knownActionItems: LiveInsightActionItem[] = [];
    const participantClaims = new Map<string, number>();
    let coordinatorIdentity: string | null = null;
    let coordinatorWasHandedOff = false;
    let collectionTimer: ReturnType<typeof setTimeout> | undefined;
    let collectionInFlight = false;

    const publishActionItems = async (destinationIdentity?: string) => {
      const agentParticipant = ctx.agent;
      if (!agentParticipant) {
        throw new Error('Agent participant is unavailable.');
      }

      const message = JSON.stringify({
        type: LIVE_INSIGHTS_MESSAGE_TYPE,
        actionItems: knownActionItems,
      });

      await agentParticipant.publishData(new TextEncoder().encode(message), {
        reliable: true,
        topic: LIVE_INSIGHTS_TOPIC,
        ...(destinationIdentity
          ? { destination_identities: [destinationIdentity] }
          : {}),
      });
    };

    const publishCoordinatorState = async (destinationIdentity?: string) => {
      const agentParticipant = ctx.agent;
      if (!agentParticipant) {
        throw new Error('Agent participant is unavailable.');
      }

      const message = JSON.stringify({
        type: LIVE_INSIGHTS_COORDINATOR_STATE_TYPE,
        coordinatorIdentity,
      });

      await agentParticipant.publishData(new TextEncoder().encode(message), {
        reliable: true,
        topic: LIVE_INSIGHTS_TOPIC,
        ...(destinationIdentity
          ? { destination_identities: [destinationIdentity] }
          : {}),
      });
    };

    const electCoordinator = () => {
      const electedParticipant = [...participantClaims.entries()].sort(
        ([identity, joinedAt], [otherIdentity, otherJoinedAt]) =>
          joinedAt - otherJoinedAt || identity.localeCompare(otherIdentity),
      )[0];

      return electedParticipant?.[0] ?? null;
    };

    const publishElectedCoordinator = () => {
      const electedCoordinator = electCoordinator();
      if (electedCoordinator === coordinatorIdentity) return;

      coordinatorIdentity = electedCoordinator;
      void publishCoordinatorState().catch((error) => {
        console.error('Live insights coordinator update failed:', error);
      });
    };

    ctx.room.on('dataReceived', (payload, participant, _kind, topic) => {
      if (
        topic !== LIVE_INSIGHTS_TOPIC ||
        !participant ||
        participant.identity.toLowerCase().startsWith('agent-')
      ) {
        return;
      }

      try {
        const message: unknown = JSON.parse(new TextDecoder().decode(payload));
        if (isLiveInsightsSnapshotRequest(message)) {
          void publishActionItems(participant.identity).catch((error) => {
            console.error('Live action item snapshot failed:', error);
          });
          return;
        }

        if (isLiveInsightsCoordinatorClaim(message)) {
          participantClaims.set(participant.identity, message.joinedAt);
          if (!coordinatorWasHandedOff) publishElectedCoordinator();
          void publishCoordinatorState(participant.identity).catch((error) => {
            console.error('Live insights coordinator state failed:', error);
          });
          return;
        }

        if (isLiveInsightsCoordinatorStateRequest(message)) {
          void publishCoordinatorState(participant.identity).catch((error) => {
            console.error('Live insights coordinator state failed:', error);
          });
          return;
        }

        if (
          isLiveInsightsMutation(message) &&
          participant.identity === coordinatorIdentity
        ) {
          const actionItem = knownActionItems.find(
            (item) => item.id === message.itemId,
          );
          if (!actionItem) return;

          if (message.operation === 'accept') {
            actionItem.status = 'accepted';
          } else if (message.operation === 'dismiss') {
            actionItem.status = 'dismissed';
          } else if (message.operation === 'edit') {
            Object.assign(actionItem, message.updates);
          } else if (message.operation === 'assign') {
            actionItem.assigneeId = message.assigneeId;
          }

          void publishActionItems().catch((error) => {
            console.error('Live action item update failed:', error);
          });
          return;
        }

        if (
          isLiveInsightsCoordinatorHandoff(message) &&
          participant.identity === coordinatorIdentity &&
          participantClaims.has(message.targetIdentity)
        ) {
          coordinatorIdentity = message.targetIdentity;
          coordinatorWasHandedOff = true;
          void publishCoordinatorState().catch((error) => {
            console.error('Live insights coordinator handoff failed:', error);
          });
        }
      } catch (error) {
        console.error('Failed to parse live insight request:', error);
      }
    });

    const collectActionItems = async () => {
      if (collectionInFlight || pendingTranscriptLines.length === 0) return;

      const transcriptLines = pendingTranscriptLines.splice(0);
      const apiKey = process.env.GROQ_API_KEY;

      if (!apiKey) {
        console.error(
          'Live insight collection skipped: GROQ_API_KEY is missing.',
        );
        return;
      }

      collectionInFlight = true;
      const previousItemCount = knownActionItems.length;

      try {
        const newActionItems = await extractLiveActionItems({
          transcript: transcriptLines.join('\n'),
          knownActionItems: knownActionItems.map(
            ({ task, owner, dueDate }) => ({
              task,
              owner,
              dueDate,
            }),
          ),
          apiKey,
        });

        if (newActionItems.length === 0) return;

        knownActionItems.push(
          ...newActionItems.map((actionItem: LiveInsightActionItemFields) => ({
            ...actionItem,
            id: `agent-action-item-${randomUUID()}`,
            status: 'suggested' as const,
            assigneeId: null,
          })),
        );
        await publishActionItems();
      } catch (error) {
        knownActionItems.splice(previousItemCount);
        pendingTranscriptLines.unshift(...transcriptLines);
        console.error('Live action item collection failed:', error);
      } finally {
        collectionInFlight = false;
        scheduleCollection();
      }
    };

    const scheduleCollection = () => {
      if (collectionTimer || pendingTranscriptLines.length === 0) return;

      collectionTimer = setTimeout(() => {
        collectionTimer = undefined;
        void collectActionItems();
      }, COLLECTION_DELAY_MS);
    };

    const queueTranscript = (participantIdentity: string, text: string) => {
      const transcript = text.trim();
      if (!transcript) return;

      pendingTranscriptLines.push(`${participantIdentity}: ${transcript}`);
      scheduleCollection();
    };

    const startTranscribingParticipant = async (
      participantIdentity: string,
    ) => {
      if (sessions.has(participantIdentity)) return;

      const session = createTranscriptionSession();
      sessions.set(participantIdentity, session);

      session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
        if (!event.isFinal) return;
        queueTranscript(participantIdentity, event.transcript);
      });

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

      participantClaims.delete(participant.identity);
      if (participant.identity === coordinatorIdentity) {
        coordinatorWasHandedOff = false;
        publishElectedCoordinator();
      }
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
  }),
);
