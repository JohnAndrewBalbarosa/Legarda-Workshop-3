function sortByRequestTime(left, right) {
  return left.requestedAt.localeCompare(right.requestedAt);
}

export class HelpQueue {
  constructor(initialRequests = []) {
    this.requests = new Map();
    this.sync(initialRequests);
  }

  sync(requests = []) {
    this.requests.clear();

    for (const request of requests) {
      if (request?.requestId) {
        this.requests.set(request.requestId, {
          ...request,
        });
      }
    }

    return this.getQueue();
  }

  addHelpRequest(request) {
    if (!request?.requestId) {
      return this.getQueue();
    }

    this.requests.set(request.requestId, {
      ...request,
    });

    return this.getQueue();
  }

  resolveHelpRequest(requestId) {
    const request = this.requests.get(requestId);

    if (!request) {
      return this.getQueue();
    }

    this.requests.set(requestId, {
      ...request,
      status: 'resolved',
      resolvedAt: request.resolvedAt ?? new Date().toISOString(),
    });

    return this.getQueue();
  }

  getQueue() {
    return Array.from(this.requests.values())
      .filter((request) => request.status !== 'resolved')
      .sort(sortByRequestTime);
  }

  getAllRequests() {
    return Array.from(this.requests.values()).sort(sortByRequestTime);
  }
}

export function addHelpRequest(queue, request) {
  if (queue instanceof HelpQueue) {
    return queue.addHelpRequest(request);
  }

  return new HelpQueue([request]).getQueue();
}

export function resolveHelpRequest(queue, requestId) {
  if (queue instanceof HelpQueue) {
    return queue.resolveHelpRequest(requestId);
  }

  return [];
}
