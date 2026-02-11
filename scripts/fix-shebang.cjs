const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "dist", "index.js");
let s = fs.readFileSync(file, "utf8");
s = s.replace(/^#!\/usr\/bin\/env bun/, "#!/usr/bin/env node");
fs.writeFileSync(file, s);
