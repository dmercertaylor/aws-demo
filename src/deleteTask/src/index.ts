import type { LambdaEvent, Response } from "./interfaces.ts";

export const handler = async (event: LambdaEvent): Promise<Response> => {
  const result = {
    taskId: 'Hello World!'
  };

  return result;
};
