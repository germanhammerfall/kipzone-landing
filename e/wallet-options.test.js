"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { walletOptions } = require("./wallet-options.js");

test("iPhone offers Apple only for a true Apple flag and never calls Google", () => {
  const userAgents = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/100 Mobile",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari",
  ];
  for (const userAgent of userAgents) {
    for (const googleEnabled of [false, true]) {
      assert.deepEqual(walletOptions({ userAgent, googleEnabled, appleEnabled: true }),
        { apple: true, google: false, autoGoogle: false });
      for (const appleEnabled of [false, undefined, "true"]) {
        assert.deepEqual(walletOptions({ userAgent, googleEnabled, appleEnabled }),
          { apple: false, google: false, autoGoogle: false });
      }
    }
  }
});

test("desktop, Android and iPad retain automatic Google without any Apple option", () => {
  const devices = [
    { userAgent: "Mozilla/5.0 (Windows NT 10.0)" },
    { userAgent: "Mozilla/5.0 (Linux; Android 15) Mobile" },
    { userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit Safari" },
    { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)", platform: "MacIntel",
      maxTouchPoints: 5 },
  ];
  for (const device of devices) {
    for (const appleEnabled of [false, true]) {
      assert.deepEqual(walletOptions({ ...device, googleEnabled: true, appleEnabled }),
        { apple: false, google: true, autoGoogle: true });
      assert.deepEqual(walletOptions({ ...device, googleEnabled: false, appleEnabled }),
        { apple: false, google: false, autoGoogle: false });
    }
  }
});
