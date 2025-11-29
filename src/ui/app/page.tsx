import Image from "next/image";
import config from "../config";

export async function getTasks() {
  // this will maybe work 100% of the time
  return await fetch(`${process.env.API_GATEWAY_URL}/listTasks`, { cache: 'no-store' })
    .then(res => res.json())
    // who cares
    .catch(err => ({ taskId: "error", err, url: process.env.API_GATEWAY_URL || "no url foundSSSS" }));
}

export default async function TaskList() {
  const tasks = await getTasks();
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        {JSON.stringify(tasks)}
        
        
        new url: {process.env.NEXT_PUBLIC_API_GATEWAY_URL}
      </main>
    </div>
  );
}
