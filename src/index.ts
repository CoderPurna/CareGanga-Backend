import "dotenv/config";
import { db } from "./db/db.js";

const port = process.env.PORT ?? 8000;

try {
  console.log("Connecting to the database...");
  await db.$connect();
  console.log("Database connected successfully! 🚀");

  const { default: app } = await import("./app.js");

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });

  app.get("/", (req, res) => {
    res.send("Hello Guys welcome to CareGanga🔥");
  });
} catch (error) {
  console.error("Database connection failed! ❌");
  console.error(error);
  process.exit(1);
}
