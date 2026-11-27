
// Installed SDK protocol 4 annotates worker events with agent and parent IDs.
// Require positive root turn evidence and a matching interaction before using assistant text.
export function observeForeground(sessionId, deliver) {
  const turns = new Map();
  const messages = new Map();
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
          data.parentAgentTaskId || (event.sessionId && event.sessionId !== sessionId) ||
          (data.sessionId && data.sessionId !== sessionId) || !event.id || seen.has(event.id)) return;
      seen.add(event.id);
      if (seen.size > 256) seen.delete(seen.values().next().value);

      if (event.type === 'user.message' && (data.interactionId || data.messageId) && typeof data.content === 'string' &&
          !data.isAutopilotContinuation && (!data.source || ['user', 'human'].includes(data.source))) {
        lastMessage = { id: data.messageId, interaction: data.interactionId, text: data.content };
        if (data.interactionId) remember(messages, data.interactionId, lastMessage, 32);
      }
      if (event.type === 'assistant.turn_start' && data.turnId && data.agentMode) {
        const user = messages.get(data.interactionId) ?? (lastMessage && !lastMessage.interaction ? lastMessage : undefined);
        if (user) {
          if (lastMessage === user) lastMessage = undefined;
          remember(turns, data.turnId, { interaction: data.interactionId, user, messages: new Map() }, 32);
        }
      }
      if (event.type === 'assistant.message' && data.messageId && typeof data.content === 'string') {
        const matching = [...turns.values()].filter(turn =>
          (data.originatingMessageId && turn.user.id === data.originatingMessageId) ||
          (data.interactionId && turn.interaction === data.interactionId &&
            (!data.originatingMessageId || !turn.user.id || turn.user.id === data.originatingMessageId)));
        if (matching.length === 1) remember(matching[0].messages, data.messageId, data.content, 12);
      }
      if (event.type === 'assistant.turn_end' && turns.has(data.turnId)) {
        const turn = turns.get(data.turnId);
        turns.delete(data.turnId);
        messages.delete(turn.user.interaction);
        const assistant = [...turn.messages.values()].join('\n').trim();
        if (turn.user.text.trim() && assistant) deliver({ user: turn.user.text.slice(0, 5_000), assistant: assistant.slice(0, 7_000) });
      }
    },
    close() {
      stopped = true;
      turns.clear();
      messages.clear();
      seen.clear();
      lastMessage = undefined;
    },
  };
}
