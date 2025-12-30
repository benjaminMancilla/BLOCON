type RequestTask<T> = () => Promise<T>;

let requestChain: Promise<unknown> = Promise.resolve();

export const enqueueGraphRequest = async <T>(task: RequestTask<T>) => {
  const next = requestChain.then(task, task);
  requestChain = next.catch(() => undefined);
  return next;
};