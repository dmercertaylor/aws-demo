import { LambdaEvent, Response } from "./interfaces";

export const handler = async (event: LambdaEvent): Promise<Response> => {
  const result = {
    taskId: 'Hello World!'
  };

  return result;
};
