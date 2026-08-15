export function createInMemoryMarketingEventsRepository({ limit = 100 } = {}) {
  const events = [];

  return {
    async append(event) {
      events.push(event);
      if (events.length > limit) events.splice(0, events.length - limit);
      return event;
    },
    async listForUser(subject) {
      return events.filter((event) => event.userId === subject);
    },
  };
}
