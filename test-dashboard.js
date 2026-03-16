#!/usr/bin/env node

// Test dashboard API endpoints
const http = require("http");

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 3001,
      path: path,
      method: "GET",
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

async function testAPIs() {
  console.log("🧪 Testing Dashboard APIs...\n");

  const endpoints = [
    "/api/dashboard/stats",
    "/api/dashboard/transactions",
    "/api/dashboard/users",
    "/api/dashboard/performance",
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const response = await makeRequest(endpoint);
      console.log(`  Status: ${response.status}`);
      console.log(`  Content-Type: ${response.headers["content-type"]}`);

      // Check if it's JSON
      if (response.data.startsWith("{")) {
        console.log(`  ✅ Returns valid JSON (${response.data.length} bytes)`);
        // Parse and pretty print first key
        try {
          const json = JSON.parse(response.data);
          const keys = Object.keys(json).slice(0, 3);
          console.log(`  Keys: ${keys.join(", ")}`);
        } catch (e) {
          console.log(`  ⚠️ JSON parsing error: ${e.message}`);
        }
      } else {
        console.log(
          `  ❌ Not JSON (starts with: ${response.data.substring(0, 20)})`,
        );
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    console.log();
  }
}

testAPIs().catch(console.error);
