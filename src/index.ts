import "dotenv/config";


const { default: app } = await import("./app.js");

const port = process.env.PORT ?? 8000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.get("/", (req, res) => {
  res.send("Hello Guys welcome to CareGanga🔥");
});
