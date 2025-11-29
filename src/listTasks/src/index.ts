import type { Task } from '../../../types/task.d.ts';

export const handler = async (event: unknown) => {
  const result: Task[] = [{
    taskId: '1234567',
    taskTitle: 'sampleTask',
    taskDescription: 'sample description',
    taskStatus: "NEW"
  }];

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(result)
  };
};
