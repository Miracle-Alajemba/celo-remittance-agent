#!/usr/bin/env node
/**
 * Database Connection Diagnostic Script
 * Run this to verify MongoDB is properly connected
 */

import * as dotenv from "dotenv";
import { connectDB, isDbConnected } from "../src/database/connection";
import { getUserByIdOrAddress } from "../src/database/services";

dotenv.config();

async function diagnoseDatabase() {
  console.log("🔍 Celo Remittance Agent - Database Diagnostic\n");
  console.log("─".repeat(60));

  // Step 1: Check env var
  const mongoUri = process.env.MONGODB_URI;
  console.log("\n📝 Step 1: Checking MONGODB_URI in .env");
  if (mongoUri) {
    const masked = mongoUri.replace(/:[^:]+@/, ":****@"); // Hide password
    console.log(`✅ MONGODB_URI found: ${masked}`);
  } else {
    console.log("❌ MONGODB_URI NOT FOUND in .env file!");
    console.log("   Add this line to .env:");
    console.log("   MONGODB_URI=mongodb+srv://user:password@host/dbname");
    return;
  }

  // Step 2: Attempt connection
  console.log("\n🔗 Step 2: Attempting connection to MongoDB...");
  try {
    await connectDB();
    const connected = isDbConnected();

    if (connected) {
      console.log("✅ MongoDB connection SUCCESSFUL!");
    } else {
      console.log("❌ Connection failed - no errors but readyState not 1");
      return;
    }
  } catch (error) {
    console.error("❌ Connection FAILED:", error);
    return;
  }

  // Step 3: Test query
  console.log("\n📊 Step 3: Testing database queries...");
  try {
    // Try to find a user (may not exist, that's ok)
    const testUser = await getUserByIdOrAddress("test_user_123");
    console.log("✅ Database query executed successfully");
    console.log(`   Found user: ${testUser ? "Yes" : "No"}`);
  } catch (error) {
    console.error("❌ Query failed:", error);
    return;
  }

  // Step 4: Summary
  console.log("\n" + "─".repeat(60));
  console.log("✅ ALL TESTS PASSED!");
  console.log("\n📌 Your MongoDB is ready to use. When users:");
  console.log("   1. Provide wallet address → Saved to MongoDB");
  console.log("   2. Send next message → Loaded FROM MongoDB automatically");
  console.log("   3. Won't need to re-enter wallet!");
  console.log("\n─".repeat(60));

  process.exit(0);
}

diagnoseDatabase().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
