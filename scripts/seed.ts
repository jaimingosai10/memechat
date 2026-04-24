import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { messages } from "../src/db/schema";

const rows = [
  {
    handle: "doge",
    imageUrl: "https://i.imgflip.com/4t0m5.jpg",
    topText: "such memechat",
    bottomText: "very v0",
  },
  {
    handle: "drake",
    imageUrl: "https://i.imgflip.com/30b1gx.jpg",
    topText: "custom chat app",
    bottomText: "just ship memechat",
  },
  {
    handle: "distracted-bf",
    imageUrl: "https://i.imgflip.com/1ur9b0.jpg",
    topText: "my todo list",
    bottomText: "new memes",
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  await db.insert(messages).values(rows);
  await sql.end();
  console.log(`seeded ${rows.length} messages`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
