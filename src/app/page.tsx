export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold">Memechat</h1>
      <p className="text-lg text-gray-600 dark:text-gray-300">
        A public room for live meme-making. v0 is under construction.
      </p>
      <a
        href="/health"
        className="text-sm text-blue-600 underline dark:text-blue-400"
      >
        /health
      </a>
    </main>
  );
}
