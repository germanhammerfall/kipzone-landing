(function (root) {
  "use strict";

  function walletOptions({ userAgent = "", platform = "",
    googleEnabled = false, appleEnabled = false } = {}) {
    if (/iPhone/i.test(userAgent) || /^iPhone$/i.test(platform)) {
      return { apple: appleEnabled === true, google: false, autoGoogle: false };
    }
    return { apple: false, google: googleEnabled, autoGoogle: googleEnabled };
  }

  if (typeof module === "object" && module.exports) module.exports = { walletOptions };
  root.kipzoneWalletOptions = walletOptions;
})(typeof window === "undefined" ? globalThis : window);
