interface RabbitConnectionResource {
  stream?: { destroy: () => void };
  heartbeater?: { clear: () => void };
}

export async function closeRabbitResource(resource?: {
  close: () => Promise<void>;
  connection?: unknown;
  stream?: { destroy: () => void };
  heartbeater?: { clear: () => void };
}) {
  if (!resource) {
    return;
  }

  let timeout: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      resource.close(),
      new Promise((resolve) => {
        timeout = setTimeout(resolve, 1000);
      }),
    ]);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('closing')) {
      throw error;
    }
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }

    forceCloseRabbitResource(resource);
  }
}

function forceCloseRabbitResource(resource: {
  connection?: unknown;
  stream?: { destroy: () => void };
  heartbeater?: { clear: () => void };
}) {
  const connection = resource.connection as
    | RabbitConnectionResource
    | undefined;

  connection?.heartbeater?.clear();
  resource.heartbeater?.clear();
  connection?.stream?.destroy();
  resource.stream?.destroy();
}
