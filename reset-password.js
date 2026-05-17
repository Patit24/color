const admin = require("firebase-admin");

// Initialize Firebase Admin using default credentials
admin.initializeApp({
  projectId: "color-trade-4a76f"
});

async function reset() {
  try {
    const email = "kartik22@colortrade.app";
    const user = await admin.auth().getUserByEmail(email);
    console.log("Found Firebase Auth user:", user.uid, user.email);
    
    // Set a clean new password to test
    const newPassword = "password123";
    await admin.auth().updateUser(user.uid, {
      password: newPassword
    });
    console.log(`Successfully reset Firebase Auth password for ${email} to: ${newPassword}`);
  } catch (error) {
    console.error("Error resetting password:", error);
  }
}

reset();
