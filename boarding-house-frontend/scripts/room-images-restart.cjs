/* eslint-disable @typescript-eslint/no-require-imports */
// Cold-start the packaged backend against ONLY the synthetic HTTP test schema/storage.
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  assert = require("node:assert/strict"),
  { spawn } = require("node:child_process");
const backend = path.resolve(__dirname, "../../boarding-house-backend");
const out = path.resolve(__dirname, "../../docs/qa/room-images");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let child;
async function main() {
  const ready = JSON.parse(
    fs.readFileSync("D:/DATN/prompt16-browser-ready.json", "utf8"),
  );
  const logBytes = fs.readFileSync(
    path.join(backend, "room-images-verified-package.log"),
  );
  const log = logBytes.toString(
    logBytes[0] === 255 && logBytes[1] === 254 ? "utf16le" : "utf8",
  );
  const dbUrl = log.match(
    /Database:\s*(jdbc:mysql:\/\/127\.0\.0\.1:13319\/property_image_http_[a-f0-9]+\?serverTimezone=UTC)/,
  )?.[1];
  assert.ok(dbUrl, "Expected an isolated HTTP fixture schema on port 13319");
  const evidence = JSON.parse(
    fs.readFileSync(path.join(out, "http.json"), "utf8"),
  );
  const own = evidence.cases.find(
    (c) => c.status === 200 && c.path.startsWith("/tenant/contracts/"),
  );
  const key = own.path.split("/").at(-1);
  const image = evidence.cases.find(
    (c) =>
      c.status === 200 &&
      c.path.startsWith("/admin/properties/") &&
      c.path.endsWith(key),
  );
  assert.ok(image);
  const property = image.path.split("/")[3];
  const roots = fs
    .readdirSync(os.tmpdir(), { withFileTypes: true })
    .filter(
      (e) => e.isDirectory() && e.name.startsWith("property-image-http-"),
    );
  const root = roots
    .map((e) => path.join(os.tmpdir(), e.name))
    .find((p) => fs.existsSync(path.join(p, property, key)));
  assert.ok(root, "Expected persisted photo from the completed HTTP fixture");
  const args = [
    "-Xms32m",
    "-Xmx384m",
    "-XX:MaxMetaspaceSize=256m",
    "-jar",
    "target/boarding-house-backend-0.0.1-SNAPSHOT-exec.jar",
    "--server.port=0",
    "--spring.profiles.active=dev",
    "--app.scheduling.enabled=false",
    "--app.mail.business-delivery-enabled=false",
    "--app.ai.provider=none",
    "--spring.datasource.url=" + dbUrl,
    "--spring.datasource.username=root",
    "--spring.datasource.password=",
    "--spring.flyway.url=" + dbUrl,
    "--spring.flyway.user=root",
    "--spring.flyway.password=",
    "--app.media.property-root=" + root,
    "--app.security.jwt.secret=property-image-qa-secret-abcdefghijklmnopqrstuvwxyz0123456789",
  ];
  const output = fs.createWriteStream(
    path.join(backend, "room-images-restart.log"),
  );
  let text = "";
  child = spawn("java", args, {
    cwd: backend,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => {
    text = (text + chunk).slice(-128000);
    output.write(chunk);
  });
  child.stderr.on("data", (chunk) => output.write(chunk));
  let port;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw Error("Packaged backend exited during restart");
    port = text.match(/Tomcat started on port (\d+)/)?.[1];
    if (port) break;
    await delay(200);
  }
  assert.ok(port, "Restart startup timed out");
  const api = "http://127.0.0.1:" + port + "/api";
  const response = await fetch(api + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ready.email,
      password: ready.password,
      requestedRole: "OWNER",
    }),
  });
  assert.equal(response.status, 200);
  const token = (await response.json()).data.accessToken;
  const fetched = await fetch(api + image.path, {
    headers: { Authorization: "Bearer " + token },
  });
  assert.equal(fetched.status, 200);
  assert.equal(fetched.headers.get("content-type"), "image/png");
  const bytes = Buffer.from(await fetched.arrayBuffer());
  assert.deepEqual(bytes, fs.readFileSync(path.join(root, property, key)));
  fs.writeFileSync(
    path.join(out, "restart.json"),
    JSON.stringify(
      {
        status: "PASS",
        newJvm: true,
        packagedJar: true,
        imageHttpStatus: 200,
        contentType: "image/png",
        bytesUnchanged: true,
        productionDatabaseAccessed: false,
        businessEmailEnabled: false,
      },
      null,
      2,
    ),
  );
  console.log(
    "Cold backend restart: PASS; stored photo HTTP 200, bytes unchanged",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (child && child.exitCode === null) {
      child.kill();
      await delay(1000);
    }
  });
