
// Installed SDK protocol 4 annotates worker events with agent and parent IDs.
// Require positive root turn evidence and a matching interaction before using assistant text.
export function observeForeground(sessionId, deliver) {
  const turns = new Map();
  const messages = new Map();
  const completed = new Map();
  const seen = new Set();
  let lastMessage;
  let stopped = false;
  const remember = (map, key, value, limit) => {
    map.set(key, value);
    if (map.size > limit) map.delete(map.keys().next().value);
  };

  return {
    handle(event) {
      const data = event.data ?? {};
      if (stopped || event.checkpoint || event.agentId || data.agentId || data.parentToolCallId ||
          (event.type !== 'user.message' && data.parentAgentTaskId) || (event.sessionId && event.sessionId !== sessionId) ||
          (data.sessionId && data.sessionId !== sessionId) || !event.id || seen.has(event.id)) return;
      seen.add(event.id);
      if (seen.size > 256) seen.delete(seen.values().next().value);

      if (event.type === 'user.message' && (data.interactionId || data.messageId) &&
          (!data.parentAgentTaskId || data.interactionId) && typeof data.content === 'string' &&
          !data.isAutopilotContinuation && (!data.source || ['user', 'human'].includes(data.source))) {
        const key = data.messageId ?? data.interactionId;
        if (completed.has(key)) return;
        // Copilot also assigns a parent task ID to the root user message. Root
        // admission still requires a root assistant turn and matching reply.
        lastMessage = { key, id: data.messageId, interaction: data.interactionId, text: data.content };
        if (data.interactionId) remember(messages, data.interactionId, lastMessage, 32);
      }
      if (event.type === 'assistant.turn_start' && data.turnId && data.agentMode) {
        const user = messages.get(data.interactionId) ?? (lastMessage && !lastMessage.interaction ? lastMessage : undefined);
        if (user && !completed.has(user.key)) {
          if (data.interactionId && !user.interaction) {
            user.interaction = data.interactionId;
            remember(messages, data.interactionId, user, 32);
          }
          remember(turns, data.turnId, { interaction: data.interactionId, user, messages: new Map() }, 32);
        }
      }
      if (event.type === 'assistant.message' && data.messageId && typeof data.content === 'string') {
        if (data.toolRequests?.length || (data.phase && data.phase !== 'final_answer')) return;
        const matching = [...turns].filter(([turnId, turn]) => (!data.turnId || data.turnId === turnId) && (
          (data.originatingMessageId && turn.user.id === data.originatingMessageId) ||
          (data.interactionId && turn.interaction === data.interactionId &&
            (!data.originatingMessageId || !turn.user.id || turn.user.id === data.originatingMessageId))));
        if (matching.length === 1) remember(matching[0][1].messages, data.messageId, data.content, 12);
      }
      if (event.type === 'assistant.turn_end' && turns.has(data.turnId)) {
        const turn = turns.get(data.turnId);
        turns.delete(data.turnId);
        const assistant = [...turn.messages.values()].join('\n').trim();
        if (!turn.user.text.trim() || !assistant || completed.has(turn.user.key)) return;
        if (messages.get(turn.user.interaction) === turn.user) messages.delete(turn.user.interaction);
        if (lastMessage === turn.user) lastMessage = undefined;
        remember(completed, turn.user.key, true, 256);
        deliver({ user: turn.user.text.slice(0, 5_000), assistant: assistant.slice(0, 7_000) });
      }
    },
    close() {
      stopped = true;
      turns.clear();
      messages.clear();
      completed.clear();
      seen.clear();
      lastMessage = undefined;
    },
  };
}
