import { CreateRoomForm } from "@/components/CreateRoomForm";
import { JoinRoomInput } from "@/components/JoinRoomInput";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 p-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-5xl font-bold tracking-tight">SyncWatch 🎬</h1>
        <p className="text-lg text-neutral-300">
          Watch YouTube & Bilibili videos in perfect sync with your friends.
        </p>
      </header>

      <section className="grid w-full gap-4 md:grid-cols-2">
        <CreateRoomForm />
        <JoinRoomInput />
      </section>
    </main>
  );
}
